import { describe, expect, it } from 'vitest';
import { Name } from '../../src/domain/value-objects/Name';
import { Address } from '../../src/domain/value-objects/Address';
import { Timezone } from '../../src/domain/value-objects/Timezone';
import { Vin } from '../../src/domain/value-objects/Vin';
import { LicensePlate } from '../../src/domain/value-objects/LicensePlate';
import { VehicleYear } from '../../src/domain/value-objects/VehicleYear';
import { AppointmentDate } from '../../src/domain/value-objects/AppointmentDate';
import { AppointmentTime } from '../../src/domain/value-objects/AppointmentTime';
import { Comments } from '../../src/domain/value-objects/Comments';
import { Appointment } from '../../src/domain/entities/Appointment';
import { ValidationError } from '../../src/domain/errors/AppError';

describe('Value Objects', () => {
  describe('Name', () => {
    it('normalizes whitespace and trims', () => {
      expect(Name.create('  Ana   Lopez  ').value).toBe('Ana Lopez');
    });
    it('rejects short values', () => {
      expect(() => Name.create('A')).toThrow(ValidationError);
    });
    it('rejects invalid characters', () => {
      expect(() => Name.create('Ana@Lopez')).toThrow(ValidationError);
    });
  });

  describe('Address', () => {
    it('accepts a valid address', () => {
      expect(Address.create('Calle 1 # 2-3, Bogota').value.length).toBeGreaterThan(0);
    });
    it('rejects very short addresses', () => {
      expect(() => Address.create('No')).toThrow(ValidationError);
    });
  });

  describe('Timezone', () => {
    it('accepts valid IANA zones', () => {
      expect(Timezone.create('America/Bogota').value).toBe('America/Bogota');
    });
    it('rejects non-existent zones', () => {
      expect(() => Timezone.create('No/Existe_Zone')).toThrow(ValidationError);
    });
  });

  describe('Vin', () => {
    it('normalizes to uppercase', () => {
      expect(Vin.create('1hgcm82633a004352').value).toBe('1HGCM82633A004352');
    });
    it('rejects VINs with the wrong length', () => {
      expect(() => Vin.create('ABC')).toThrow(ValidationError);
    });
    it('rejects the letters I, O and Q', () => {
      expect(() => Vin.create('OIQUGH82633A004352')).toThrow(ValidationError);
    });
  });

  describe('LicensePlate', () => {
    it('normalizes to uppercase without spaces', () => {
      expect(LicensePlate.create(' abc 123 ').value).toBe('ABC123');
    });
    it('rejects invalid formats', () => {
      expect(() => LicensePlate.create('###$$$')).toThrow(ValidationError);
    });
  });

  describe('VehicleYear', () => {
    it('accepts years within range', () => {
      expect(VehicleYear.create(2020).value).toBe(2020);
    });
    it('rejects years out of range', () => {
      expect(() => VehicleYear.create(1800)).toThrow(ValidationError);
      expect(() => VehicleYear.create(2200)).toThrow(ValidationError);
    });
    it('rejects non-integer values', () => {
      expect(() => VehicleYear.create(2020.5)).toThrow(ValidationError);
    });
  });

  describe('AppointmentDate / AppointmentTime', () => {
    it('accepts real ISO dates', () => {
      expect(AppointmentDate.create('2026-10-20').value).toBe('2026-10-20');
    });
    it('rejects impossible dates (Feb 31)', () => {
      expect(() => AppointmentDate.create('2026-02-31')).toThrow(ValidationError);
    });
    it('normalizes HH:MM to HH:MM:SS', () => {
      expect(AppointmentTime.create('09:00').value).toBe('09:00:00');
    });
    it('rejects invalid times', () => {
      expect(() => AppointmentTime.create('25:99')).toThrow(ValidationError);
    });
  });

  describe('Comments', () => {
    it('returns null for empty/absent', () => {
      expect(Comments.create(undefined).value).toBeNull();
      expect(Comments.create(null).value).toBeNull();
      expect(Comments.create('').value).toBeNull();
    });
    it('trims comments', () => {
      expect(Comments.create('  Cambio de aceite  ').value).toBe('Cambio de aceite');
    });
  });
});

describe('Appointment (entity)', () => {
  const base = {
    clientId: '11111111-1111-4111-8111-111111111111',
    vehicleId: '22222222-2222-4222-8222-222222222222',
    date: '2026-10-20',
    time: '09:00',
  };

  it('is created with ENABLED status', () => {
    const appointment = Appointment.create(base);
    expect(appointment.status).toBe('ENABLED');
    expect(appointment.time).toBe('09:00:00');
  });

  it('can only be cancelled via disable()', () => {
    const disabled = Appointment.create(base)
      .withIdentity('55555555-5555-4555-8555-555555555555')
      .disable();
    expect(disabled.status).toBe('DISABLED');
    expect(disabled.id).toBe('55555555-5555-4555-8555-555555555555');
    expect(disabled.isEnabled()).toBe(false);
  });

  it('reschedule changes date/time keeping the creation date', () => {
    const original = Appointment.create(base);
    const rescheduled = original.reschedule({ date: '2026-10-21', time: '11:30' });
    expect(rescheduled.date).toBe('2026-10-21');
    expect(rescheduled.time).toBe('11:30:00');
    expect(rescheduled.status).toBe('ENABLED');
  });

  it('fromRow rejects unknown statuses', () => {
    const row = {
      id: '55555555-5555-4555-8555-555555555555',
      client_id: base.clientId,
      vehicle_id: base.vehicleId,
      date: '2026-10-20',
      time: '09:00:00',
      comments: null,
      status: 'CANCELLED' as never,
      created_at: new Date(),
      updated_at: new Date(),
    };
    expect(() => Appointment.fromRow(row)).toThrow(ValidationError);
  });
});