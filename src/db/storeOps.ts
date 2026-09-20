/**
 * Store and store-category operations.
 *
 * Anything that touches more than one table (creating a store *and* its list,
 * deleting a store and detaching its lists, deleting a category and moving its
 * stores) runs in one transaction, so a failure leaves neither half applied.
 */
import { db } from './schema';
import { newId, now } from './ids';
import { isLive } from './repo';
import { DEFAULT_STORE_CATEGORIES, OTHER_STORE_CATEGORY_ID } from '../data/storeCategories.js';
import { isSafeLogo } from '../utils/stores';
import type { Store, StoreCategory } from './types';

/** What a caller supplies to create a store; ids and audit columns are ours. */
export type StoreInput = Omit<Store, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'>;

export class InvalidStoreError extends Error {
  override name = 'InvalidStoreError';
}

/**
 * Trims text fields and checks the rules the form also enforces.
 *
 * The form validates first so the user sees a friendly message; this is the
 * backstop so a bad write cannot reach the database from anywhere else.
 */
export function normalizeStoreInput(input: StoreInput): StoreInput {
  const name = input.name.trim();
  if (!name) throw new InvalidStoreError('A store needs a name.');

  const { lat, lon } = input;
  if ((lat === null) !== (lon === null)) {
    throw new InvalidStoreError('Latitude and longitude must be set together.');
  }
  if (lat !== null && (!Number.isFinite(lat) || Math.abs(lat) > 90)) {
    throw new InvalidStoreError('Latitude must be between -90 and 90.');
  }
  if (lon !== null && (!Number.isFinite(lon) || Math.abs(lon) > 180)) {
    throw new InvalidStoreError('Longitude must be between -180 and 180.');
  }

  // A logo is only ever an inline image. Anything else is dropped rather than
  // stored, so the store falls back to its emoji instead of failing to save.
  const logo = isSafeLogo(input.logo) ? input.logo : null;

  return {
    ...input,
    name,
    logo,
    icon: input.icon.trim() || '🏪',
    address: input.address.trim(),
    city: input.city.trim(),
    region: input.region.trim(),
    postalCode: input.postalCode.trim(),
    country: input.country.trim(),
    hours: input.hours.trim(),
    notes: input.notes.trim(),
  };
}

/* ── Store categories ───────────────────────────────────────────────────── */

/**
 * Makes sure the store category list is usable.
 *
 * Seeds the defaults when there are no live categories at all, and always
 * guarantees 'other' exists. Because 'other' can never be deleted, zero live
 * categories can only mean a first run or a restore from a backup that predates
 * stores — so seeding on "empty" cannot resurrect anything the user removed.
 */
export async function ensureDefaultStoreCategories(): Promise<void> {
  await db.transaction('rw', db.storeCategories, async () => {
    const live = (await db.storeCategories.toArray()).filter(isLive);
    const timestamp = now();
    const audited = (c: { id: string; label: string; emoji: string; color: string }): StoreCategory =>
      ({ ...c, updatedAt: timestamp, deletedAt: null });

    if (live.length === 0) {
      await db.storeCategories.bulkPut(DEFAULT_STORE_CATEGORIES.map(audited));
      return;
    }
    if (!live.some(c => c.id === OTHER_STORE_CATEGORY_ID)) {
      const other = DEFAULT_STORE_CATEGORIES.find(c => c.id === OTHER_STORE_CATEGORY_ID);
      if (other) await db.storeCategories.put(audited(other));
    }
  });
}

export interface StoreCategoryInput {
  id: string;
  label: string;
  emoji: string;
  color: string;
}

/**
 * Makes the stored categories match `next`.
 *
 * Categories missing from `next` are soft-deleted and every store in one moves
 * to 'other' rather than being left pointing at a category that no longer
 * exists. 'other' is kept even if the caller leaves it out.
 */
