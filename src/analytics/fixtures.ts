/**
 * Test fixtures for the analytics: a fixed "now" and terse builders, so each
 * scenario reads as a list of purchases rather than a wall of object literals.
 */
import { buildProduct } from '../db/catalog';
import { toLocalDate } from '../utils/products';
import type { Product, Purchase } from '../db/types';

/** Sunday 20 September 2026, noon, local time. */
export const NOW = new Date(2026, 8, 20, 12, 0, 0);

/** The local `YYYY-MM-DD` that was `n` days before `NOW`. */
export const daysAgo = (n: number): string => toLocalDate(new Date(2026, 8, 20 - n));

let sequence = 0;

export function makeProduct(id = 'milk', over: Partial<Product> = {}): Product {
  return {
    ...buildProduct({ name: id[0]!.toUpperCase() + id.slice(1) }, '2026-01-01T00:00:00.000Z'),
    id,
    nameKey: id,
    ...over,
  };
}

export interface BuyOptions {
  productId?: string;
  qty?: number;
  storeId?: string | null;
  confirmed?: boolean;
  source?: Purchase['source'];
  deletedAt?: string | null;
}

/**
 * A purchase `n` days before `NOW`. Priced purchases are confirmed by default,
 * because that is what counts; pass `confirmed: false` for a pre-filled guess.
 */
export function buy(n: number, price: number | null, options: BuyOptions = {}): Purchase {
  sequence += 1;
  const stamp = new Date(Date.UTC(2026, 0, 1, 0, 0, 0, sequence)).toISOString();
  return {
    id: `p${sequence}`,
    productId: options.productId ?? 'milk',
    itemId: null,
    listId: null,
    storeId: options.storeId ?? null,
    date: daysAgo(n),
    qty: options.qty ?? 1,
    price,
    confirmed: options.confirmed ?? price !== null,
    source: options.source ?? 'manual',
    createdAt: stamp,
    updatedAt: stamp,
    deletedAt: options.deletedAt ?? null,
  };
}

/**
 * Purchases spaced `interval` days apart, the newest `sinceLast` days ago —
 * enough (three dates) for a rhythm to exist.
 */
export function rhythm(interval: number, sinceLast: number, productId = 'milk'): Purchase[] {
  return [0, 1, 2].map(i => buy(sinceLast + i * interval, null, { productId }));
}
