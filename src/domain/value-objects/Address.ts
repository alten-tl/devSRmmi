import { ValidationError } from '../errors/AppError';
import {
  assertSafeString,
  collapseWhitespace,
  stripControlCharacters,
} from '../../shared/utils/sanitize';

const MIN_ADDRESS_LENGTH = 5;
const MAX_ADDRESS_LENGTH = 200;

/** Value Object: client physical address. */
export class Address {
  public readonly value: string;

  private constructor(value: string) {
    this.value = value;
  }

  public static create(rawValue: string): Address {
    if (typeof rawValue !== 'string') {
      throw new ValidationError('Field "address" must be a string', { field: 'address' });
    }

    const cleaned = collapseWhitespace(stripControlCharacters(rawValue));

    if (cleaned.length < MIN_ADDRESS_LENGTH) {
      throw new ValidationError(
        `Field "address" must have at least ${MIN_ADDRESS_LENGTH} characters`,
        { field: 'address' }
      );
    }

    assertSafeString(cleaned, 'address', MAX_ADDRESS_LENGTH);

    return new Address(cleaned);
  }

  public equals(other: Address): boolean {
    return this.value === other.value;
  }

  toJSON(): string {
    return this.value;
  }
}