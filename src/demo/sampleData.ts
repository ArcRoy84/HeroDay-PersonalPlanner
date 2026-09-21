/**
 * Sample data for the Items section.
 *
 * On day one there is no purchase history, so every tile shows guidance and
 * every card says "No price yet". This fills the section with a believable few
 * months of shopping so the design — and the analytics — can be judged straight
 * away, and comes off again in one click.
 *
 * Everything is flagged `demo: true`, and removal deletes exactly the flagged
 * rows. That flag lives on the rows themselves (not in a side table) so it
 * survives a backup and restore: "Remove sample data" still works afterwards.
 *
 * The data is deterministic — same day in, same data out — and built relative to
 * "today", so there is always a purchase this month, something due now, and
 * something lapsed, whenever it is loaded.
 */
import { db } from '../db/schema';
import { isLive } from '../db/repo';
import { toLocalDate, nameKey } from '../utils/products';
import type { Product, Purchase, Store } from '../db/types';

const HISTORY_DAYS = 150;

interface StoreSpec { id: string; name: string; icon: string; categoryId: string; priceLevel: number }

const STORES: StoreSpec[] = [
  { id: 'demo-store-mart', name: 'Sample Mart', icon: '🛒', categoryId: 'supermarket', priceLevel: 1 },
  { id: 'demo-store-club', name: 'Sample Warehouse Club', icon: '📦', categoryId: 'warehouse', priceLevel: 0.9 },
  { id: 'demo-store-bakery', name: 'Sample Bakery', icon: '🥖', categoryId: 'bakery', priceLevel: 1.15 },
];

interface ProductSpec {
  name: string;
  category: string;
  brand: string;
  size: string;
  /** Price per unit at a store with price level 1. */
  base: number;
  /** Days between purchases. */
  every: number;
  /** Total change over the window: 0.12 is up 12% by the end. */
  drift: number;
  /** Stores it is bought at; the first is the usual one. */
  stores: string[];
  /** How many days ago it was last bought. */
  lastAgo: number;
  /** Bought this many times before tracking began. */
  prior?: number;
  /** The most recent price was pre-filled and never confirmed. */
  lastUnconfirmed?: boolean;
}

const MART = 'demo-store-mart';
const CLUB = 'demo-store-club';
const BAKERY = 'demo-store-bakery';

// Chosen so every feature has something to show: rises and falls, a record low,
// items due and overdue, one lapsed, two stores to compare, and a price that
// still needs checking.
const PRODUCTS: ProductSpec[] = [
  { name: 'Milk', category: 'dairy', brand: 'Organic Valley', size: '1 gal', base: 4.2, every: 7, drift: 0.12, stores: [MART, CLUB], lastAgo: 6 },
  { name: 'Eggs', category: 'dairy', brand: 'Happy Hens', size: '12 ct', base: 3.1, every: 9, drift: 0.25, stores: [MART], lastAgo: 10 },
  { name: 'Butter', category: 'dairy', brand: 'Kerrygold', size: '8 oz', base: 4.8, every: 21, drift: -0.1, stores: [MART, CLUB], lastAgo: 5 },
  { name: 'Sourdough bread', category: 'bakery', brand: '', size: 'loaf', base: 3.9, every: 6, drift: 0, stores: [BAKERY, MART], lastAgo: 2 },
  { name: 'Bananas', category: 'produce', brand: '', size: 'per lb', base: 0.59, every: 5, drift: 0.03, stores: [MART], lastAgo: 4 },
  { name: 'Chicken breast', category: 'meat', brand: '', size: 'per lb', base: 4.6, every: 14, drift: -0.24, stores: [MART, CLUB], lastAgo: 3 },
  { name: 'Olive oil', category: 'pantry', brand: 'Bertolli', size: '500 ml', base: 9.5, every: 40, drift: 0.08, stores: [MART, CLUB], lastAgo: 20 },
  { name: 'Coffee beans', category: 'beverages', brand: 'Peet’s', size: '12 oz', base: 8.75, every: 18, drift: 0.05, stores: [MART], lastAgo: 22 },
  { name: 'Rice', category: 'pantry', brand: '', size: '5 lb', base: 6.2, every: 45, drift: 0, stores: [CLUB], lastAgo: 30 },
  { name: 'Toilet paper', category: 'household', brand: '', size: '12 pack', base: 11.5, every: 30, drift: 0.04, stores: [CLUB, MART], lastAgo: 12 },
  { name: 'Laundry detergent', category: 'household', brand: 'Tide', size: '92 oz', base: 12, every: 50, drift: -0.05, stores: [CLUB], lastAgo: 68 },
  { name: 'Pasta', category: 'pantry', brand: 'Barilla', size: '16 oz', base: 1.79, every: 20, drift: 0, stores: [MART], lastAgo: 8 },
  { name: 'Orange juice', category: 'beverages', brand: 'Tropicana', size: '52 oz', base: 3.99, every: 10, drift: 0.02, stores: [MART], lastAgo: 1, lastUnconfirmed: true },
  { name: 'Frozen pizza', category: 'frozen', brand: '', size: '12 in', base: 6.5, every: 25, drift: 0, stores: [MART], lastAgo: 14, prior: 6 },
];

/** A small seeded random number generator, so the data is the same every time. */
function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const slug = (text: string): string => nameKey(text).replace(/[^a-z0-9]+/g, '-');

export interface SampleData {
  stores: Store[];
  products: Product[];
  purchases: Purchase[];
}

