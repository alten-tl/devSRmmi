import { ValidationError } from '../errors/AppError';
import {
  assertSafeString,
  collapseWhitespace,
  stripControlCharacters,
} from '../../shared/utils/sanitize';

const MIN_NAME_LENGTH = 2;
const MAX_NAME_LENGTH = 100;
const NAME_PATTERN = /^[A-Za-zÀ-ÿ0-9'.\- ]+$/;

/** Value Object: person/business name, validated and normalized. */
export class Name {
  public readonly value: string;

  private constructor(value: string) {
    this.value = value;
  }

  public static create(rawValue: string): Name {
    if (typeof rawValue !== 'string') {
      throw new ValidationError('Field "name" must be a string', { field: 'name' });
    }

    const cleaned = collapseWhitespace(stripControlCharacters(rawValue));

    if (cleaned.length < MIN_NAME_LENGTH) {
      throw new ValidationError(
        `Field "name" must have at least ${MIN_NAME_LENGTH} characters`,
        { field: 'name' }
      );
    }
    if (!NAME_PATTERN.test(cleaned)) {
      throw new ValidationError('Field "name" contains invalid characters', { field: 'name' });
    }

    assertSafeString(cleaned, 'name', MAX_NAME_LENGTH);

    return new Name(cleaned);
  }

  public equals(other: Name): boolean {
    return this.value === other.value;
  }

  toJSON(): string {
    return this.value;
  }
}