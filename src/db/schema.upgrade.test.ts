import { describe, it, expect, afterEach } from 'vitest';
import Dexie from 'dexie';
import { HeroDayDB, SCHEMA_V1 } from './schema';

const ts = '2026-09-18T00:00:00.000Z';
let name = '';

afterEach(async () => {
  if (name) await Dexie.delete(name);
  name = '';
});

describe('schema upgrade from v1', () => {
  it('upgrades a database that was really created at version 1', async () => {
    name = `upgrade-${Date.now()}`;

    // A genuine v1 database, written the way the shipped v1 app wrote it: a
    // list with no storeId at all.
    const v1 = new Dexie(name);
    v1.version(1).stores(SCHEMA_V1);
    await v1.table('shoppingLists').put({
      id: 'grocery', name: 'Grocery', budget: 40, createdAt: ts, updatedAt: ts, deletedAt: null,
    });
    await v1.table('shoppingItems').put({
      id: 'i1', listId: 'grocery', name: 'Milk', qty: 2, unit: 'gallon', category: 'dairy',
      storeLocation: '', note: '', estimatedPrice: null, barcode: '', checked: false,
      addedAt: ts, updatedAt: ts, deletedAt: null,
    });
    await v1.table('tasks').put({ id: 't1', title: 'Keep me', date: '2026-09-18', categoryId: 'work', createdAt: ts });
    v1.close();

    const v2 = new HeroDayDB(name);
    await v2.open();

    // Opening at the latest version runs every upgrade in between.
    expect(v2.verno).toBe(3);

    // Existing lists gain an explicit "no store".
    const list = await v2.shoppingLists.get('grocery');
    expect(list?.storeId).toBeNull();
    expect(list?.name).toBe('Grocery');
    expect(list?.budget).toBe(40);

    // The new tables exist and are empty.
    expect(await v2.stores.count()).toBe(0);
    expect(await v2.storeCategories.count()).toBe(0);

    // Nothing else was disturbed.
    expect((await v2.shoppingItems.get('i1'))?.name).toBe('Milk');
    expect((await v2.tasks.get('t1'))?.title).toBe('Keep me');

    v2.close();
  });

  it('does not overwrite a storeId that is already set', async () => {
    name = `upgrade-keep-${Date.now()}`;

    const v1 = new Dexie(name);
    v1.version(1).stores(SCHEMA_V1);
    await v1.table('shoppingLists').put({
      id: 'x', name: 'X', budget: null, storeId: 'store-1', createdAt: ts, updatedAt: ts, deletedAt: null,
    });
    v1.close();

    const v2 = new HeroDayDB(name);
    await v2.open();

    expect((await v2.shoppingLists.get('x'))?.storeId).toBe('store-1');
    v2.close();
  });
});

describe('schema v2 -> v3 upgrade (the product catalog)', () => {
  const stamp = '2026-09-10T15:00:00.000Z';

  /** A database exactly as the shipped v2 app left it. */
  async function createV2(dbName: string) {
    const v2 = new Dexie(dbName);
    v2.version(1).stores(SCHEMA_V1);
    v2.version(2).stores({ stores: 'id, categoryId', storeCategories: 'id' });

    const list = { id: 'l1', name: 'Grocery', budget: null, storeId: null, createdAt: stamp, updatedAt: stamp, deletedAt: null };
    const row = (id: string, name: string, extra = {}) => ({
      id, listId: 'l1', name, qty: 1, unit: '', category: 'dairy', storeLocation: '', note: '',
      estimatedPrice: null, barcode: '', checked: false, addedAt: stamp, updatedAt: stamp, deletedAt: null, ...extra,
    });
    const entry = (name: string, extra = {}) => ({
      name, unit: '', category: 'dairy', estimatedPrice: 3.5, barcode: '', count: 5,
      lastBought: stamp, updatedAt: stamp, deletedAt: null, ...extra,
    });

    await v2.table('shoppingLists').put(list);
    await v2.table('shoppingItems').bulkPut([row('i-milk', 'Milk'), row('i-bread', 'Bread', { category: 'bakery' })]);
    await v2.table('shoppingHistory').bulkPut([
      entry('Milk', { count: 5 }),
      entry('Eggs', { count: 1 }),
      entry('Ghost', { deletedAt: stamp }),
    ]);
    v2.close();
  }

  it('turns history into products with legacy purchases, and links list items', async () => {
    name = `upgrade-v3-${Date.now()}`;
    await createV2(name);

    const v3 = new HeroDayDB(name);
    await v3.open();

    const products = await v3.products.toArray();
    // Milk and Eggs from history; Bread only exists as a list item.
    expect(products.map(p => p.name).sort()).toEqual(['Bread', 'Eggs', 'Milk']);

    const milk = products.find(p => p.name === 'Milk')!;
    expect(milk.priorPurchases).toBe(4);
    expect(products.find(p => p.name === 'Eggs')!.priorPurchases).toBe(0);

    // One dated legacy purchase per history entry; none for Bread or the deleted entry.
    const purchases = await v3.purchases.toArray();
    expect(purchases).toHaveLength(2);
    expect(purchases.every(p => p.source === 'legacy' && p.price === null && !p.confirmed)).toBe(true);

    // List items now point at a product, and the Milk item at the Milk product.
    expect((await v3.shoppingItems.get('i-milk'))?.productId).toBe(milk.id);
    expect((await v3.shoppingItems.get('i-bread'))?.productId).toBe(products.find(p => p.name === 'Bread')!.id);

    // Existing data survived.
    expect((await v3.shoppingLists.get('l1'))?.name).toBe('Grocery');
    expect(await v3.shoppingHistory.count()).toBe(3);
    v3.close();
  });

  it('works on a v2 database with no history or items at all', async () => {
    name = `upgrade-v3-empty-${Date.now()}`;
    const v2 = new Dexie(name);
    v2.version(1).stores(SCHEMA_V1);
    v2.version(2).stores({ stores: 'id, categoryId', storeCategories: 'id' });
    await v2.table('tasks').put({ id: 't1', title: 'Keep me', date: '2026-09-18', categoryId: 'work', createdAt: stamp });
    v2.close();

    const v3 = new HeroDayDB(name);
    await v3.open();

    expect(await v3.products.count()).toBe(0);
    expect((await v3.tasks.get('t1'))?.title).toBe('Keep me');
    v3.close();
  });
});
