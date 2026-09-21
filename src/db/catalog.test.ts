import { describe, it, expect, beforeEach } from 'vitest';
import { db } from './schema';
import {
  matchProduct, resolveProduct, buildProduct, seedCatalogFromHistory,
  linkItemsToProducts, catalogTablesOf, reconcileCatalog,
} from './catalog';
import { toLocalDate } from '../utils/products';
import type { Product, ShoppingItem, ShoppingHistoryEntry } from './types';

const ts = '2026-09-10T15:00:00.000Z';

const product = (over: Partial<Product> = {}): Product => ({
  ...buildProduct({ name: 'Milk' }, ts), ...over,
});

const item = (id: string, name: string, over: Partial<ShoppingItem> = {}): ShoppingItem => ({
  id, listId: 'l1', name, qty: 1, unit: '', category: 'dairy', storeLocation: '', note: '',
  estimatedPrice: null, barcode: '', productId: null, checked: false,
  addedAt: ts, updatedAt: ts, deletedAt: null, ...over,
});

const entry = (name: string, over: Partial<ShoppingHistoryEntry> = {}): ShoppingHistoryEntry => ({
  name, unit: '', category: 'dairy', estimatedPrice: 3.5, barcode: '', count: 5,
  lastBought: ts, updatedAt: ts, deletedAt: null, ...over,
});

beforeEach(async () => {
  await db.open();
  await Promise.all(db.tables.map(t => t.clear()));
});

describe('matchProduct', () => {
  it('matches by name, ignoring case and spacing', () => {
    const milk = product({ name: 'Whole Milk', nameKey: 'whole milk' });
    expect(matchProduct([milk], { name: '  WHOLE   milk ' })).toBe(milk);
  });

  it('prefers a barcode over a name', () => {
    const plain = product({ id: 'a', name: 'Milk', nameKey: 'milk', createdAt: '2026-01-01T00:00:00Z' });
    const scanned = product({ id: 'b', name: 'Organic Milk', nameKey: 'organic milk', barcode: '0123' });
    expect(matchProduct([plain, scanned], { name: 'Milk', barcode: '0123' })?.id).toBe('b');
  });

  it('picks the oldest of several products sharing a name', () => {
    const newer = product({ id: 'new', createdAt: '2026-05-01T00:00:00Z' });
    const older = product({ id: 'old', createdAt: '2026-01-01T00:00:00Z' });
    expect(matchProduct([newer, older], { name: 'Milk' })?.id).toBe('old');
  });

  it('ignores deleted products and blank names', () => {
    const gone = product({ deletedAt: ts });
    expect(matchProduct([gone], { name: 'Milk' })).toBeUndefined();
    expect(matchProduct([product()], { name: '   ' })).toBeUndefined();
  });
});

describe('resolveProduct', () => {
  it('creates a product when none matches, and returns it again next time', async () => {
    const first = await resolveProduct(db.products, { name: 'Eggs', category: 'dairy' });
    const second = await resolveProduct(db.products, { name: 'eggs' });

    expect(second.id).toBe(first.id);
    expect(await db.products.count()).toBe(1);
    expect(first.category).toBe('dairy');
  });

  it('teaches an existing product its barcode', async () => {
    const first = await resolveProduct(db.products, { name: 'Eggs' });
    await resolveProduct(db.products, { name: 'Eggs', barcode: '9999' });

    expect((await db.products.get(first.id))?.barcode).toBe('9999');
  });
});

describe('resolveProduct with details from a scan', () => {
  const PHOTO = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQ==';

  it('creates a product with the brand, size and photo it was given', async () => {
    const created = await resolveProduct(db.products, {
      name: 'Nutella', brand: 'Ferrero', packageSize: '400 g', barcode: '301', photo: PHOTO,
    });

    expect(created.brand).toBe('Ferrero');
    expect(created.packageSize).toBe('400 g');
    expect(created.photo).toBe(PHOTO);
  });

  it('leaves an existing product exactly as it was', async () => {
    const first = await resolveProduct(db.products, { name: 'Nutella', brand: 'Original' });

    const again = await resolveProduct(db.products, { name: 'Nutella', brand: 'Different', photo: PHOTO });

    expect(again.id).toBe(first.id);
    expect(again.brand).toBe('Original');
    expect(again.photo).toBeNull();
  });

  it('drops a photo that is not an inline image', async () => {
    const created = await resolveProduct(db.products, { name: 'X', photo: 'https://evil.example/p.png' });
    expect(created.photo).toBeNull();
  });
});

