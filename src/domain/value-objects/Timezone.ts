import { ValidationError } from '../errors/AppError';
import { assertSafeString, stripControlCharacters } from '../../shared/utils/sanitize';

const MAX_TIMEZONE_LENGTH = 64;

/**
 * Value Object: IANA timezone. Validated against the platform (Intl) database
 * to guarantee it is a supported identifier.
 */
export class Timezone {
  public readonly value: string;

  private constructor(value: string) {
    this.value = value;
  }

  public static create(rawValue: string): Timezone {
    if (typeof rawValue !== 'string') {
      throw new ValidationError('Field "timezone" must be a string', { field: 'timezone' });
    }

    const cleaned = stripControlCharacters(rawValue).trim();
    assertSafeString(cleaned, 'timezone', MAX_TIMEZONE_LENGTH);

    try {
      // Throws RangeError if the zone identifier does not exist.
      new Intl.DateTimeFormat('en-US', { timeZone: cleaned });
    } catch {
      throw new ValidationError(
        'Field "timezone" must be a valid IANA timezone (e.g. America/Bogota)',
        { field: 'timezone' }
      );
    }

    return new Timezone(cleaned);
  }

  public equals(other: Timezone): boolean {
    return this.value === other.value;
  }

  toJSON(): string {
    return this.value;
  }
}