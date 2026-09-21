/**
 * Pure helpers for products and purchase dates.
 */

/**
 * Normalises a product name for matching: "  Whole   MILK " -> "whole milk".
 * Stored on each product as `nameKey` so a list item can find its product by
 * index instead of scanning.
 */
export function nameKey(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

const pad = (n: number): string => String(n).padStart(2, '0');

/**
 * A date as `YYYY-MM-DD` in the *local* time zone.
 *
 * Purchases use local days on purpose. `toISOString().slice(0, 10)` is the UTC
 * day, which for anyone west of Greenwich flips to "tomorrow" in the evening —
 * a 7 pm shop would be recorded on the wrong date and skew every interval.
 */
export function toLocalDate(date: Date = new Date()): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** True for a real calendar date written as `YYYY-MM-DD`. */
export function isValidDateOnly(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number) as [number, number, number];
  const parsed = new Date(y, m - 1, d);
  // Rejects 2026-02-30, which `new Date` would otherwise roll into March.
  return parsed.getFullYear() === y && parsed.getMonth() === m - 1 && parsed.getDate() === d;
}

/** Local midnight of a `YYYY-MM-DD` day. */
export function parseDateOnly(value: string): Date {
  const [y, m, d] = value.split('-').map(Number) as [number, number, number];
  return new Date(y, m - 1, d);
}

/**
 * Whole days from `from` (a `YYYY-MM-DD` day) to `to`'s local day.
 * Negative when `from` is in the future. Rounded, so a daylight-saving change
 * cannot turn "1 day" into 0 or 2.
 */
export function daysBetween(from: string, to: Date = new Date()): number {
  const start = parseDateOnly(from).getTime();
  const end = parseDateOnly(toLocalDate(to)).getTime();
  return Math.round((end - start) / 86_400_000);
}

/** `YYYY-MM` of a `YYYY-MM-DD` day. */
export function monthOf(date: string): string {
  return date.slice(0, 7);
}

/** The month before `YYYY-MM`. */
export function previousMonth(month: string): string {
  const [y, m] = month.split('-').map(Number) as [number, number];
  const d = new Date(y, m - 2, 1);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}

/** Median of a list of numbers, or `null` when empty. */
export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

/** Arithmetic mean, or `null` when empty. */
export function mean(values: number[]): number | null {
  return values.length === 0 ? null : values.reduce((a, b) => a + b, 0) / values.length;
}
