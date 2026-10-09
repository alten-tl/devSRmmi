import type { IVehicleRepository } from '../ports/IVehicleRepository';
import type { IClientRepository } from '../ports/IClientRepository';
import type { ILogger } from '../ports/ILogger';
import type { IValidator } from '../ports/IValidator';
import type { CreateVehicleInput, VehicleDto } from '../../types';
import { Vehicle } from '../../domain/entities/Vehicle';
import { NotFoundError, ValidationError } from '../../domain/errors/AppError';

export interface IVehicleService {
  createVehicle(input: unknown): Promise<VehicleDto>;
  getVehicleById(id: string): Promise<VehicleDto>;
  listVehiclesByClient(clientId: string): Promise<VehicleDto[]>;
}

/** Vehicle use case: guarantees the owning client exists. */
export class VehicleService implements IVehicleService {
  constructor(
    private readonly vehicleRepository: IVehicleRepository,
    private readonly clientRepository: IClientRepository,
    private readonly validator: IValidator,
    private readonly logger: ILogger
  ) {}

  public async createVehicle(input: unknown): Promise<VehicleDto> {
    const validation = this.validator.validateCreateVehicle(input);
    if (!validation.isValid || !validation.value) {
      throw new ValidationError('Invalid vehicle payload', validation.issues);
    }

    const dto = validation.value as unknown as CreateVehicleInput;
    const clientId = this.validator.validateId(dto.clientId);

    const exists = await this.clientRepository.existsById(clientId);
    if (!exists) {
      throw new NotFoundError('Client');
    }

    const entity = Vehicle.create({ ...dto, clientId });

    this.logger.info('Creating vehicle', { vin: entity.vin, clientId });
    const created = await this.vehicleRepository.create({
      clientId: entity.clientId,
      vin: entity.vin,
      licensePlate: entity.licensePlate,
      color: entity.color,
      year: entity.year,
      model: entity.model,
    });

    this.logger.info('Vehicle created', { id: created.id });
    return Vehicle.fromRow(created).toDto();
  }

  public async getVehicleById(id: string): Promise<VehicleDto> {
    const validId = this.validator.validateId(id);
    const row = await this.vehicleRepository.findById(validId);

    if (!row) {
      throw new NotFoundError('Vehicle');
    }

    return Vehicle.fromRow(row).toDto();
  }

  public async listVehiclesByClient(clientId: string): Promise<VehicleDto[]> {
    const validId = this.validator.validateId(clientId);
    const rows = await this.vehicleRepository.findAllByClient(validId);
    return rows.map((row) => Vehicle.fromRow(row).toDto());
  }
}