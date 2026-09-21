/**
 * Price maths shared by the list operations and the analytics.
 *
 * Kept in one place because "what counts as a price" is a rule, and two copies
 * of a rule drift.
 */
import { isLive } from '../db/repo';
import type { Purchase } from '../db/types';

/**
 * The unit price a purchase contributes to price analytics, or `null` if it
 * contributes none.
 *
 * Only *confirmed* prices count. A price that was pre-filled from an estimate
 * and never confirmed is a guess, and letting guesses in would fill the history
 * with echoes of the last price — hiding exactly the changes the trend exists to
 * show.
 */
export function unitPriceOf(purchase: Purchase): number | null {
  if (!isLive(purchase)) return null;
  if (!purchase.confirmed || purchase.price === null) return null;
  if (!(purchase.qty > 0) || !Number.isFinite(purchase.price)) return null;
  return purchase.price / purchase.qty;
}

/** Newest first: by date, then by when the record was made. */
export function newestFirst(a: Purchase, b: Purchase): number {
  return b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt);
}

/** The most recent confirmed unit price for a product, or `null` if none. */
export function lastConfirmedUnitPrice(purchases: Purchase[]): number | null {
  for (const purchase of [...purchases].sort(newestFirst)) {
    const price = unitPriceOf(purchase);
    if (price !== null) return price;
  }
  return null;
}

/** Rounds a money amount to cents. */
export function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}
