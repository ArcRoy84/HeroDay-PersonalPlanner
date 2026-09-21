/**
 * Display formatting for money, percentages and dates.
 *
 * The app shows dollars everywhere today, so this does too. Currency is one place
 * to change later (see `usd` below) rather than a symbol scattered through every
 * view.
 */
import { daysBetween, parseDateOnly } from './products';

const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

/** `$4.29`, `$1,284.50`, or an em dash when there is no amount. */
export function money(amount: number | null | undefined): string {
  if (amount === null || amount === undefined || !Number.isFinite(amount)) return '—';
  // Avoids "-$0.00" for a tiny negative left over from float arithmetic.
  return usd.format(Math.abs(amount) < 0.005 ? 0 : amount);
}

/**
 * Reads a price typed into a form. Empty means "no price" (`null`); anything
 * that is not a plain non-negative amount is `NaN`, so the caller can tell
 * "left blank" from "typed something wrong". A leading dollar sign and thousands
 * commas are forgiven, since people type them.
 */
export function parseMoneyInput(text: string): number | null {
  // Only a genuinely empty field means "no price". A lone dollar sign is someone
  // who started typing, not someone who chose to leave it blank.
  if (text.trim() === '') return null;
  const cleaned = text.trim().replace(/^\$/, '').replace(/,/g, '').trim();
  if (!/^\d*\.?\d+$|^\d+\.$/.test(cleaned)) return NaN;
  const value = Number(cleaned);
  return Number.isFinite(value) ? value : NaN;
}

/**
 * A signed percentage with a true minus sign: `+5%`, `−10%`, `+2.3%`, `0%`.
 * Whole numbers drop the decimal; anything else keeps one.
 */
export function signedPct(pct: number): string {
  const rounded = Math.round(pct * 10) / 10;
  if (rounded === 0) return '0%';
  const magnitude = Math.abs(rounded);
  const body = Number.isInteger(magnitude) ? String(magnitude) : magnitude.toFixed(1);
  return `${rounded > 0 ? '+' : '−'}${body}%`;
}

/** `Sep 17`, or `Sep 17, 2025` when it is not this year. */
export function shortDate(date: string, now: Date = new Date()): string {
  const d = parseDateOnly(date);
  const sameYear = d.getFullYear() === now.getFullYear();
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    ...(sameYear ? {} : { year: 'numeric' }),
  });
}

/**
 * How long ago a purchase was: `Today`, `Yesterday`, `4 days ago`, and beyond
 * two weeks the date itself — "37 days ago" makes you do the maths.
 */
export function lastPurchasedLabel(date: string, now: Date = new Date()): string {
  const days = daysBetween(date, now);
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 14) return `${days} days ago`;
  return shortDate(date, now);
}

/** `every 12 days`, `every week`. */
export function intervalLabel(days: number): string {
  const n = Math.round(days);
  if (n <= 1) return 'every day';
  if (n === 7) return 'every week';
  if (n === 14) return 'every 2 weeks';
  return `every ${n} days`;
}

/** `1 item`, `3 items`. */
export function plural(count: number, one: string, many: string = `${one}s`): string {
  return `${count} ${count === 1 ? one : many}`;
}
