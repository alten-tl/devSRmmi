import { Database } from '../db/Database';
import type { IVehicleRepository } from '../../application/ports/IVehicleRepository';
import type { ILogger } from '../../application/ports/ILogger';
import type { CreateVehicleInput, VehicleRow } from '../../types';
import { ConflictError } from '../../domain/errors/AppError';

const COLUMNS = 'id, client_id, vin, license_plate, color, year, model, created_at, updated_at';

interface PostgresError extends Error {
  code?: string;
}

export class PostgresVehicleRepository implements IVehicleRepository {
  constructor(private readonly logger: ILogger) {}

  public async create(input: CreateVehicleInput): Promise<VehicleRow> {
    try {
      const { rows } = await Database.query<VehicleRow>(
        `INSERT INTO vehicles (client_id, vin, license_plate, color, year, model)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING ${COLUMNS}`,
        [input.clientId, input.vin, input.licensePlate, input.color, input.year, input.model],
        this.logger
      );
      return rows[0];
    } catch (error) {
      const pgError = error as PostgresError;
      if (pgError.code === '23505') {
        throw new ConflictError('VIN is already registered');
      }
      if (pgError.code === '23503') {
        throw new ConflictError('Related client does not exist');
      }
      throw error instanceof Error ? error : new Error('Unknown repository error');
    }
  }

  public async findById(id: string): Promise<VehicleRow | null> {
    const { rows } = await Database.query<VehicleRow>(
      `SELECT ${COLUMNS} FROM vehicles WHERE id = $1 LIMIT 1`,
      [id],
      this.logger
    );
    return rows[0] ?? null;
  }

  public async findAllByClient(clientId: string): Promise<VehicleRow[]> {
    const { rows } = await Database.query<VehicleRow>(
      `SELECT ${COLUMNS} FROM vehicles WHERE client_id = $1 ORDER BY created_at ASC`,
      [clientId],
      this.logger
    );
    return rows;
  }
}