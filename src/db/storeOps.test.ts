import { describe, it, expect, beforeEach } from 'vitest';
import { db } from './schema';
import { isLive } from './repo';
import {
  normalizeStoreInput, createStore, updateStore, removeStore,
  linkListToStore, createListForStore,
  ensureDefaultStoreCategories, saveStoreCategories,
  InvalidStoreError, type StoreInput,
} from './storeOps';
import { DEFAULT_STORE_CATEGORIES } from '../data/storeCategories.js';

const ts = '2026-09-18T00:00:00.000Z';
const LOGO = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQ==';

const store = (overrides: Partial<StoreInput> = {}): StoreInput => ({
  name: 'Costco', icon: '📦', logo: null, categoryId: 'warehouse',
  address: '', city: '', region: '', postalCode: '', country: '',
  lat: null, lon: null, hours: '', notes: '',
  ...overrides,
});

const seedList = (id: string, name: string, storeId: string | null = null) =>
  db.shoppingLists.put({
    id, name, budget: null, storeId, createdAt: ts, updatedAt: ts, deletedAt: null,
  });

async function liveStores() {
  return (await db.stores.toArray()).filter(isLive);
}

beforeEach(async () => {
  await db.open();
  await Promise.all(db.tables.map(t => t.clear()));
});

describe('normalizeStoreInput', () => {
  it('trims text fields', () => {
    const clean = normalizeStoreInput(store({
      name: '  Costco  ', city: ' Springfield ', notes: '  park at the back  ',
    }));
    expect(clean.name).toBe('Costco');
    expect(clean.city).toBe('Springfield');
    expect(clean.notes).toBe('park at the back');
  });

  it('rejects a blank name', () => {
    expect(() => normalizeStoreInput(store({ name: '   ' }))).toThrow(InvalidStoreError);
  });

  it('falls back to a default icon when none is given', () => {
    expect(normalizeStoreInput(store({ icon: '  ' })).icon).toBe('🏪');
  });

  it('requires latitude and longitude together', () => {
    expect(() => normalizeStoreInput(store({ lat: 10, lon: null }))).toThrow(/together/);
    expect(() => normalizeStoreInput(store({ lat: null, lon: 10 }))).toThrow(/together/);
  });

  it('rejects out-of-range and non-finite coordinates', () => {
    expect(() => normalizeStoreInput(store({ lat: 91, lon: 0 }))).toThrow(/Latitude/);
    expect(() => normalizeStoreInput(store({ lat: 0, lon: -181 }))).toThrow(/Longitude/);
    expect(() => normalizeStoreInput(store({ lat: NaN, lon: 0 }))).toThrow(/Latitude/);
  });

  it('accepts the boundary values and the equator/meridian', () => {
    expect(() => normalizeStoreInput(store({ lat: 90, lon: 180 }))).not.toThrow();
    expect(() => normalizeStoreInput(store({ lat: -90, lon: -180 }))).not.toThrow();
    // 0 is a real coordinate, not "missing".
    expect(normalizeStoreInput(store({ lat: 0, lon: 0 })).lat).toBe(0);
  });

  it('keeps an inline image logo', () => {
    expect(normalizeStoreInput(store({ logo: LOGO })).logo).toBe(LOGO);
  });

  it('drops a logo that is not an inline image instead of failing the save', () => {
    // A hand-edited backup could smuggle in a remote URL, which would make the
    // app fetch it every time the store is shown.
    expect(normalizeStoreInput(store({ logo: 'https://evil.example/pixel.png' })).logo).toBeNull();
    expect(normalizeStoreInput(store({ logo: 'javascript:alert(1)' })).logo).toBeNull();
  });
});

