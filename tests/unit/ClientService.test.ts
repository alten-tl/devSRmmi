import { describe, expect, it, vi, beforeEach } from 'vitest';
import { ClientService } from '../../src/application/services/ClientService';
import { AjvValidator } from '../../src/infrastructure/validators/AjvValidator';
import { NotFoundError, ValidationError } from '../../src/domain/errors/AppError';
import type { IClientRepository } from '../../src/application/ports/IClientRepository';
import type { ILogger } from '../../src/application/ports/ILogger';
import type { ClientRow } from '../../src/types';

const CLIENT_ID = '11111111-1111-4111-8111-111111111111';

const buildRow = (overrides: Partial<ClientRow> = {}): ClientRow => ({
  id: CLIENT_ID,
  name: 'Ana Lopez',
  timezone: 'America/Bogota',
  address: 'Calle 1 # 2-3, Bogota',
  created_at: new Date('2026-01-01T00:00:00Z'),
  updated_at: new Date('2026-01-01T00:00:00Z'),
  ...overrides,
});

const createRepositoryMock = () =>
  ({
    create: vi.fn<[unknown], Promise<ClientRow>>(),
    findById: vi.fn<[string], Promise<ClientRow | null>>(),
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

describe('ClientService', () => {
  let repository: ReturnType<typeof createRepositoryMock>;
  let service: ClientService;

  beforeEach(() => {
    repository = createRepositoryMock();
    service = new ClientService(repository, new AjvValidator(), createLoggerMock());
  });

  describe('createClient', () => {
    it('creates a valid client (normalizes timezone and address)', async () => {
      repository.create.mockResolvedValue(buildRow());

      const result = await service.createClient({
        name: 'Ana Lopez',
        timezone: 'America/Bogota',
        address: 'Calle 1 # 2-3, Bogota',
      });

      expect(result.id).toBe(CLIENT_ID);
      expect(result.timezone).toBe('America/Bogota');
      expect(repository.create).toHaveBeenCalledWith({
        name: 'Ana Lopez',
        timezone: 'America/Bogota',
        address: 'Calle 1 # 2-3, Bogota',
      });
    });

    it('throws ValidationError on mass assignment', async () => {
      await expect(
        service.createClient({
          name: 'Ana',
          timezone: 'America/Bogota',
          address: 'Calle 1',
          isAdmin: true,
        })
      ).rejects.toBeInstanceOf(ValidationError);
      expect(repository.create).not.toHaveBeenCalled();
    });

    it('throws ValidationError if the timezone does not exist', async () => {
      await expect(
        service.createClient({ name: 'Ana', timezone: 'Mars/Olympus', address: 'Calle 1' })
      ).rejects.toBeInstanceOf(ValidationError);
    });
  });

  describe('getClientById', () => {
    it('returns the client when it exists', async () => {
      repository.findById.mockResolvedValue(buildRow());

      const result = await service.getClientById(CLIENT_ID);

      expect(result.name).toBe('Ana Lopez');
    });

    it('throws NotFoundError when it does not exist', async () => {
      repository.findById.mockResolvedValue(null);
      await expect(service.getClientById(CLIENT_ID)).rejects.toBeInstanceOf(NotFoundError);
    });

    it('rejects non-UUID ids before touching the DB', async () => {
      await expect(service.getClientById("1' OR '1'='1")).rejects.toBeInstanceOf(ValidationError);
      expect(repository.findById).not.toHaveBeenCalled();
    });
  });
});