/**
 * Builds the sample rows for a given day. Pure, so it can be tested without a
 * database: the same `now` always yields the same data.
 */
export function buildSampleData(now: Date = new Date()): SampleData {
  const rng = mulberry32(20260920);
  const stamp = now.toISOString();
  const day = (daysAgo: number): string =>
    toLocalDate(new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysAgo));

  const stores: Store[] = STORES.map(s => ({
    id: s.id, name: s.name, icon: s.icon, logo: null, categoryId: s.categoryId,
    address: '', city: 'Sampleville', region: '', postalCode: '', country: '',
    lat: null, lon: null, hours: '', notes: 'Sample data — safe to remove.',
    createdAt: stamp, updatedAt: stamp, deletedAt: null, demo: true,
  }));
  const level = Object.fromEntries(STORES.map(s => [s.id, s.priceLevel]));

  const products: Product[] = [];
  const purchases: Purchase[] = [];

  for (const spec of PRODUCTS) {
    const id = `demo-product-${slug(spec.name)}`;
    products.push({
      id, name: spec.name, nameKey: nameKey(spec.name), category: spec.category,
      brand: spec.brand, packageSize: spec.size, barcode: '', photo: null,
      notes: '', priorPurchases: spec.prior ?? 0,
      createdAt: stamp, updatedAt: stamp, deletedAt: null, demo: true,
    });

    // Oldest first, ending `lastAgo` days ago.
    const count = Math.floor((HISTORY_DAYS - spec.lastAgo) / spec.every) + 1;
    for (let i = 0; i < count; i++) {
      const progress = count === 1 ? 1 : i / (count - 1);
      // A couple of days of jitter so the rhythm looks like a person's, not a clock's.
      const jitter = Math.round((rng() - 0.5) * 2);
      const daysAgo = Math.max(1, spec.lastAgo + (count - 1 - i) * spec.every + (i === count - 1 ? 0 : jitter));

      // Mostly the usual store, sometimes another.
      const storeId = rng() < 0.75 ? spec.stores[0]! : spec.stores[Math.floor(rng() * spec.stores.length)]!;
      const noise = 1 + (rng() - 0.5) * 0.04;
      const price = Math.round(spec.base * (1 + spec.drift * progress) * level[storeId]! * noise * 100) / 100;

      const isLast = i === count - 1;
      const unconfirmed = isLast && spec.lastUnconfirmed === true;
      purchases.push({
        id: `demo-purchase-${slug(spec.name)}-${i}`,
        productId: id, itemId: null, listId: null, storeId,
        date: day(daysAgo), qty: 1, price, confirmed: !unconfirmed,
        source: unconfirmed ? 'tick' : 'manual',
        createdAt: stamp, updatedAt: stamp, deletedAt: null, demo: true,
      });
    }
  }

  return { stores, products, purchases };
}

export interface SampleCounts { stores: number; products: number; purchases: number }

/** Writes the sample data. Ids are fixed, so loading twice does not duplicate it. */
export async function loadSampleData(now: Date = new Date()): Promise<SampleCounts> {
  const data = buildSampleData(now);
  await db.transaction('rw', db.stores, db.products, db.purchases, async () => {
    await db.stores.bulkPut(data.stores);
    await db.products.bulkPut(data.products);
    await db.purchases.bulkPut(data.purchases);
  });
  return {
    stores: data.stores.length,
    products: data.products.length,
    purchases: data.purchases.length,
  };
}

/** True when any sample row exists. */
export async function hasSampleData(): Promise<boolean> {
  return (await db.products.filter(p => p.demo === true).count()) > 0;
}

/**
 * Removes the sample data and nothing else.
 *
 * Sample rows are deleted outright rather than soft-deleted: they were never the
 * user's, so there is nothing to sync or restore. Real rows that came to point at
 * a sample row — a list linked to a sample store, a purchase the user gave a
 * sample store, an item on a list that was added from a sample product — are
 * detached, not deleted, so the user's own data survives intact.
 */
export async function removeSampleData(): Promise<SampleCounts> {
  const tables = [db.stores, db.products, db.purchases, db.shoppingItems, db.shoppingLists];
  return db.transaction('rw', tables, async () => {
    const stores = await db.stores.filter(s => s.demo === true).toArray();
    const products = await db.products.filter(p => p.demo === true).toArray();
    const purchases = await db.purchases.filter(p => p.demo === true).toArray();
    const storeIds = new Set(stores.map(s => s.id));
    const productIds = new Set(products.map(p => p.id));
    const timestamp = new Date().toISOString();

    const items = (await db.shoppingItems.toArray())
      .filter(i => i.productId !== null && productIds.has(i.productId));
    await db.shoppingItems.bulkPut(items.map(i => ({ ...i, productId: null, updatedAt: timestamp })));

    const lists = (await db.shoppingLists.toArray())
      .filter(l => l.storeId !== null && storeIds.has(l.storeId));
    await db.shoppingLists.bulkPut(lists.map(l => ({ ...l, storeId: null, updatedAt: timestamp })));

    const real = (await db.purchases.toArray())
      .filter(p => p.demo !== true && isLive(p) && p.storeId !== null && storeIds.has(p.storeId));
    await db.purchases.bulkPut(real.map(p => ({ ...p, storeId: null, updatedAt: timestamp })));

    await db.purchases.bulkDelete(purchases.map(p => p.id));
    await db.products.bulkDelete(products.map(p => p.id));
    await db.stores.bulkDelete(stores.map(s => s.id));

    return { stores: stores.length, products: products.length, purchases: purchases.length };
  });
}
