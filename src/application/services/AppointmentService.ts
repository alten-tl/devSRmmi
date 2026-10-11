import type { IAppointmentRepository } from '../ports/IAppointmentRepository';
import type { IClientRepository } from '../ports/IClientRepository';
import type { IVehicleRepository } from '../ports/IVehicleRepository';
import type { ILogger } from '../ports/ILogger';
import type { IValidator } from '../ports/IValidator';
import type {
  AppointmentDetailRow,
  AppointmentDto,
  CreateAppointmentInput,
  UpdateAppointmentInput,
} from '../../types';
import { Appointment } from '../../domain/entities/Appointment';
import { ConflictError, NotFoundError, ValidationError } from '../../domain/errors/AppError';

export interface IAppointmentService {
  listAppointmentsByDate(date: string): Promise<AppointmentDto[]>;
  createAppointment(input: unknown): Promise<AppointmentDto>;
  updateAppointment(id: string, input: unknown): Promise<AppointmentDto>;
  cancelAppointment(id: string): Promise<AppointmentDto>;
}

/**
 * Central appointment use case. Orchestrates the business rules:
 *  - the appointment belongs to a client and to one of that client's vehicles;
 *  - a slot (date + time) cannot be occupied by another ENABLED appointment;
 *  - canceling = changing the status to DISABLED and bumping timestamps.
 * It does not know Postgres, AJV nor pino: only its ports.
 */
export class AppointmentService implements IAppointmentService {
  constructor(
    private readonly appointmentRepository: IAppointmentRepository,
    private readonly clientRepository: IClientRepository,
    private readonly vehicleRepository: IVehicleRepository,
    private readonly validator: IValidator,
    private readonly logger: ILogger
  ) {}

  public async listAppointmentsByDate(date: string): Promise<AppointmentDto[]> {
    const validation = this.validator.validateListAppointmentsQuery({ date });
    if (!validation.isValid || !validation.value) {
      throw new ValidationError('Invalid date filter', validation.issues);
    }

    const validDate = (validation.value as { date: string }).date;
    this.logger.info('Listing appointments by date', { date: validDate });

    const rows = await this.appointmentRepository.findByDate(validDate);
    return rows.map((row) => this.toDetailDto(row));
  }

  public async createAppointment(input: unknown): Promise<AppointmentDto> {
    const validation = this.validator.validateCreateAppointment(input);
    if (!validation.isValid || !validation.value) {
      throw new ValidationError('Invalid appointment payload', validation.issues);
    }

    const dto = validation.value as unknown as CreateAppointmentInput;
    const clientId = this.validator.validateId(dto.clientId);
    const vehicleId = this.validator.validateId(dto.vehicleId);

    await this.assertClientExists(clientId);
    await this.assertVehicleBelongsToClient(vehicleId, clientId);

    const entity = Appointment.create({ ...dto, clientId, vehicleId });

    await this.assertSlotAvailable(entity.date, entity.time);

    this.logger.info('Creating appointment', {
      clientId,
      vehicleId,
      date: entity.date,
      time: entity.time,
    });

    const created = await this.appointmentRepository.create({
      clientId: entity.clientId,
      vehicleId: entity.vehicleId,
      date: entity.date,
      time: entity.time,
      comments: entity.comments,
    });

    this.logger.info('Appointment created', { id: created.id });
    return this.toDetailDto(created);
  }

  public async updateAppointment(id: string, input: unknown): Promise<AppointmentDto> {
    const validId = this.validator.validateId(id);

    const validation = this.validator.validateUpdateAppointment(input);
    if (!validation.isValid || !validation.value) {
      throw new ValidationError('Invalid appointment payload', validation.issues);
    }

    const current = await this.appointmentRepository.findById(validId);
    if (!current) {
      throw new NotFoundError('Appointment');
    }

    const entity = Appointment.fromRow(current);
    if (!entity.isEnabled()) {
      throw new ConflictError('Cannot reschedule a disabled appointment');
    }

    const changes = validation.value as unknown as UpdateAppointmentInput;
    const updated = entity.reschedule(changes);

    await this.assertSlotAvailable(updated.date, updated.time, validId);

    this.logger.info('Rescheduling appointment', {
      id: validId,
      date: updated.date,
      time: updated.time,
    });

    const row = await this.appointmentRepository.update(validId, {
      date: updated.date,
      time: updated.time,
      comments: updated.comments,
    });

    if (!row) {
      throw new NotFoundError('Appointment');
    }

    return this.toDetailDto(row);
  }

  public async cancelAppointment(id: string): Promise<AppointmentDto> {
    const validId = this.validator.validateId(id);

    const current = await this.appointmentRepository.findById(validId);
    if (!current) {
      throw new NotFoundError('Appointment');
    }

    const entity = Appointment.fromRow(current);
    if (!entity.isEnabled()) {
      throw new ConflictError('Appointment is already cancelled');
    }

    const disabled = entity.disable();

    this.logger.info('Cancelling appointment', { id: validId });

    const row = await this.appointmentRepository.updateStatus(disabled.id, disabled.status);
    if (!row) {
      throw new NotFoundError('Appointment');
    }

    return this.toDetailDto(row);
  }

  private async assertClientExists(clientId: string): Promise<void> {
    const exists = await this.clientRepository.existsById(clientId);
    if (!exists) {
      throw new NotFoundError('Client');
    }
  }

  private async assertVehicleBelongsToClient(vehicleId: string, clientId: string): Promise<void> {
    const vehicle = await this.vehicleRepository.findById(vehicleId);
    if (!vehicle) {
      throw new NotFoundError('Vehicle');
    }
    if (vehicle.client_id !== clientId) {
      throw new ConflictError('Vehicle does not belong to the given client');
    }
  }

  private async assertSlotAvailable(date: string, time: string, excludeId?: string): Promise<void> {
    const conflict = await this.appointmentRepository.findConflict(date, time, excludeId);
    if (conflict) {
      throw new ConflictError(`The slot ${date} ${time} is already booked`);
    }
  }

  private toDetailDto(row: AppointmentDetailRow): AppointmentDto {
    const appointment = Appointment.fromRow(row);

    return {
      ...appointment.toDto(),
      client: {
        id: row.client_id,
        name: row.client_name,
        timezone: row.client_timezone,
        address: row.client_address,
        createdAt: new Date(row.created_at).toISOString(),
        updatedAt: new Date(row.updated_at).toISOString(),
      },
      vehicle: {
        id: row.vehicle_id,
        clientId: row.client_id,
        vin: row.vehicle_vin,
        licensePlate: row.vehicle_license_plate,
        color: row.vehicle_color,
        year: row.vehicle_year,
        model: row.vehicle_model,
        createdAt: new Date(row.created_at).toISOString(),
        updatedAt: new Date(row.updated_at).toISOString(),
      },
    };
  }
}