describe('createStore', () => {
  it('stores the fields with audit columns and a generated id', async () => {
    const { storeId, listId } = await createStore(store({ city: 'Springfield' }));

    const row = await db.stores.get(storeId);
    expect(row?.name).toBe('Costco');
    expect(row?.city).toBe('Springfield');
    expect(row?.deletedAt).toBeNull();
    expect(row?.updatedAt).toEqual(expect.any(String));
    expect(storeId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(listId).toBeNull();
    expect(await db.shoppingLists.count()).toBe(0);
  });

  it('creates a linked list, named after the store, when asked', async () => {
    const { storeId, listId } = await createStore(store(), { createList: true });

    expect(listId).not.toBeNull();
    const list = await db.shoppingLists.get(listId!);
    expect(list?.name).toBe('Costco');
    expect(list?.storeId).toBe(storeId);
  });

  it('writes nothing when validation fails', async () => {
    await expect(createStore(store({ name: '' }), { createList: true })).rejects.toThrow(InvalidStoreError);
    expect(await db.stores.count()).toBe(0);
    expect(await db.shoppingLists.count()).toBe(0);
  });
});

describe('updateStore', () => {
  it('updates fields and bumps updatedAt', async () => {
    const { storeId } = await createStore(store());
    const before = (await db.stores.get(storeId))!;

    await updateStore(storeId, store({ city: 'Shelbyville', hours: 'Mon-Fri 9-5' }));

    const after = (await db.stores.get(storeId))!;
    expect(after.city).toBe('Shelbyville');
    expect(after.hours).toBe('Mon-Fri 9-5');
    expect(after.createdAt).toBe(before.createdAt);
    expect(after.updatedAt >= before.updatedAt).toBe(true);
  });

  it('renames a linked list that still carries the old store name', async () => {
    const { storeId, listId } = await createStore(store(), { createList: true });

    await updateStore(storeId, store({ name: 'Costco Wholesale' }));

    expect((await db.shoppingLists.get(listId!))?.name).toBe('Costco Wholesale');
  });

  it('leaves a list the user named something else alone', async () => {
    const { storeId } = await createStore(store());
    await seedList('bulk', 'Costco - Bulk', storeId);
    await seedList('weekly', 'Costco', storeId);

    await updateStore(storeId, store({ name: 'Costco Wholesale' }));

    expect((await db.shoppingLists.get('bulk'))?.name).toBe('Costco - Bulk');
    expect((await db.shoppingLists.get('weekly'))?.name).toBe('Costco Wholesale');
  });

  it('does not rename lists belonging to a different store', async () => {
    const a = await createStore(store({ name: 'Target' }));
    await seedList('other-list', 'Target', null);

    await updateStore(a.storeId, store({ name: 'Target Superstore' }));

    expect((await db.shoppingLists.get('other-list'))?.name).toBe('Target');
  });

  it('ignores an unknown id and does not resurrect a deleted store', async () => {
    await updateStore('nope', store());
    expect(await db.stores.count()).toBe(0);

    const { storeId } = await createStore(store());
    await removeStore(storeId);
    await updateStore(storeId, store({ name: 'Back from the dead' }));

    expect(await liveStores()).toHaveLength(0);
  });
});

describe('removeStore', () => {
  it('soft-deletes the store and keeps its lists and items', async () => {
    const { storeId, listId } = await createStore(store(), { createList: true });
    await db.shoppingItems.put({
      id: 'i1', listId: listId!, name: 'Milk', qty: 1, unit: '', category: 'dairy',
      storeLocation: '', note: '', estimatedPrice: null, barcode: '', productId: null, checked: false,
      addedAt: ts, updatedAt: ts, deletedAt: null,
    });

    await removeStore(storeId);

    expect((await db.stores.get(storeId))?.deletedAt).toEqual(expect.any(String));
    const list = await db.shoppingLists.get(listId!);
    expect(list?.deletedAt).toBeNull();
    expect(list?.storeId).toBeNull();
    expect((await db.shoppingItems.get('i1'))?.deletedAt).toBeNull();
  });

  it('only detaches lists of that store', async () => {
    const a = await createStore(store({ name: 'A' }), { createList: true });
    const b = await createStore(store({ name: 'B' }), { createList: true });

    await removeStore(a.storeId);

    expect((await db.shoppingLists.get(b.listId!))?.storeId).toBe(b.storeId);
  });
});

describe('linkListToStore', () => {
  it('links and unlinks a list', async () => {
    const { storeId } = await createStore(store());
    await seedList('grocery', 'Grocery');

    await linkListToStore('grocery', storeId);
    expect((await db.shoppingLists.get('grocery'))?.storeId).toBe(storeId);

    await linkListToStore('grocery', null);
    expect((await db.shoppingLists.get('grocery'))?.storeId).toBeNull();
  });

  it('refuses to link to a missing or deleted store', async () => {
    await seedList('grocery', 'Grocery');
    await linkListToStore('grocery', 'ghost');
    expect((await db.shoppingLists.get('grocery'))?.storeId).toBeNull();

    const { storeId } = await createStore(store());
    await removeStore(storeId);
    await linkListToStore('grocery', storeId);
    expect((await db.shoppingLists.get('grocery'))?.storeId).toBeNull();
  });
});

describe('createListForStore', () => {
  it('adds another list to the same store', async () => {
    const { storeId, listId } = await createStore(store(), { createList: true });

    const second = await createListForStore(storeId, 'Costco - Bulk');

    expect(second).not.toBeNull();
    expect(second).not.toBe(listId);
    const lists = (await db.shoppingLists.toArray()).filter(l => l.storeId === storeId);
    expect(lists.map(l => l.name).sort()).toEqual(['Costco', 'Costco - Bulk']);
  });

  it('defaults the name to the store name', async () => {
    const { storeId } = await createStore(store({ name: 'Trader Joe' }));
    const listId = await createListForStore(storeId);
    expect((await db.shoppingLists.get(listId!))?.name).toBe('Trader Joe');
  });

  it('returns null for a missing store and creates nothing', async () => {
    expect(await createListForStore('ghost')).toBeNull();
    expect(await db.shoppingLists.count()).toBe(0);
  });
});

describe('ensureDefaultStoreCategories', () => {
  it('seeds the defaults into an empty table', async () => {
    await ensureDefaultStoreCategories();

    const live = (await db.storeCategories.toArray()).filter(isLive);
    expect(live).toHaveLength(DEFAULT_STORE_CATEGORIES.length);
    expect(live.map(c => c.id)).toContain('supermarket');
    expect(live.map(c => c.id)).toContain('other');
  });

  it('is idempotent and never overwrites a category the user edited', async () => {
    await ensureDefaultStoreCategories();
    await db.storeCategories.update('bakery', { label: 'Panadería', emoji: '🥐' });

    await ensureDefaultStoreCategories();

    expect(await db.storeCategories.count()).toBe(DEFAULT_STORE_CATEGORIES.length);
    expect((await db.storeCategories.get('bakery'))?.label).toBe('Panadería');
  });

  it('does not resurrect a default the user deleted', async () => {
    await ensureDefaultStoreCategories();
    await saveStoreCategories(
      (await db.storeCategories.toArray()).filter(c => c.id !== 'pharmacy'),
    );

    await ensureDefaultStoreCategories();

    expect((await db.storeCategories.get('pharmacy'))?.deletedAt).toEqual(expect.any(String));
  });

  it('restores the catch-all if it is somehow missing', async () => {
    await db.storeCategories.put({
      id: 'only-one', label: 'Only', emoji: '1', color: '#000', updatedAt: ts, deletedAt: null,
    });

    await ensureDefaultStoreCategories();

    const other = await db.storeCategories.get('other');
    expect(other?.deletedAt).toBeNull();
    expect(await db.storeCategories.count()).toBe(2);
  });
});

describe('saveStoreCategories', () => {
  beforeEach(ensureDefaultStoreCategories);

  const current = async () =>
    (await db.storeCategories.toArray()).filter(isLive)
      .map(({ id, label, emoji, color }) => ({ id, label, emoji, color }));

  it('moves the stores of a deleted category to Other', async () => {
    const { storeId } = await createStore(store({ categoryId: 'pharmacy' }));

    await saveStoreCategories((await current()).filter(c => c.id !== 'pharmacy'));

    expect((await db.stores.get(storeId))?.categoryId).toBe('other');
    expect((await db.storeCategories.get('pharmacy'))?.deletedAt).toEqual(expect.any(String));
  });

  it('leaves stores in surviving categories untouched', async () => {
    const { storeId } = await createStore(store({ categoryId: 'bakery' }));

    await saveStoreCategories((await current()).filter(c => c.id !== 'pharmacy'));

    expect((await db.stores.get(storeId))?.categoryId).toBe('bakery');
  });

  it('never lets the catch-all be removed', async () => {
    const { storeId } = await createStore(store({ categoryId: 'hardware' }));

    await saveStoreCategories((await current()).filter(c => c.id !== 'other' && c.id !== 'hardware'));

    expect((await db.storeCategories.get('other'))?.deletedAt).toBeNull();
    // The store must land on a category that exists.
    expect((await db.stores.get(storeId))?.categoryId).toBe('other');
  });

  it('adds new categories and applies renames', async () => {
    const next = await current();
    next.push({ id: 'cat_1', label: '  Florist  ', emoji: '💐', color: '#e879f9' });
    const bakery = next.find(c => c.id === 'bakery')!;
    bakery.label = 'Panadería';

    await saveStoreCategories(next);

    expect((await db.storeCategories.get('cat_1'))?.label).toBe('Florist');
    expect((await db.storeCategories.get('bakery'))?.label).toBe('Panadería');
  });

  it('drops categories with a blank label', async () => {
    const next = await current();
    next.push({ id: 'blank', label: '   ', emoji: '?', color: '#000' });

    await saveStoreCategories(next);

    expect(await db.storeCategories.get('blank')).toBeUndefined();
  });
});
