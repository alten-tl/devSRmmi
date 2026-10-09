import { ValidationError } from '../errors/AppError';
import { normalizeTime } from '../../shared/utils/datetime';

/** Value Object: appointment time, normalized to HH:MM:SS. */
export class AppointmentTime {
  public readonly value: string;

  private constructor(value: string) {
    this.value = value;
  }

  public static create(rawValue: string): AppointmentTime {
    const normalized = typeof rawValue === 'string' ? normalizeTime(rawValue) : null;

    if (!normalized) {
      throw new ValidationError('Field "time" must be a valid time with format HH:MM or HH:MM:SS', {
        field: 'time',
      });
    }

    return new AppointmentTime(normalized);
  }

  public equals(other: AppointmentTime): boolean {
    return this.value === other.value;
  }

  toJSON(): string {
    return this.value;
  }
}