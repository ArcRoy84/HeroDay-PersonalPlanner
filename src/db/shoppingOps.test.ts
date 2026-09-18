import { describe, it, expect, beforeEach } from 'vitest';
import { db } from './schema';
import { isLive } from './repo';
import {
  addItemToList, updateItem, removeItem, clearCheckedItems,
  toggleItemChecked, createList, removeList,
} from './shoppingOps';

const LIST = 'list-1';

async function liveItems(listId = LIST) {
  return (await db.shoppingItems.where('listId').equals(listId).toArray()).filter(isLive);
}

beforeEach(async () => {
  await db.open();
  await Promise.all([
    db.shoppingLists.clear(),
    db.shoppingItems.clear(),
    db.shoppingHistory.clear(),
    db.pantry.clear(),
  ]);
  await db.shoppingLists.put({
    id: LIST, name: 'Grocery', budget: null,
    createdAt: '2026-09-18T00:00:00.000Z',
    updatedAt: '2026-09-18T00:00:00.000Z', deletedAt: null,
  });
});

describe('addItemToList', () => {
  it('adds an item with defaults filled in', async () => {
    await addItemToList(LIST, { name: 'Milk' });

    const [item] = await liveItems();
    expect(item?.name).toBe('Milk');
    expect(item?.qty).toBe(1);
    expect(item?.checked).toBe(false);
    expect(item?.deletedAt).toBeNull();
  });

  it('merges into an existing unchecked item instead of duplicating', async () => {
    await addItemToList(LIST, { name: 'Milk', qty: 2 });
    await addItemToList(LIST, { name: 'milk', qty: 3 });

    const items = await liveItems();
    expect(items).toHaveLength(1);
    expect(items[0]?.qty).toBe(5);
  });

  it('starts a new row rather than merging into a checked one', async () => {
    await addItemToList(LIST, { name: 'Milk' });
    const [first] = await liveItems();
    await toggleItemChecked(first!.id);

    // Already bought — buying it again is a new line, not a bump.
    await addItemToList(LIST, { name: 'Milk' });

    const items = await liveItems();
    expect(items).toHaveLength(2);
  });

  it('keeps a scanned barcode when merging into a row without one', async () => {
    await addItemToList(LIST, { name: 'Milk' });
    await addItemToList(LIST, { name: 'Milk', barcode: '012345' });

    const items = await liveItems();
    expect(items).toHaveLength(1);
    expect(items[0]?.barcode).toBe('012345');
  });

  it('ignores a blank name or missing list', async () => {
    await addItemToList(LIST, { name: '   ' });
    await addItemToList('', { name: 'Milk' });
    expect(await liveItems()).toHaveLength(0);
  });

  it('does not merge across different lists', async () => {
    const other = await createList('Hardware');
    await addItemToList(LIST, { name: 'Milk', qty: 1 });
    await addItemToList(other, { name: 'Milk', qty: 1 });

    expect(await liveItems(LIST)).toHaveLength(1);
    expect(await liveItems(other)).toHaveLength(1);
  });
});

