import { describe, it, expect } from 'vitest';
import { assembleLists } from './shopping';
import type { ShoppingList, ShoppingItem } from './types';

const ts = '2026-09-18T00:00:00.000Z';

const makeList = (id: string, name: string): ShoppingList =>
  ({ id, name, budget: null, storeId: null, createdAt: ts, updatedAt: ts, deletedAt: null });

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
