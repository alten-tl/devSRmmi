import { describe, expect, it, vi, beforeEach } from 'vitest';
import { AppointmentService } from '../../src/application/services/AppointmentService';
import { AjvValidator } from '../../src/infrastructure/validators/AjvValidator';
import {
  ConflictError,
  NotFoundError,
  ValidationError,
} from '../../src/domain/errors/AppError';
import type { IAppointmentRepository } from '../../src/application/ports/IAppointmentRepository';
import type { IClientRepository } from '../../src/application/ports/IClientRepository';
import type { IVehicleRepository } from '../../src/application/ports/IVehicleRepository';
import type { ILogger } from '../../src/application/ports/ILogger';
import type { AppointmentDetailRow, AppointmentRow } from '../../src/types';

const CLIENT_ID = '11111111-1111-4111-8111-111111111111';
const CLIENT_2_ID = '33333333-3333-4333-8333-333333333333';
const VEHICLE_ID = '22222222-2222-4222-8222-222222222222';
const VEHICLE_2_ID = '44444444-4444-4444-8444-444444444444';
const APPOINTMENT_ID = '55555555-5555-4555-8555-555555555555';

const buildDetailRow = (overrides: Partial<AppointmentDetailRow> = {}): AppointmentDetailRow => ({
  id: APPOINTMENT_ID,
  client_id: CLIENT_ID,
  vehicle_id: VEHICLE_ID,
  date: '2026-10-20',
  time: '09:00:00',
  comments: 'Cambio de aceite',
  status: 'ENABLED',
  created_at: new Date('2026-10-09T10:00:00Z'),
  updated_at: new Date('2026-10-09T10:00:00Z'),
  client_name: 'Ana Lopez',
  client_timezone: 'America/Bogota',
  client_address: 'Calle 1 # 2-3',
  vehicle_vin: '1HGCM82633A004352',
  vehicle_license_plate: 'ABC123',
  vehicle_color: 'Rojo',
  vehicle_year: 2020,
  vehicle_model: 'Civic',
  ...overrides,
});

const buildConflictRow = (overrides: Partial<AppointmentRow> = {}): AppointmentRow => ({
  id: '66666666-6666-4666-8666-666666666666',
  client_id: CLIENT_2_ID,
  vehicle_id: VEHICLE_2_ID,
  date: '2026-10-20',
  time: '09:00:00',
  comments: null,
  status: 'ENABLED',
  created_at: new Date(),
  updated_at: new Date(),
  ...overrides,
});

const createRepositoryMocks = () => ({
  appointmentRepository: {
    create: vi.fn<[unknown], Promise<AppointmentDetailRow>>(),
    findById: vi.fn<[string], Promise<AppointmentDetailRow | null>>(),
    findByDate: vi.fn<[string], Promise<AppointmentDetailRow[]>>(),
    findConflict: vi.fn<[string, string, string?], Promise<AppointmentRow | null>>(),
    update: vi.fn(),
    updateStatus: vi.fn(),
  } satisfies IAppointmentRepository,
  clientRepository: {
    create: vi.fn(),
    findById: vi.fn(),
    existsById: vi.fn<[string], Promise<boolean>>(),
  } satisfies IClientRepository,
  vehicleRepository: {
    create: vi.fn(),
    findById: vi.fn<[string], Promise<{ id: string; client_id: string; vin: string } | null>>(),
    findAllByClient: vi.fn(),
  } satisfies IVehicleRepository,
  logger: {
    fatal: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
    trace: vi.fn(),
    child: vi.fn(),
  } satisfies ILogger as ILogger,
});

