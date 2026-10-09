import { ValidationError } from '../errors/AppError';
import { stripControlCharacters } from '../../shared/utils/sanitize';

const LICENSE_PLATE_REGEX = /^[A-Z0-9]{2,4}-?[A-Z0-9]{2,4}$/;

/** Value Object: vehicle license plate, normalized to uppercase. */
export class LicensePlate {
  public readonly value: string;

  private constructor(value: string) {
    this.value = value;
  }

  public static create(rawValue: string): LicensePlate {
    if (typeof rawValue !== 'string') {
      throw new ValidationError('Field "licensePlate" must be a string', { field: 'licensePlate' });
    }

    const cleaned = stripControlCharacters(rawValue).trim().toUpperCase().replace(/\s+/g, '');

    if (!LICENSE_PLATE_REGEX.test(cleaned)) {
      throw new ValidationError('Field "licensePlate" has an invalid format', { field: 'licensePlate' });
    }

    return new LicensePlate(cleaned);
  }

  public equals(other: LicensePlate): boolean {
    return this.value === other.value;
  }

  toJSON(): string {
    return this.value;
  }
}