export async function saveStoreCategories(next: StoreCategoryInput[]): Promise<void> {
  await db.transaction('rw', db.storeCategories, db.stores, async () => {
    const timestamp = now();
    const existing = (await db.storeCategories.toArray()).filter(isLive);

    const wanted = next.filter(c => c.label.trim());
    if (!wanted.some(c => c.id === OTHER_STORE_CATEGORY_ID)) {
      const other = existing.find(c => c.id === OTHER_STORE_CATEGORY_ID)
        ?? DEFAULT_STORE_CATEGORIES.find(c => c.id === OTHER_STORE_CATEGORY_ID);
      if (other) wanted.push({ id: other.id, label: other.label, emoji: other.emoji, color: other.color });
    }

    const keep = new Set(wanted.map(c => c.id));
    const removed = existing.filter(c => !keep.has(c.id));

    if (removed.length) {
      const removedIds = new Set(removed.map(c => c.id));
      const orphans = (await db.stores.toArray()).filter(s => removedIds.has(s.categoryId));
      await db.stores.bulkPut(orphans.map(s => ({
        ...s, categoryId: OTHER_STORE_CATEGORY_ID, updatedAt: timestamp,
      })));
    }

    await db.storeCategories.bulkPut([
      ...wanted.map(c => ({ ...c, label: c.label.trim(), updatedAt: timestamp, deletedAt: null })),
      ...removed.map(c => ({ ...c, deletedAt: timestamp, updatedAt: timestamp })),
    ]);
  });
}

/* ── Stores ─────────────────────────────────────────────────────────────── */

export interface CreateStoreOptions {
  /** Also create a shopping list for the store, so it appears in the header. */
  createList?: boolean;
}

export interface CreateStoreResult {
  storeId: string;
  listId: string | null;
}

export async function createStore(
  input: StoreInput,
  options: CreateStoreOptions = {},
): Promise<CreateStoreResult> {
  const clean = normalizeStoreInput(input);
  const storeId = newId();
  const timestamp = now();
  let listId: string | null = null;

  await db.transaction('rw', db.stores, db.shoppingLists, async () => {
    await db.stores.put({
      ...clean, id: storeId, createdAt: timestamp, updatedAt: timestamp, deletedAt: null,
    });

    if (options.createList) {
      listId = newId();
      await db.shoppingLists.put({
        id: listId, name: clean.name, budget: null, storeId,
        createdAt: timestamp, updatedAt: timestamp, deletedAt: null,
      });
    }
  });

  return { storeId, listId };
}

/**
 * Updates a store.
 *
 * Renaming also renames any linked list that still carries the store's old
 * name, so a chip does not go on saying "Costco" after the store became
 * "Costco Wholesale". A list the user has named something else ("Costco -
 * Bulk") is left alone.
 */
export async function updateStore(id: string, input: StoreInput): Promise<void> {
  const clean = normalizeStoreInput(input);

  await db.transaction('rw', db.stores, db.shoppingLists, async () => {
    const existing = await db.stores.get(id);
    if (!existing || !isLive(existing)) return;
    const timestamp = now();

    await db.stores.put({ ...existing, ...clean, id, updatedAt: timestamp, deletedAt: null });

    if (existing.name !== clean.name) {
      const followers = (await db.shoppingLists.toArray())
        .filter(l => isLive(l) && l.storeId === id && l.name === existing.name);
      await db.shoppingLists.bulkPut(
        followers.map(l => ({ ...l, name: clean.name, updatedAt: timestamp })),
      );
    }
  });
}

/**
 * Deletes a store. Its lists are kept and become plain lists — deleting a
 * store should never delete the shopping the user has written down.
 */
export async function removeStore(id: string): Promise<void> {
  await db.transaction('rw', db.stores, db.shoppingLists, async () => {
    const timestamp = now();
    const linked = (await db.shoppingLists.toArray())
      .filter(l => isLive(l) && l.storeId === id);
    await db.shoppingLists.bulkPut(
      linked.map(l => ({ ...l, storeId: null, updatedAt: timestamp })),
    );
    await db.stores.update(id, { deletedAt: timestamp, updatedAt: timestamp });
  });
}

/** Links a list to a store, or unlinks it with `null`. */
export async function linkListToStore(listId: string, storeId: string | null): Promise<void> {
  await db.transaction('rw', db.stores, db.shoppingLists, async () => {
    if (storeId !== null) {
      const store = await db.stores.get(storeId);
      if (!store || !isLive(store)) return;
    }
    await db.shoppingLists.update(listId, { storeId, updatedAt: now() });
  });
}

/** Adds another list to an existing store, named after it by default. */
export async function createListForStore(storeId: string, name?: string): Promise<string | null> {
  let listId: string | null = null;

  await db.transaction('rw', db.stores, db.shoppingLists, async () => {
    const store = await db.stores.get(storeId);
    if (!store || !isLive(store)) return;
    const timestamp = now();
    listId = newId();
    await db.shoppingLists.put({
      id: listId, name: name?.trim() || store.name, budget: null, storeId,
      createdAt: timestamp, updatedAt: timestamp, deletedAt: null,
    });
  });

  return listId;
}
