import { describe, it, expect, afterEach } from 'vitest';
import Dexie from 'dexie';
import { HeroDayDB, SCHEMA_V1 } from './schema';

const ts = '2026-09-18T00:00:00.000Z';
let name = '';

afterEach(async () => {
  if (name) await Dexie.delete(name);
  name = '';
});

describe('schema v1 -> v2 upgrade', () => {
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

    expect(v2.verno).toBe(2);

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
