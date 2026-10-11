import type { ClientRow, CreateClientInput } from '../../types';

/**
 * Output port (Repository Pattern). The domain/application depends on this
 * abstraction, never on Postgres directly (dependency inversion).
 */
export interface IClientRepository {
  create(input: CreateClientInput): Promise<ClientRow>;
  findById(id: string): Promise<ClientRow | null>;
  existsById(id: string): Promise<boolean>;
}