describe('AppointmentService (appointment business rules)', () => {
  let mocks: ReturnType<typeof createRepositoryMocks>;
  let service: AppointmentService;

  beforeEach(() => {
    mocks = createRepositoryMocks();
    service = new AppointmentService(
      mocks.appointmentRepository,
      mocks.clientRepository,
      mocks.vehicleRepository,
      new AjvValidator(),
      mocks.logger
    );
  });

  describe('createAppointment', () => {
    const input = {
      clientId: CLIENT_ID,
      vehicleId: VEHICLE_ID,
      date: '2026-10-20',
      time: '09:00',
      comments: 'Cambio de aceite',
    };

    it('creates an appointment when the slot is free', async () => {
      mocks.clientRepository.existsById.mockResolvedValue(true);
      mocks.vehicleRepository.findById.mockResolvedValue({
        id: VEHICLE_ID,
        client_id: CLIENT_ID,
        vin: '1HGCM82633A004352',
      });
      mocks.appointmentRepository.findConflict.mockResolvedValue(null);
      mocks.appointmentRepository.create.mockResolvedValue(buildDetailRow());

      const result = await service.createAppointment(input);

      expect(result).toMatchObject({
        id: APPOINTMENT_ID,
        date: '2026-10-20',
        time: '09:00:00',
        status: 'ENABLED',
      });
      expect(result.client?.name).toBe('Ana Lopez');
      expect(result.vehicle?.licensePlate).toBe('ABC123');
      expect(mocks.appointmentRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ date: '2026-10-20', time: '09:00:00' })
      );
    });

    it('throws ConflictError if the slot is already booked', async () => {
      mocks.clientRepository.existsById.mockResolvedValue(true);
      mocks.vehicleRepository.findById.mockResolvedValue({
        id: VEHICLE_ID,
        client_id: CLIENT_ID,
        vin: '1HGCM82633A004352',
      });
      mocks.appointmentRepository.findConflict.mockResolvedValue(buildConflictRow());

      await expect(service.createAppointment(input)).rejects.toBeInstanceOf(ConflictError);
      expect(mocks.appointmentRepository.create).not.toHaveBeenCalled();
    });

    it('throws NotFoundError if the client does not exist', async () => {
      mocks.clientRepository.existsById.mockResolvedValue(false);

      await expect(service.createAppointment(input)).rejects.toBeInstanceOf(NotFoundError);
      expect(mocks.appointmentRepository.create).not.toHaveBeenCalled();
    });

    it('throws ConflictError if the vehicle does not belong to the client', async () => {
      mocks.clientRepository.existsById.mockResolvedValue(true);
      mocks.vehicleRepository.findById.mockResolvedValue({
        id: VEHICLE_ID,
        client_id: CLIENT_2_ID,
        vin: '1HGCM82633A004352',
      });

      await expect(service.createAppointment(input)).rejects.toBeInstanceOf(ConflictError);
    });

    it('throws ValidationError on invalid payload or mass assignment', async () => {
      await expect(
        service.createAppointment({ ...input, status: 'ENABLED' })
      ).rejects.toBeInstanceOf(ValidationError);
      await expect(service.createAppointment({ clientId: 'x' })).rejects.toBeInstanceOf(
        ValidationError
      );
      expect(mocks.appointmentRepository.create).not.toHaveBeenCalled();
    });
  });

  describe('updateAppointment (reschedule)', () => {
    it('reschedules if the new slot is free', async () => {
      mocks.appointmentRepository.findById.mockResolvedValue(buildDetailRow());
      mocks.appointmentRepository.findConflict.mockResolvedValue(null);
      mocks.appointmentRepository.update.mockResolvedValue(
        buildDetailRow({ date: '2026-10-21', time: '11:30:00' })
      );

      const result = await service.updateAppointment(APPOINTMENT_ID, {
        date: '2026-10-21',
        time: '11:30',
      });

      expect(result.date).toBe('2026-10-21');
      expect(result.time).toBe('11:30:00');
      expect(mocks.appointmentRepository.findConflict).toHaveBeenCalledWith(
        '2026-10-21',
        '11:30:00',
        APPOINTMENT_ID
      );
    });

    it('throws ConflictError if the slot is booked by another appointment', async () => {
      mocks.appointmentRepository.findById.mockResolvedValue(buildDetailRow());
      mocks.appointmentRepository.findConflict.mockResolvedValue(buildConflictRow());

      await expect(
        service.updateAppointment(APPOINTMENT_ID, { date: '2026-10-21', time: '11:30' })
      ).rejects.toBeInstanceOf(ConflictError);
      expect(mocks.appointmentRepository.update).not.toHaveBeenCalled();
    });

    it('throws ConflictError if the appointment is DISABLED', async () => {
      mocks.appointmentRepository.findById.mockResolvedValue(
        buildDetailRow({ status: 'DISABLED' })
      );

      await expect(
        service.updateAppointment(APPOINTMENT_ID, { date: '2026-10-21', time: '11:30' })
      ).rejects.toBeInstanceOf(ConflictError);
    });

    it('throws NotFoundError if the appointment does not exist', async () => {
      mocks.appointmentRepository.findById.mockResolvedValue(null);

      await expect(
        service.updateAppointment(APPOINTMENT_ID, { date: '2026-10-21', time: '11:30' })
      ).rejects.toBeInstanceOf(NotFoundError);
    });
  });

  describe('cancelAppointment', () => {
    it('changes the status to DISABLED', async () => {
      mocks.appointmentRepository.findById.mockResolvedValue(buildDetailRow());
      mocks.appointmentRepository.updateStatus.mockResolvedValue(
        buildDetailRow({ status: 'DISABLED' })
      );

      const result = await service.cancelAppointment(APPOINTMENT_ID);

      expect(result.status).toBe('DISABLED');
      expect(mocks.appointmentRepository.updateStatus).toHaveBeenCalledWith(APPOINTMENT_ID, 'DISABLED');
    });

    it('throws ConflictError if it is already cancelled', async () => {
      mocks.appointmentRepository.findById.mockResolvedValue(
        buildDetailRow({ status: 'DISABLED' })
      );

      await expect(service.cancelAppointment(APPOINTMENT_ID)).rejects.toBeInstanceOf(ConflictError);
      expect(mocks.appointmentRepository.updateStatus).not.toHaveBeenCalled();
    });

    it('throws NotFoundError if it does not exist', async () => {
      mocks.appointmentRepository.findById.mockResolvedValue(null);

      await expect(service.cancelAppointment(APPOINTMENT_ID)).rejects.toBeInstanceOf(NotFoundError);
    });
  });

  describe('listAppointmentsByDate', () => {
    it('returns the day appointments with detail', async () => {
      mocks.appointmentRepository.findByDate.mockResolvedValue([buildDetailRow()]);

      const result = await service.listAppointmentsByDate('2026-10-20');

      expect(result).toHaveLength(1);
      expect(result[0].vehicle?.model).toBe('Civic');
      expect(mocks.appointmentRepository.findByDate).toHaveBeenCalledWith('2026-10-20');
    });

    it('throws ValidationError for invalid dates', async () => {
      await expect(service.listAppointmentsByDate('yesterday')).rejects.toBeInstanceOf(
        ValidationError
      );
      expect(mocks.appointmentRepository.findByDate).not.toHaveBeenCalled();
    });
  });
});