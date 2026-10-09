import { describe, expect, it, vi, beforeEach } from 'vitest';
import { VehicleService } from '../../src/application/services/VehicleService';
import { AjvValidator } from '../../src/infrastructure/validators/AjvValidator';
import { NotFoundError, ValidationError } from '../../src/domain/errors/AppError';
import type { IVehicleRepository } from '../../src/application/ports/IVehicleRepository';
import type { IClientRepository } from '../../src/application/ports/IClientRepository';
import type { ILogger } from '../../src/application/ports/ILogger';
import type { VehicleRow } from '../../src/types';

const CLIENT_ID = '11111111-1111-4111-8111-111111111111';

const buildRow = (overrides: Partial<VehicleRow> = {}): VehicleRow => ({
  id: '22222222-2222-4222-8222-222222222222',
  client_id: CLIENT_ID,
  vin: '1HGCM82633A004352',
  license_plate: 'ABC123',
  color: 'Rojo',
  year: 2020,
  model: 'Civic',
  created_at: new Date('2026-01-01T00:00:00Z'),
  updated_at: new Date('2026-01-01T00:00:00Z'),
  ...overrides,
});

const createVehicleRepositoryMock = () =>
  ({
    create: vi.fn<[unknown], Promise<VehicleRow>>(),
    findById: vi.fn<[string], Promise<VehicleRow | null>>(),
    findAllByClient: vi.fn<[string], Promise<VehicleRow[]>>(),
  }) satisfies IVehicleRepository;

const createClientRepositoryMock = () =>
  ({
    create: vi.fn(),
    findById: vi.fn(),
    existsById: vi.fn<[string], Promise<boolean>>(),
  }) satisfies IClientRepository;

const createLoggerMock = () =>
  ({
    fatal: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
    trace: vi.fn(),
    child: vi.fn(),
  }) satisfies ILogger as ILogger;

describe('VehicleService', () => {
  let vehicleRepository: ReturnType<typeof createVehicleRepositoryMock>;
  let clientRepository: ReturnType<typeof createClientRepositoryMock>;
  let service: VehicleService;

  beforeEach(() => {
    vehicleRepository = createVehicleRepositoryMock();
    clientRepository = createClientRepositoryMock();
    service = new VehicleService(
      vehicleRepository,
      clientRepository,
      new AjvValidator(),
      createLoggerMock()
    );
  });

  describe('createVehicle', () => {
    const input = {
      clientId: CLIENT_ID,
      vin: '1HGCM82633A004352',
      licensePlate: 'ABC123',
      color: 'Rojo',
      year: 2020,
      model: 'Civic',
    };

    it('creates the vehicle if the client exists', async () => {
      clientRepository.existsById.mockResolvedValue(true);
      vehicleRepository.create.mockResolvedValue(buildRow());

      const result = await service.createVehicle(input);

      expect(result.vin).toBe('1HGCM82633A004352');
      expect(result.licensePlate).toBe('ABC123');
      expect(vehicleRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ vin: '1HGCM82633A004352', licensePlate: 'ABC123' })
      );
    });

    it('throws NotFoundError if the client does not exist', async () => {
      clientRepository.existsById.mockResolvedValue(false);

      await expect(service.createVehicle(input)).rejects.toBeInstanceOf(NotFoundError);
      expect(vehicleRepository.create).not.toHaveBeenCalled();
    });

    it('throws ValidationError on invalid VIN or mass assignment', async () => {
      await expect(
        service.createVehicle({ ...input, vin: 'ABC' })
      ).rejects.toBeInstanceOf(ValidationError);
      await expect(
        service.createVehicle({ ...input, clientId: '1' })
      ).rejects.toBeInstanceOf(ValidationError);
    });
  });

  describe('getVehicleById', () => {
    it('returns the vehicle when it exists', async () => {
      vehicleRepository.findById.mockResolvedValue(buildRow());
      const result = await service.getVehicleById('22222222-2222-4222-8222-222222222222');
      expect(result.model).toBe('Civic');
    });

    it('throws NotFoundError when it does not exist', async () => {
      vehicleRepository.findById.mockResolvedValue(null);
      await expect(service.getVehicleById('22222222-2222-4222-8222-222222222222')).rejects.toBeInstanceOf(
        NotFoundError
      );
    });
  });

  describe('listVehiclesByClient', () => {
    it('returns the vehicles of a client', async () => {
      vehicleRepository.findAllByClient.mockResolvedValue([buildRow()]);
      const result = await service.listVehiclesByClient(CLIENT_ID);
      expect(result).toHaveLength(1);
      expect(vehicleRepository.findAllByClient).toHaveBeenCalledWith(CLIENT_ID);
    });
  });
});