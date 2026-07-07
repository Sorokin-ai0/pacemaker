/** Calendar-date helpers. All calendar dates are stored/handled as UTC midnight. */

export const DAY_MS = 86_400_000;

/** Truncate any Date to UTC midnight of the same UTC calendar day. */
export function utcMidnight(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

/** Add n calendar days (UTC has no DST, so plain millisecond math is exact). */
export function addDays(d: Date, n: number): Date {
  return new Date(d.getTime() + n * DAY_MS);
}

/** Whole days from a to b (both UTC midnight). Positive when b is after a. */
export function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / DAY_MS);
}

/** Format a UTC-midnight Date as "YYYY-MM-DD". */
export function toDateString(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Parse a "YYYY-MM-DD" string to a UTC-midnight Date.
 * Returns null for malformed or impossible calendar dates (e.g. 2026-02-31).
 */
export function parseDateString(s: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = new Date(`${s}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime()) || toDateString(d) !== s) return null;
  return d;
}

/** Round a distance to 0.1 km. */
export function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
