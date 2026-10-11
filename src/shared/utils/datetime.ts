const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const TIME_REGEX = /^([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?$/;

/** Validates that a string is a real ISO date (YYYY-MM-DD), rejecting 2024-02-31. */
export function isValidIsoDate(value: string): boolean {
  if (typeof value !== 'string' || !ISO_DATE_REGEX.test(value)) return false;

  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

/** Normaliza "HH:MM" o "HH:MM:SS" a "HH:MM:SS". Devuelve null si es invalido. */
export function normalizeTime(value: string): string | null {
  if (typeof value !== 'string') return null;

  const match = TIME_REGEX.exec(value);
  if (!match) return null;

  return `${match[1]}:${match[2]}:${match[3] ?? '00'}`;
}
