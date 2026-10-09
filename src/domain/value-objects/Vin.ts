import { ValidationError } from '../errors/AppError';
import { stripControlCharacters } from '../../shared/utils/sanitize';

/** The VIN standard forbids the letters I, O and Q to avoid ambiguity. */
const VIN_REGEX = /^[A-HJ-NPR-Z0-9]{17}$/;

/** Value Object: Vehicle Identification Number (VIN). */
export class Vin {
  public readonly value: string;

  private constructor(value: string) {
    this.value = value;
  }

  public static create(rawValue: string): Vin {
    if (typeof rawValue !== 'string') {
      throw new ValidationError('Field "vin" must be a string', { field: 'vin' });
    }

    const cleaned = stripControlCharacters(rawValue).trim().toUpperCase();

    if (!VIN_REGEX.test(cleaned)) {
      throw new ValidationError(
        'Field "vin" must be 17 alphanumeric characters (I, O and Q are not allowed)',
        { field: 'vin' }
      );
    }

    return new Vin(cleaned);
  }

  public equals(other: Vin): boolean {
    return this.value === other.value;
  }

  toJSON(): string {
    return this.value;
  }
}