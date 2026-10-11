import { Database } from '../db/Database';
import type { IAppointmentRepository } from '../../application/ports/IAppointmentRepository';
import type { ILogger } from '../../application/ports/ILogger';
import type {
  AppointmentDetailRow,
  AppointmentRow,
  AppointmentStatus,
  CreateAppointmentInput,
  UpdateAppointmentInput,
} from '../../types';
import { ConflictError } from '../../domain/errors/AppError';

const DETAIL_COLUMNS = `
  c.id, c.client_id, c.vehicle_id,
  c.date::text AS date, c.time::text AS time,
  c.comments, c.status, c.created_at, c.updated_at,
  cl.name AS client_name, cl.timezone AS client_timezone,
  cl.address AS client_address,
  v.vin AS vehicle_vin, v.license_plate AS vehicle_license_plate,
  v.color AS vehicle_color, v.year AS vehicle_year, v.model AS vehicle_model
`;

const DETAIL_FROM = `
  FROM appointments c
  JOIN clients cl ON cl.id = c.client_id
  JOIN vehicles v ON v.id = c.vehicle_id
`;

const ROW_COLUMNS =
  'id, client_id, vehicle_id, date::text AS date, time::text AS time, comments, status, created_at, updated_at';

interface PostgresError extends Error {
  code?: string;
}

/**
 * Appointment repository. Combines:
 *  - parameterized queries (anti SQL injection);
 *  - a partial unique index (date, time) WHERE status='ENABLED' that enforces
 *    at the database level that no double bookings can happen in a race.
 */
export class PostgresAppointmentRepository implements IAppointmentRepository {
  constructor(private readonly logger: ILogger) {}

  public async create(input: CreateAppointmentInput): Promise<AppointmentDetailRow> {
    try {
      const { rows } = await Database.query<{ id: string }>(
        `INSERT INTO appointments (client_id, vehicle_id, date, time, comments)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id`,
        [input.clientId, input.vehicleId, input.date, input.time, input.comments ?? null],
        this.logger
      );

      const created = await this.findById(rows[0].id);
      if (!created) {
        throw new Error('Appointment not found after creation');
      }
      return created;
    } catch (error) {
      throw this.mapError(error, 'The requested slot is already booked');
    }
  }

  public async findById(id: string): Promise<AppointmentDetailRow | null> {
    const { rows } = await Database.query<AppointmentDetailRow>(
      `SELECT ${DETAIL_COLUMNS} ${DETAIL_FROM} WHERE c.id = $1 LIMIT 1`,
      [id],
      this.logger
    );
    return rows[0] ?? null;
  }

  public async findByDate(date: string): Promise<AppointmentDetailRow[]> {
    const { rows } = await Database.query<AppointmentDetailRow>(
      `SELECT ${DETAIL_COLUMNS} ${DETAIL_FROM}
       WHERE c.date = $1
       ORDER BY c.time ASC, c.created_at ASC`,
      [date],
      this.logger
    );
    return rows;
  }

  public async findConflict(date: string, time: string, excludeId?: string): Promise<AppointmentRow | null> {
    const { rows } = await Database.query<AppointmentRow>(
      `SELECT ${ROW_COLUMNS}
       FROM appointments
       WHERE date = $1 AND time = $2 AND status = 'ENABLED'
         AND ($3::uuid IS NULL OR id <> $3::uuid)
       LIMIT 1`,
      [date, time, excludeId ?? null],
      this.logger
    );
    return rows[0] ?? null;
  }

  public async update(id: string, input: UpdateAppointmentInput): Promise<AppointmentDetailRow | null> {
    try {
      const { rowCount } = await Database.query(
        `UPDATE appointments
         SET date = $2, time = $3, comments = $4
         WHERE id = $1`,
        [id, input.date, input.time, input.comments ?? null],
        this.logger
      );

      if ((rowCount ?? 0) === 0) {
        return null;
      }
      return this.findById(id);
    } catch (error) {
      throw this.mapError(error, 'The requested slot is already booked');
    }
  }

  public async updateStatus(id: string, status: AppointmentStatus): Promise<AppointmentDetailRow | null> {
    const { rowCount } = await Database.query(
      `UPDATE appointments SET status = $2 WHERE id = $1`,
      [id, status],
      this.logger
    );

    if ((rowCount ?? 0) === 0) {
      return null;
    }
    return this.findById(id);
  }

  private mapError(error: unknown, conflictMessage: string): Error {
    const pgError = error as PostgresError;

    if (pgError.code === '23505') {
      return new ConflictError(conflictMessage);
    }
    if (pgError.code === '23503') {
      return new ConflictError('Related resource does not exist');
    }

    return error instanceof Error ? error : new Error('Unknown repository error');
  }
}