describe('seedCatalogFromHistory', () => {
  it('turns each history entry into a product with one dated legacy purchase', async () => {
    await db.shoppingHistory.put(entry('Milk', { count: 5, lastBought: '2026-09-10T15:00:00.000Z' }));

    const created = await seedCatalogFromHistory(catalogTablesOf(db));

    expect(created).toBe(1);
    const [milk] = await db.products.toArray();
    expect(milk?.name).toBe('Milk');
    // Four earlier purchases had no dates, so they are a count, not records.
    expect(milk?.priorPurchases).toBe(4);

    const [legacy] = await db.purchases.toArray();
    expect(legacy?.source).toBe('legacy');
    expect(legacy?.productId).toBe(milk?.id);
    expect(legacy?.date).toBe(toLocalDate(new Date('2026-09-10T15:00:00.000Z')));
  });

  it('does not carry the old frozen price forward', async () => {
    // The old history kept the price from the *first* purchase and never updated
    // it, so it is not a real price and must not seed the analytics.
    await db.shoppingHistory.put(entry('Milk', { estimatedPrice: 3.5 }));

    await seedCatalogFromHistory(catalogTablesOf(db));

    const [legacy] = await db.purchases.toArray();
    expect(legacy?.price).toBeNull();
    expect(legacy?.confirmed).toBe(false);
  });

  it('is idempotent', async () => {
    await db.shoppingHistory.put(entry('Milk'));

    await seedCatalogFromHistory(catalogTablesOf(db));
    const again = await seedCatalogFromHistory(catalogTablesOf(db));

    expect(again).toBe(0);
    expect(await db.products.count()).toBe(1);
    expect(await db.purchases.count()).toBe(1);
  });

  it('does not resurrect a product the user deleted', async () => {
    await db.shoppingHistory.put(entry('Milk'));
    await db.products.put(product({ deletedAt: ts }));

    const created = await seedCatalogFromHistory(catalogTablesOf(db));

    expect(created).toBe(0);
    expect((await db.products.toArray()).filter(p => !p.deletedAt)).toHaveLength(0);
  });

  it('skips deleted history and handles a count of one', async () => {
    await db.shoppingHistory.put(entry('Gone', { deletedAt: ts }));
    await db.shoppingHistory.put(entry('Once', { count: 1 }));

    await seedCatalogFromHistory(catalogTablesOf(db));

    const products = await db.products.toArray();
    expect(products.map(p => p.name)).toEqual(['Once']);
    expect(products[0]?.priorPurchases).toBe(0);
  });
});

describe('linkItemsToProducts', () => {
  it('links an item to the existing product with its name', async () => {
    const milk = product();
    await db.products.put(milk);
    await db.shoppingItems.put(item('i1', 'Milk'));

    const linked = await linkItemsToProducts(catalogTablesOf(db));

    expect(linked).toBe(1);
    expect((await db.shoppingItems.get('i1'))?.productId).toBe(milk.id);
    expect(await db.products.count()).toBe(1);
  });

  it('creates a product for an item that has none, shared by same-named items', async () => {
    await db.shoppingItems.bulkPut([item('i1', 'Bread', { category: 'bakery' }), item('i2', 'bread')]);

    await linkItemsToProducts(catalogTablesOf(db));

    const products = await db.products.toArray();
    expect(products).toHaveLength(1);
    expect(products[0]?.category).toBe('bakery');
    const [a, b] = await Promise.all([db.shoppingItems.get('i1'), db.shoppingItems.get('i2')]);
    expect(a?.productId).toBe(products[0]?.id);
    expect(b?.productId).toBe(products[0]?.id);
  });

  it('leaves linked items and deleted items alone', async () => {
    await db.shoppingItems.bulkPut([
      item('linked', 'Milk', { productId: 'somewhere' }),
      item('gone', 'Ghost', { deletedAt: ts }),
    ]);

    const linked = await linkItemsToProducts(catalogTablesOf(db));

    expect(linked).toBe(0);
    expect(await db.products.count()).toBe(0);
  });

  it('matches on barcode', async () => {
    const scanned = product({ name: 'Nutella', nameKey: 'nutella', barcode: '301' });
    await db.products.put(scanned);
    await db.shoppingItems.put(item('i1', 'Hazelnut spread', { barcode: '301' }));

    await linkItemsToProducts(catalogTablesOf(db));

    expect((await db.shoppingItems.get('i1'))?.productId).toBe(scanned.id);
  });
});

describe('reconcileCatalog', () => {
  it('seeds from history only when asked, and always links', async () => {
    await db.shoppingHistory.put(entry('Milk'));
    await db.shoppingItems.put(item('i1', 'Bread'));

    await reconcileCatalog(db, { seedLegacy: false });

    // Not seeded: history alone must not create products on an ordinary boot.
    expect((await db.products.toArray()).map(p => p.name)).toEqual(['Bread']);

    await reconcileCatalog(db, { seedLegacy: true });

    expect((await db.products.toArray()).map(p => p.name).sort()).toEqual(['Bread', 'Milk']);
  });
});
