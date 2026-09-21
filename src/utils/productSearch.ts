/**
 * Finding a product from what someone typed.
 *
 * The add-item bar suggests products as you type, and picking one registers the
 * item against that exact product. That is what keeps "Milk", "milk" and
 * "Organic Valley milk" from becoming three separate catalog entries with three
 * separate price histories.
 */
import { isLive } from '../db/repo';
import { nameKey } from './products';
import type { Product } from '../db/types';

/** How many suggestions the dropdown shows. */
export const SEARCH_LIMIT = 8;
/** How many candidates an ambiguous name offers to choose between. */
export const AMBIGUOUS_OPTIONS = 5;

/** productId -> how many times it has been bought; used to break ties. */
export type Popularity = ReadonlyMap<string, number>;

/**
 * How well a product matches a query. Zero means it does not match.
 *
 * Every word typed must match *something* (the name, brand, size or barcode), in
 * any order, so "organic milk" finds "Milk — Organic Valley". A word at the start
 * of a name word beats one in the middle, which beats one only in the brand or
 * size; and the whole name matching, or starting with what was typed, beats all.
 */
export function scoreProduct(product: Product, query: string): number {
  const q = nameKey(query);
  if (!q) return 0;

  const name = nameKey(product.name);
  const nameWords = name.split(' ');
  const other = nameKey(`${product.brand} ${product.packageSize} ${product.barcode}`);

  let score = 0;
  for (const token of q.split(' ')) {
    if (nameWords.some(word => word.startsWith(token))) score += 3;
    else if (name.includes(token)) score += 2;
    else if (other.includes(token)) score += 1;
    else return 0;
  }

  if (name === q) score += 100;
  else if (name.startsWith(q)) score += 20;
  return score;
}

const rank = (popularity?: Popularity) => (
  a: { product: Product; score: number },
  b: { product: Product; score: number },
): number =>
  b.score - a.score
  || (popularity?.get(b.product.id) ?? 0) - (popularity?.get(a.product.id) ?? 0)
  || a.product.name.localeCompare(b.product.name);

export interface SearchOptions {
  limit?: number;
  popularity?: Popularity;
}

/** Live products matching `query`, best first. */
export function searchProducts(
  products: Product[],
  query: string,
  { limit = SEARCH_LIMIT, popularity }: SearchOptions = {},
): Product[] {
  return products
    .filter(isLive)
    .map(product => ({ product, score: scoreProduct(product, query) }))
    .filter(entry => entry.score > 0)
    .sort(rank(popularity))
    .slice(0, limit)
    .map(entry => entry.product);
}

export type Resolution =
  | { kind: 'match'; product: Product }
  /** Several products fit and nothing says which; the user has to choose. */
  | { kind: 'ambiguous'; options: Product[] }
  | { kind: 'missing' };

/**
 * Decides which product a name refers to when nobody is choosing from a list —
 * voice input, the "Add again" chips, or a comma-separated batch.
 *
 * An exact name wins outright (the most-bought one, if several brands share it).
 * Otherwise a partial name resolves only when exactly one product fits; several
 * fitting is *ambiguous*, not a guess, because guessing is how a list ends up
 * with the wrong brand and the wrong price history.
 */
export function resolveByName(
  products: Product[],
  name: string,
  popularity?: Popularity,
): Resolution {
  const key = nameKey(name);
  if (!key) return { kind: 'missing' };

  const live = products.filter(isLive);
  const exact = live
    .filter(product => product.nameKey === key)
    .map(product => ({ product, score: 100 }))
    .sort(rank(popularity));
  if (exact.length > 0) return { kind: 'match', product: exact[0]!.product };

  const found = searchProducts(live, name, { limit: AMBIGUOUS_OPTIONS + 1, popularity });
  if (found.length === 1) return { kind: 'match', product: found[0]! };
  if (found.length > 1) return { kind: 'ambiguous', options: found.slice(0, AMBIGUOUS_OPTIONS) };
  return { kind: 'missing' };
}

/** Purchases per product, including those from before tracking began. */
export function popularityOf(
  products: Product[],
  purchases: { productId: string }[],
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const product of products) counts.set(product.id, product.priorPurchases);
  for (const purchase of purchases) {
    counts.set(purchase.productId, (counts.get(purchase.productId) ?? 0) + 1);
  }
  return counts;
}
