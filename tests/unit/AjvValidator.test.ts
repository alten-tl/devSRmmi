import { describe, expect, it } from 'vitest';
import { AjvValidator } from '../../src/infrastructure/validators/AjvValidator';
import { ValidationError } from '../../src/domain/errors/AppError';

const validator = new AjvValidator();

const CLIENT_ID = '11111111-1111-4111-8111-111111111111';
const VEHICLE_ID = '22222222-2222-4222-8222-222222222222';

describe('AjvValidator', () => {
  describe('validateCreateClient', () => {
    const valid = { name: 'Ana Lopez', timezone: 'America/Bogota', address: 'Calle 1 # 2-3' };

    it('accepts a valid client', () => {
      const result = validator.validateCreateClient(valid);
      expect(result.isValid).toBe(true);
    });

    it('rejects additional fields (mass assignment)', () => {
      expect(validator.validateCreateClient({ ...valid, role: 'admin' }).isValid).toBe(false);
    });

    it('rejects strings with SQL metacharacters', () => {
      const result = validator.validateCreateClient({ ...valid, name: "Ana'; DROP TABLE clients; --" });
      expect(result.isValid).toBe(false);
      expect(result.issues[0].field).toBe('name');
    });

    it('rejects non-existent timezones by pattern', () => {
      expect(validator.validateCreateClient({ ...valid, timezone: 'Not/A_Zone!!' }).isValid).toBe(false);
    });
  });

  describe('validateCreateVehicle', () => {
    const valid = {
      clientId: CLIENT_ID,
      vin: '1HGCM82633A004352',
      licensePlate: 'ABC123',
      color: 'Rojo',
      year: 2020,
      model: 'Civic',
    };

    it('accepts a valid vehicle', () => {
      expect(validator.validateCreateVehicle(valid).isValid).toBe(true);
    });

    it('rejects invalid VIN and invalid license plate', () => {
      expect(validator.validateCreateVehicle({ ...valid, vin: 'ABC' }).isValid).toBe(false);
      expect(validator.validateCreateVehicle({ ...valid, licensePlate: '$$$' }).isValid).toBe(false);
    });

    it('rejects out-of-range years and non-integer types', () => {
      expect(validator.validateCreateVehicle({ ...valid, year: 2200 }).isValid).toBe(false);
      expect(validator.validateCreateVehicle({ ...valid, year: '2020' }).isValid).toBe(false);
    });

    it('rejects non-UUID client ids', () => {
      expect(validator.validateCreateVehicle({ ...valid, clientId: 'no-uuid' }).isValid).toBe(false);
    });
  });

  describe('validateCreateAppointment', () => {
    const valid = {
      clientId: CLIENT_ID,
      vehicleId: VEHICLE_ID,
      date: '2026-10-20',
      time: '09:00:00',
    };

    it('accepts a valid appointment', () => {
      expect(validator.validateCreateAppointment(valid).isValid).toBe(true);
    });

    it('accepts empty comments', () => {
      expect(validator.validateCreateAppointment({ ...valid, comments: 'Cambio de aceite' }).isValid).toBe(
        true
      );
      expect(validator.validateCreateAppointment({ ...valid, comments: null }).isValid).toBe(true);
    });

    it('rejects invalid date and time', () => {
      expect(validator.validateCreateAppointment({ ...valid, date: '20/10/2026' }).isValid).toBe(false);
      expect(validator.validateCreateAppointment({ ...valid, time: '25:99' }).isValid).toBe(false);
    });

    it('rejects additional fields', () => {
      expect(validator.validateCreateAppointment({ ...valid, status: 'ENABLED' }).isValid).toBe(false);
    });
  });

  describe('validateUpdateAppointment', () => {
    it('requires date and time', () => {
      expect(validator.validateUpdateAppointment({ date: '2026-10-21', time: '10:00' }).isValid).toBe(true);
      expect(validator.validateUpdateAppointment({ date: '2026-10-21' }).isValid).toBe(false);
      expect(validator.validateUpdateAppointment({}).isValid).toBe(false);
    });
  });

  describe('validateListAppointmentsQuery', () => {
    it('requires a valid date', () => {
      expect(validator.validateListAppointmentsQuery({ date: '2026-10-20' }).isValid).toBe(true);
      expect(validator.validateListAppointmentsQuery({ date: 'yesterday' }).isValid).toBe(false);
      expect(validator.validateListAppointmentsQuery({}).isValid).toBe(false);
    });
  });

  describe('validateId', () => {
    it('accepts a valid UUID', () => {
      expect(validator.validateId(CLIENT_ID)).toBe(CLIENT_ID);
    });

    it('rejects invalid UUIDs and injection payloads', () => {
      expect(() => validator.validateId('123')).toThrow(ValidationError);
      expect(() => validator.validateId("' OR '1'='1")).toThrow(ValidationError);
      expect(() => validator.validateId('11111111-1111-4111-8111-111111111111; DROP TABLE appointments--')).toThrow(
        ValidationError
      );
    });
  });
});