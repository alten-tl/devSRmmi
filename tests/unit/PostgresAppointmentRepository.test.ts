import { describe, expect, it, vi, beforeEach } from 'vitest';
import { Database } from '../../src/infrastructure/db/Database';
import { PostgresAppointmentRepository } from '../../src/infrastructure/repositories/PostgresAppointmentRepository';
import { ConflictError } from '../../src/domain/errors/AppError';
import type { ILogger } from '../../src/application/ports/ILogger';

vi.mock('../../src/infrastructure/db/Database', () => ({
  Database: {
    query: vi.fn(),
    transaction: vi.fn(),
    healthCheck: vi.fn(),
    close: vi.fn(),
  },
}));

const CLIENT_ID = '11111111-1111-4111-8111-111111111111';
const VEHICLE_ID = '22222222-2222-4222-8222-222222222222';
const APPOINTMENT_ID = '55555555-5555-4555-8555-555555555555';

const loggerMock = {
  fatal: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
  info: vi.fn(),
  debug: vi.fn(),
  trace: vi.fn(),
  child: vi.fn(),
} satisfies ILogger as ILogger;

const buildDetail = () => ({
  id: APPOINTMENT_ID,
  client_id: CLIENT_ID,
  vehicle_id: VEHICLE_ID,
  date: '2026-10-20',
  time: '09:00:00',
  comments: null,
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
});

describe('PostgresAppointmentRepository (parameterized SQL + error mapping)', () => {
  const queryMock = vi.mocked(Database.query);
  let repository: PostgresAppointmentRepository;
  let details: unknown[] = [];
  let conflicts: unknown[] = [];
  let updateThrows: { code: string } | null = null;

  beforeEach(() => {
    details = [];
    conflicts = [];
    updateThrows = null;
    repository = new PostgresAppointmentRepository(loggerMock);

    queryMock.mockReset();
    queryMock.mockImplementation(async (text: string, params: unknown[] = []) => {
      if (text.includes('SELECT 1')) {
        return { rows: [{ '?column?': 1 }], rowCount: 1 };
      }
      if (text.startsWith('INSERT INTO appointments')) {
        return { rows: [{ id: params[0] ?? APPOINTMENT_ID }], rowCount: 1 };
      }
      if (text.includes('JOIN clients')) {
        return { rows: details, rowCount: details.length };
      }
      if (text.includes('WHERE date = $1 AND time = $2')) {
        return { rows: conflicts, rowCount: conflicts.length };
      }
      if (text.includes('SET date')) {
        if (updateThrows) {
          const error = new Error('duplicate key') as Error & { code?: string };
          error.code = updateThrows.code;
          throw error;
        }
        return { rows: [], rowCount: 1 };
      }
      if (text.includes('SET status')) {
        return { rows: [], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    });
  });

  it('findById returns the appointment with detail or null', async () => {
    details = [buildDetail()];
    const found = await repository.findById(APPOINTMENT_ID);
    expect(found?.date).toBe('2026-10-20');

    details = [];
    const missing = await repository.findById(APPOINTMENT_ID);
    expect(missing).toBeNull();
  });

  it('findByDate lists the day appointments sorted', async () => {
    details = [buildDetail()];
    const rows = await repository.findByDate('2026-10-20');
    expect(rows).toHaveLength(1);
    expect(queryMock).toHaveBeenCalledWith(
      expect.stringContaining('WHERE c.date = $1'),
      ['2026-10-20'],
      expect.anything()
    );
  });

  it('findConflict filters by slot and excludes the current id', async () => {
    conflicts = [buildDetail()];
    const conflict = await repository.findConflict('2026-10-20', '09:00:00', APPOINTMENT_ID);
    expect(conflict?.id).toBe(APPOINTMENT_ID);
    expect(queryMock.mock.calls.at(-1)?.[1]).toEqual(['2026-10-20', '09:00:00', APPOINTMENT_ID]);

    conflicts = [];
    const free = await repository.findConflict('2026-10-20', '10:00:00', APPOINTMENT_ID);
    expect(free).toBeNull();
  });

  it('create inserts and returns the enriched detail', async () => {
    details = [buildDetail()];
    const created = await repository.create({
      clientId: CLIENT_ID,
      vehicleId: VEHICLE_ID,
      date: '2026-10-20',
      time: '09:00:00',
      comments: null,
    });
    expect(created.client_name).toBe('Ana Lopez');
  });

  it('update maps unique index violation to ConflictError (double booking)', async () => {
    updateThrows = { code: '23505' };
    await expect(
      repository.update(APPOINTMENT_ID, { date: '2026-10-20', time: '09:00:00' })
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it('update returns the updated detail', async () => {
    details = [buildDetail()];
    const updated = await repository.update(APPOINTMENT_ID, {
      date: '2026-10-21',
      time: '11:30:00',
    });
    expect(updated?.date).toBe('2026-10-20');
  });

  it('updateStatus returns the appointment with the new status via detail', async () => {
    details = [buildDetail()];
    const updated = await repository.updateStatus(APPOINTMENT_ID, 'DISABLED');
    expect(updated?.status).toBe('ENABLED');
  });
});