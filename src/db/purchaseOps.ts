/**
 * Operations on the purchase log.
 *
 * A purchase is corrected rather than rewritten: editing a price or store fixes
 * the record, and a mistake is voided (soft-deleted) so it drops out of every
 * total without vanishing from the database.
 */
import { db } from './schema';
import { newId, now } from './ids';
import { isLive } from './repo';
import { isValidDateOnly, toLocalDate } from '../utils/products';
import { roundMoney } from '../analytics/price';
import type { Purchase } from './types';

export class InvalidPurchaseError extends Error {
  override name = 'InvalidPurchaseError';
}

export interface PurchaseInput {
  date: string;
  qty: number;
  /** What was paid for the whole line, or `null` if unknown. */
  price: number | null;
  storeId: string | null;
}

/**
 * Checks and tidies a purchase the user entered.
 *
 * The form validates first for friendly messages; this is the backstop, so a
 * bad value cannot reach the log from anywhere else — a negative price or a
 * date in the future would quietly corrupt every trend and interval.
 */
export function normalizePurchaseInput(input: PurchaseInput, today: Date = new Date()): PurchaseInput {
  if (!isValidDateOnly(input.date)) {
    throw new InvalidPurchaseError('Enter a valid date.');
  }
  if (input.date > toLocalDate(today)) {
    throw new InvalidPurchaseError('A purchase cannot be in the future.');
  }
  if (!Number.isFinite(input.qty) || input.qty <= 0) {
    throw new InvalidPurchaseError('Quantity must be more than zero.');
  }
  if (input.price !== null && (!Number.isFinite(input.price) || input.price < 0)) {
    throw new InvalidPurchaseError('Price cannot be negative.');
  }
  return {
    date: input.date,
    qty: input.qty,
    price: input.price === null ? null : roundMoney(input.price),
    storeId: input.storeId,
  };
}

/** Logs a purchase by hand, e.g. from a receipt. Returns its id. */
export async function logPastPurchase(productId: string, input: PurchaseInput): Promise<string> {
  const clean = normalizePurchaseInput(input);
  const id = newId();
  const timestamp = now();

  await db.transaction('rw', db.products, db.purchases, async () => {
    const product = await db.products.get(productId);
    if (!product || !isLive(product)) throw new InvalidPurchaseError('That product no longer exists.');

    const purchase: Purchase = {
      id, productId, itemId: null, listId: null,
      storeId: clean.storeId, date: clean.date, qty: clean.qty, price: clean.price,
      // A price the user typed themselves is, by definition, confirmed.
      confirmed: clean.price !== null,
      source: 'manual', createdAt: timestamp, updatedAt: timestamp, deletedAt: null,
    };
    await db.purchases.put(purchase);
  });

  return id;
}

/**
 * Confirms (or corrects) the price of a purchase — the one-tap step after
 * ticking an item. Leaves the date and quantity alone.
 */
export async function confirmPurchase(
  id: string,
  { price, storeId }: { price: number; storeId?: string | null },
): Promise<void> {
  if (!Number.isFinite(price) || price < 0) {
    throw new InvalidPurchaseError('Price cannot be negative.');
  }
  await db.transaction('rw', db.purchases, async () => {
    const existing = await db.purchases.get(id);
    if (!existing || !isLive(existing)) return;
    await db.purchases.put({
      ...existing,
      price: roundMoney(price),
      confirmed: true,
      storeId: storeId === undefined ? existing.storeId : storeId,
      updatedAt: now(),
    });
  });
}

/** Edits a recorded purchase. Saving a price counts as confirming it. */
export async function updatePurchase(id: string, input: PurchaseInput): Promise<void> {
  const clean = normalizePurchaseInput(input);
  await db.transaction('rw', db.purchases, async () => {
    const existing = await db.purchases.get(id);
    if (!existing || !isLive(existing)) return;
    await db.purchases.put({
      ...existing,
      ...clean,
      confirmed: clean.price !== null,
      updatedAt: now(),
    });
  });
}

/** Voids a purchase. */
export async function removePurchase(id: string): Promise<void> {
  const timestamp = now();
  await db.purchases.update(id, { deletedAt: timestamp, updatedAt: timestamp });
}
