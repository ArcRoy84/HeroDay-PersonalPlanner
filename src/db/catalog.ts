/**
 * The product catalog: matching list items to products, and carrying the old
 * per-name purchase history across.
 *
 * Written against a minimal table interface rather than `HeroDayDB`, because it
 * has to run in three different places: inside the schema upgrade (where only a
 * transaction's `tx.table(...)` exists), after the one-time localStorage
 * migration, and after restoring an older backup.
 */
import { newId, now } from './ids';
import { isLive } from './repo';
import { nameKey, toLocalDate } from '../utils/products';
import type { HeroDayDB } from './schema';
import type { Product, Purchase, ShoppingItem, ShoppingHistoryEntry } from './types';

/**
 * The part of a Dexie table the catalog code uses. Declared with method syntax
 * so `db.shoppingItems` (whose insert type is looser) and `tx.table('x')` both
 * satisfy it.
 */
export interface Rows<T> {
  toArray(): Promise<T[]>;
  put(row: T): Promise<unknown>;
  bulkPut(rows: T[]): Promise<unknown>;
}

export interface CatalogTables {
  history: Rows<ShoppingHistoryEntry>;
  items: Rows<ShoppingItem>;
  products: Rows<Product>;
  purchases: Rows<Purchase>;
}

export function catalogTablesOf(db: HeroDayDB): CatalogTables {
  return {
    history: db.shoppingHistory,
    items: db.shoppingItems,
    products: db.products,
    purchases: db.purchases,
  };
}

/** What identifies a product when a list item is matched to one. */
export interface ProductLookup {
  name: string;
  barcode?: string;
}

export interface ProductFields extends ProductLookup {
  category?: string;
  brand?: string;
  packageSize?: string;
}

export function buildProduct(fields: ProductFields, timestamp: string): Product {
  return {
    id: newId(),
    name: fields.name.trim(),
    nameKey: nameKey(fields.name),
    category: fields.category || 'other',
    brand: fields.brand?.trim() ?? '',
    packageSize: fields.packageSize?.trim() ?? '',
    barcode: fields.barcode?.trim() ?? '',
    photo: null,
    notes: '',
    priorPurchases: 0,
    createdAt: timestamp,
    updatedAt: timestamp,
    deletedAt: null,
  };
}

/**
 * Finds the live product a name (or barcode) refers to.
 *
 * A barcode is the strongest signal, since it names one exact product. Names are
 * looser: "Milk" can be several products (different brands or sizes), so the
 * oldest is chosen — a stable rule, and the one most likely to carry history.
 */
export function matchProduct(products: Product[], lookup: ProductLookup): Product | undefined {
  const live = products.filter(isLive);

  const barcode = lookup.barcode?.trim();
  if (barcode) {
    const byBarcode = live.find(p => p.barcode === barcode);
    if (byBarcode) return byBarcode;
  }

  const key = nameKey(lookup.name);
  if (!key) return undefined;
  return live
    .filter(p => p.nameKey === key)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))[0];
}

/**
 * Returns the product for `fields`, creating it if none matches.
 *
 * Every list item gets a product this way, so the catalog grows as lists do and
 * the Items section is never missing something that is on a list.
 */
export async function resolveProduct(
  products: Rows<Product>,
  fields: ProductFields,
  timestamp: string = now(),
): Promise<Product> {
  const existing = matchProduct(await products.toArray(), fields);

  if (existing) {
    // A scan can teach a product its barcode after the fact.
    const barcode = fields.barcode?.trim();
    if (barcode && !existing.barcode) {
      const updated = { ...existing, barcode, updatedAt: timestamp };
      await products.put(updated);
      return updated;
    }
    return existing;
  }

  const created = buildProduct(fields, timestamp);
  await products.put(created);
  return created;
}

/**
 * Turns the old per-name history into products, each with one dated "legacy"
 * purchase, and returns how many products it created.
 *
 * The old history held a count and only the *last* date, so the earlier
 * purchases have no dates and cannot become records; they are kept as
 * `priorPurchases` so the total still reads correctly. No price is carried: the
 * old price was frozen from the first purchase and never updated, so treating it
 * as a real price would poison every trend.
 *
 * Skips any name that already has a product (live *or* deleted). That is what
 * makes this safe to run more than once — and stops a product the user deleted
 * from being resurrected from history.
 */
export async function seedCatalogFromHistory(t: CatalogTables): Promise<number> {
  const [history, products] = await Promise.all([t.history.toArray(), t.products.toArray()]);
  const known = new Set(products.map(p => p.nameKey));

  const newProducts: Product[] = [];
  const newPurchases: Purchase[] = [];

  for (const entry of history.filter(isLive)) {
    const key = nameKey(entry.name);
    if (!key || known.has(key)) continue;
    known.add(key);

    const product: Product = {
      ...buildProduct(
        { name: entry.name, category: entry.category, barcode: entry.barcode },
        entry.lastBought,
      ),
      priorPurchases: Math.max(0, entry.count - 1),
    };
    newProducts.push(product);

    newPurchases.push({
      id: newId(),
      productId: product.id,
      itemId: null,
      listId: null,
      storeId: null,
      date: toLocalDate(new Date(entry.lastBought)),
      qty: 1,
      price: null,
      confirmed: false,
      source: 'legacy',
      createdAt: entry.lastBought,
      updatedAt: entry.lastBought,
      deletedAt: null,
    });
  }

  if (newProducts.length) {
    await t.products.bulkPut(newProducts);
    await t.purchases.bulkPut(newPurchases);
  }
  return newProducts.length;
}

/**
 * Gives every live list item a product, and returns how many were linked.
 *
 * Only ever touches items that are on a list right now, so it cannot bring back
 * something the user removed: an item that is still on a list should be in the
 * catalog. Safe to run on every boot.
 */
export async function linkItemsToProducts(t: CatalogTables): Promise<number> {
  const [items, products] = await Promise.all([t.items.toArray(), t.products.toArray()]);
  const unlinked = items.filter(i => isLive(i) && !i.productId);
  if (unlinked.length === 0) return 0;

  const timestamp = now();
  const pool = [...products];
  const created: Product[] = [];

  const linked = unlinked.map(item => {
    let product = matchProduct(pool, { name: item.name, barcode: item.barcode });
    if (!product) {
      product = buildProduct(
        { name: item.name, category: item.category, barcode: item.barcode },
        timestamp,
      );
      pool.push(product);
      created.push(product);
    }
    return { ...item, productId: product.id, updatedAt: timestamp };
  });

  if (created.length) await t.products.bulkPut(created);
  await t.items.bulkPut(linked);
  return linked.length;
}

export interface ReconcileOptions {
  /** True when history has not been turned into products yet. */
  seedLegacy: boolean;
}

/** Runs the catalog repairs in one transaction. */
export async function reconcileCatalog(db: HeroDayDB, options: ReconcileOptions): Promise<void> {
  await db.transaction(
    'rw', db.shoppingHistory, db.shoppingItems, db.products, db.purchases,
    async () => {
      const tables = catalogTablesOf(db);
      if (options.seedLegacy) await seedCatalogFromHistory(tables);
      await linkItemsToProducts(tables);
    },
  );
}
