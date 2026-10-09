import { Database } from '../db/Database';
import type { IClientRepository } from '../../application/ports/IClientRepository';
import type { ILogger } from '../../application/ports/ILogger';
import type { ClientRow, CreateClientInput } from '../../types';

const COLUMNS = 'id, name, timezone, address, created_at, updated_at';

/** Concrete repository (Adapter). SQL is 100% parameterized. */
export class PostgresClientRepository implements IClientRepository {
  constructor(private readonly logger: ILogger) {}

  public async create(input: CreateClientInput): Promise<ClientRow> {
    const { rows } = await Database.query<ClientRow>(
      `INSERT INTO clients (name, timezone, address)
       VALUES ($1, $2, $3)
       RETURNING ${COLUMNS}`,
      [input.name, input.timezone, input.address],
      this.logger
    );
    return rows[0];
  }

  public async findById(id: string): Promise<ClientRow | null> {
    const { rows } = await Database.query<ClientRow>(
      `SELECT ${COLUMNS} FROM clients WHERE id = $1 LIMIT 1`,
      [id],
      this.logger
    );
    return rows[0] ?? null;
  }

  public async existsById(id: string): Promise<boolean> {
    const { rows } = await Database.query<{ exists: boolean }>(
      `SELECT EXISTS(SELECT 1 FROM clients WHERE id = $1) AS exists`,
      [id],
      this.logger
    );
    return rows[0]?.exists ?? false;
  }
}