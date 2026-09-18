import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { HeroDayDB } from './schema';
import { assembleLists, type NestedList } from './shopping';
import type { ShoppingList, ShoppingItem } from './types';

/* `assembleLists` is pure, so it is tested directly. `reconcileLists` writes to
   the module-level `db` singleton, which the setup file backs with
   fake-indexeddb — so these tests exercise it through that same instance. */
import { db } from './schema';
import { reconcileLists } from './shopping';

const ts = '2026-09-18T00:00:00.000Z';

const makeList = (id: string, name: string): ShoppingList =>
  ({ id, name, budget: null, createdAt: ts, updatedAt: ts, deletedAt: null });

const makeItem = (id: string, listId: string, name: string): ShoppingItem =>
  ({ id, listId, name, qty: 1, unit: '', category: 'other', storeLocation: '',
     note: '', estimatedPrice: null, barcode: '', checked: false,
     addedAt: ts, updatedAt: ts, deletedAt: null });

describe('assembleLists', () => {
  it('nests items under the list that owns them', () => {
    const result = assembleLists(
      [makeList('a', 'Grocery'), makeList('b', 'Hardware')],
      [makeItem('i1', 'a', 'Milk'), makeItem('i2', 'b', 'Screws'), makeItem('i3', 'a', 'Bread')],
    );

    expect(result).toHaveLength(2);
    expect(result[0]!.items.map(i => i.name).sort()).toEqual(['Bread', 'Milk']);
    expect(result[1]!.items.map(i => i.name)).toEqual(['Screws']);
  });

  it('gives a list with no items an empty array, not undefined', () => {
    const result = assembleLists([makeList('a', 'Empty')], []);
    expect(result[0]!.items).toEqual([]);
  });

  it('hides soft-deleted lists and items', () => {
    const deletedList = { ...makeList('gone', 'Deleted'), deletedAt: ts };
    const deletedItem = { ...makeItem('i9', 'a', 'Removed'), deletedAt: ts };

    const result = assembleLists(
      [makeList('a', 'Live'), deletedList],
      [makeItem('i1', 'a', 'Kept'), deletedItem],
    );

    expect(result).toHaveLength(1);
    expect(result[0]!.items.map(i => i.name)).toEqual(['Kept']);
  });
});

describe('reconcileLists', () => {
  beforeEach(async () => {
    await db.open();
    await db.shoppingLists.clear();
    await db.shoppingItems.clear();
  });

  afterEach(async () => {
    await db.shoppingLists.clear();
    await db.shoppingItems.clear();
  });

  const nest = (list: ShoppingList, items: ShoppingItem[]): NestedList =>
    ({ ...list, items });

  it('writes lists and their items into separate tables', async () => {
    await reconcileLists([
      nest(makeList('a', 'Grocery'), [makeItem('i1', 'a', 'Milk')]),
    ]);

    expect(await db.shoppingLists.count()).toBe(1);
    const stored = await db.shoppingItems.get('i1');
    expect(stored?.name).toBe('Milk');
    expect(stored?.listId).toBe('a');
  });

  it('soft-deletes items dropped from the desired state', async () => {
    await reconcileLists([
      nest(makeList('a', 'Grocery'), [makeItem('i1', 'a', 'Milk'), makeItem('i2', 'a', 'Bread')]),
    ]);

    // The user removes Bread.
    await reconcileLists([
      nest(makeList('a', 'Grocery'), [makeItem('i1', 'a', 'Milk')]),
    ]);

    const bread = await db.shoppingItems.get('i2');
    // Still on disk — a hard delete would be invisible to a future sync.
    expect(bread).toBeDefined();
    expect(bread?.deletedAt).toEqual(expect.any(String));

    const assembled = assembleLists(
      await db.shoppingLists.toArray(),
      await db.shoppingItems.toArray(),
    );
    expect(assembled[0]!.items.map(i => i.name)).toEqual(['Milk']);
  });

  it('soft-deletes a removed list and leaves the survivors alone', async () => {
    await reconcileLists([
      nest(makeList('a', 'Grocery'), [makeItem('i1', 'a', 'Milk')]),
      nest(makeList('b', 'Hardware'), [makeItem('i2', 'b', 'Screws')]),
    ]);

    await reconcileLists([
      nest(makeList('a', 'Grocery'), [makeItem('i1', 'a', 'Milk')]),
    ]);

    expect((await db.shoppingLists.get('b'))?.deletedAt).toEqual(expect.any(String));
    expect((await db.shoppingLists.get('a'))?.deletedAt).toBeNull();
    expect((await db.shoppingItems.get('i1'))?.deletedAt).toBeNull();
  });

  it('restores an item that comes back after removal', async () => {
    const item = makeItem('i1', 'a', 'Milk');
    await reconcileLists([nest(makeList('a', 'Grocery'), [item])]);
    await reconcileLists([nest(makeList('a', 'Grocery'), [])]);
    expect((await db.shoppingItems.get('i1'))?.deletedAt).toEqual(expect.any(String));

    // Undo — the same id reappears in the desired state.
    await reconcileLists([nest(makeList('a', 'Grocery'), [item])]);
    expect((await db.shoppingItems.get('i1'))?.deletedAt).toBeNull();
  });

  it('applies edits to an existing item in place', async () => {
    await reconcileLists([
      nest(makeList('a', 'Grocery'), [makeItem('i1', 'a', 'Milk')]),
    ]);

    await reconcileLists([
      nest(makeList('a', 'Grocery'), [
        { ...makeItem('i1', 'a', 'Milk'), qty: 3, checked: true },
      ]),
    ]);

    const stored = await db.shoppingItems.get('i1');
    expect(stored?.qty).toBe(3);
    expect(stored?.checked).toBe(true);
    expect(await db.shoppingItems.count()).toBe(1);
  });

  it('does not persist the nested items array onto the list row', async () => {
    await reconcileLists([
      nest(makeList('a', 'Grocery'), [makeItem('i1', 'a', 'Milk')]),
    ]);

    const list = await db.shoppingLists.get('a');
    expect((list as unknown as Record<string, unknown>).items).toBeUndefined();
  });
});
