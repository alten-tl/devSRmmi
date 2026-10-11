import type { IClientRepository } from '../ports/IClientRepository';
import type { ILogger } from '../ports/ILogger';
import type { IValidator } from '../ports/IValidator';
import type { ClientDto, CreateClientInput } from '../../types';
import { Client } from '../../domain/entities/Client';
import { NotFoundError, ValidationError } from '../../domain/errors/AppError';

export interface IClientService {
  createClient(input: unknown): Promise<ClientDto>;
  getClientById(id: string): Promise<ClientDto>;
}

/** Client use case: validate -> build entity -> persist -> DTO. */
export class ClientService implements IClientService {
  constructor(
    private readonly clientRepository: IClientRepository,
    private readonly validator: IValidator,
    private readonly logger: ILogger
  ) {}

  public async createClient(input: unknown): Promise<ClientDto> {
    const validation = this.validator.validateCreateClient(input);
    if (!validation.isValid || !validation.value) {
      throw new ValidationError('Invalid client payload', validation.issues);
    }

    const entity = Client.create(validation.value as unknown as CreateClientInput);

    this.logger.info('Creating client', { name: entity.name });
    const created = await this.clientRepository.create({
      name: entity.name,
      timezone: entity.timezone,
      address: entity.address,
    });

    this.logger.info('Client created', { id: created.id });
    return Client.fromRow(created).toDto();
  }

  public async getClientById(id: string): Promise<ClientDto> {
    const validId = this.validator.validateId(id);
    const row = await this.clientRepository.findById(validId);

    if (!row) {
      throw new NotFoundError('Client');
    }

    return Client.fromRow(row).toDto();
  }
}