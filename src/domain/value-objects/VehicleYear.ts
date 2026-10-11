import { ValidationError } from '../errors/AppError';

const MIN_YEAR = 1900;
const YEAR_TOLERANCE = 1;

/** Value Object: vehicle year within a reasonable business range. */
export class VehicleYear {
  public readonly value: number;

  private constructor(value: number) {
    this.value = value;
  }

  public static create(rawValue: number | string): VehicleYear {
    const value = Number(rawValue);

    if (!Number.isInteger(value)) {
      throw new ValidationError('Field "year" must be an integer', { field: 'year' });
    }

    const maxYear = new Date().getUTCFullYear() + YEAR_TOLERANCE;
    if (value < MIN_YEAR || value > maxYear) {
      throw new ValidationError(`Field "year" must be between ${MIN_YEAR} and ${maxYear}`, {
        field: 'year',
      });
    }

    return new VehicleYear(value);
  }

  public equals(other: VehicleYear): boolean {
    return this.value === other.value;
  }

  toJSON(): number {
    return this.value;
  }
}