describe('toggleItemChecked', () => {
  it('records a purchase and restocks the pantry in one go', async () => {
    await addItemToList(LIST, { name: 'Milk', qty: 2, unit: 'gallon', category: 'dairy' });
    const [item] = await liveItems();

    await toggleItemChecked(item!.id);

    expect((await db.shoppingItems.get(item!.id))?.checked).toBe(true);

    const history = await db.shoppingHistory.toArray();
    expect(history).toHaveLength(1);
    expect(history[0]?.count).toBe(1);

    const pantry = await db.pantry.toArray();
    expect(pantry).toHaveLength(1);
    expect(pantry[0]?.qty).toBe(2);
    // Default restock threshold is twice what was bought.
    expect(pantry[0]?.parQty).toBe(4);
  });

  it('preserves the casing the user typed in history', async () => {
    await addItemToList(LIST, { name: 'Whole Milk' });
    const [item] = await liveItems();
    await toggleItemChecked(item!.id);

    const [entry] = await db.shoppingHistory.toArray();
    expect(entry?.name).toBe('Whole Milk');
  });

  it('increments an existing history entry case-insensitively', async () => {
    await addItemToList(LIST, { name: 'Milk' });
    const [first] = await liveItems();
    await toggleItemChecked(first!.id);

    await addItemToList(LIST, { name: 'milk' });
    const second = (await liveItems()).find(i => !i.checked);
    await toggleItemChecked(second!.id);

    const history = await db.shoppingHistory.toArray();
    expect(history).toHaveLength(1);
    expect(history[0]?.count).toBe(2);
  });

  it('accumulates pantry quantity across repeat purchases', async () => {
    for (const qty of [2, 3]) {
      await addItemToList(LIST, { name: 'Rice', qty });
      const pending = (await liveItems()).find(i => !i.checked);
      await toggleItemChecked(pending!.id);
    }

    const pantry = await db.pantry.toArray();
    expect(pantry).toHaveLength(1);
    expect(pantry[0]?.qty).toBe(5);
  });

  it('un-ticking does not record another purchase', async () => {
    await addItemToList(LIST, { name: 'Milk' });
    const [item] = await liveItems();

    await toggleItemChecked(item!.id);
    await toggleItemChecked(item!.id);

    expect((await db.shoppingItems.get(item!.id))?.checked).toBe(false);
    const history = await db.shoppingHistory.toArray();
    expect(history[0]?.count).toBe(1);
  });

  it('does nothing for an unknown or deleted item', async () => {
    await addItemToList(LIST, { name: 'Milk' });
    const [item] = await liveItems();
    await removeItem(item!.id);

    await toggleItemChecked(item!.id);
    await toggleItemChecked('does-not-exist');

    expect(await db.shoppingHistory.count()).toBe(0);
  });
});

describe('item edits and removal', () => {
  it('patches only the given fields', async () => {
    await addItemToList(LIST, { name: 'Milk', qty: 1, unit: 'gallon' });
    const [item] = await liveItems();

    await updateItem(item!.id, { qty: 4 });

    const updated = await db.shoppingItems.get(item!.id);
    expect(updated?.qty).toBe(4);
    expect(updated?.unit).toBe('gallon');
  });

  it('soft-deletes rather than dropping the row', async () => {
    await addItemToList(LIST, { name: 'Milk' });
    const [item] = await liveItems();

    await removeItem(item!.id);

    expect(await liveItems()).toHaveLength(0);
    expect((await db.shoppingItems.get(item!.id))?.deletedAt).toEqual(expect.any(String));
  });

  it('clears only the checked items', async () => {
    await addItemToList(LIST, { name: 'Milk' });
    await addItemToList(LIST, { name: 'Bread' });
    const milk = (await liveItems()).find(i => i.name === 'Milk');
    await toggleItemChecked(milk!.id);

    await clearCheckedItems(LIST);

    const remaining = await liveItems();
    expect(remaining.map(i => i.name)).toEqual(['Bread']);
  });
});

describe('list operations', () => {
  it('removing a list also removes its items', async () => {
    await addItemToList(LIST, { name: 'Milk' });
    await addItemToList(LIST, { name: 'Bread' });

    await removeList(LIST);

    expect(await liveItems()).toHaveLength(0);
    expect((await db.shoppingLists.get(LIST))?.deletedAt).toEqual(expect.any(String));
  });

  it('removing a list leaves other lists untouched', async () => {
    const other = await createList('Hardware');
    await addItemToList(other, { name: 'Screws' });
    await addItemToList(LIST, { name: 'Milk' });

    await removeList(LIST);

    expect(await liveItems(other)).toHaveLength(1);
    expect((await db.shoppingLists.get(other))?.deletedAt).toBeNull();
  });
});
