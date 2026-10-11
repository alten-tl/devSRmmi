import { ValidationError } from '../errors/AppError';
import { stripControlCharacters } from '../../shared/utils/sanitize';

const MAX_COMMENT_LENGTH = 500;

/**
 * Value Object: optional appointment comments. Accepts null/undefined.
 * Regular punctuation is allowed, but control characters are stripped and the
 * length is limited.
 */
export class Comments {
  public readonly value: string | null;

  private constructor(value: string | null) {
    this.value = value;
  }

  public static create(rawValue: string | null | undefined): Comments {
    if (rawValue === undefined || rawValue === null || rawValue === '') {
      return new Comments(null);
    }

    if (typeof rawValue !== 'string') {
      throw new ValidationError('Field "comments" must be a string', { field: 'comments' });
    }

    const cleaned = stripControlCharacters(rawValue).trim();

    if (cleaned.length > MAX_COMMENT_LENGTH) {
      throw new ValidationError(
        `Field "comments" exceeds the maximum length of ${MAX_COMMENT_LENGTH}`,
        { field: 'comments' }
      );
    }

    return new Comments(cleaned.length === 0 ? null : cleaned);
  }

  public equals(other: Comments): boolean {
    return this.value === other.value;
  }

  toJSON(): string | null {
    return this.value;
  }
}