import { ValidationError } from '../errors/AppError';
import { isValidIsoDate } from '../../shared/utils/datetime';

/** Value Object: appointment date in ISO format (YYYY-MM-DD). */
export class AppointmentDate {
  public readonly value: string;

  private constructor(value: string) {
    this.value = value;
  }

  public static create(rawValue: string): AppointmentDate {
    if (typeof rawValue !== 'string' || !isValidIsoDate(rawValue)) {
      throw new ValidationError('Field "date" must be a valid date with format YYYY-MM-DD', {
        field: 'date',
      });
    }

    return new AppointmentDate(rawValue);
  }

  public equals(other: AppointmentDate): boolean {
    return this.value === other.value;
  }

  toJSON(): string {
    return this.value;
  }
}