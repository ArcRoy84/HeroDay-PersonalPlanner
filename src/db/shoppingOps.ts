/**
 * Item-level shopping operations.
 *
 * These replace the reconcile bridge: instead of the component handing over a
 * whole desired `lists[].items[]` array, each user action becomes one scoped
 * write. Two things improve as a result.
 *
 * Atomicity — ticking an item off touches three tables (the item, the purchase
 * history, the pantry). As separate `setState` calls those could interleave or
 * partially fail; here they are one transaction that either lands or does not.
 *
 * Concurrency — read-modify-write sequences (deduplicating by name, bumping a
 * quantity) run inside the transaction, so a second call cannot read stale
 * state between the read and the write.
 */
import { db } from './schema';
import { newId, now } from './ids';
import { isLive } from './repo';
import type { ShoppingItem, ShoppingList, PantryItem } from './types';

/** Purchase history is a frequency cache, capped so it cannot grow forever. */
const HISTORY_LIMIT = 60;

/** Fields a caller may supply when adding an item. */
export interface NewItemFields {
  name: string;
  qty?: number;
  unit?: string;
  category?: string;
  storeLocation?: string;
  note?: string;
  estimatedPrice?: number | null;
  barcode?: string;
}

const round2 = (n: number): number => Number(n.toFixed(2));
const sameName = (a: string, b: string): boolean =>
  a.toLowerCase() === b.toLowerCase();

/**
 * Adds an item to a list, merging into an existing unchecked item of the same
 * name rather than creating a duplicate — the behaviour the UI had before.
 */
export async function addItemToList(
  listId: string,
  fields: NewItemFields,
): Promise<void> {
  const name = fields.name.trim();
  if (!name || !listId) return;

  await db.transaction('rw', db.shoppingItems, async () => {
    const existing = (await db.shoppingItems.where('listId').equals(listId).toArray())
      .filter(isLive);
    const duplicate = existing.find(i => sameName(i.name, name) && !i.checked);
    const timestamp = now();
    const qty = fields.qty ?? 1;

    if (duplicate) {
      await db.shoppingItems.update(duplicate.id, {
        qty: round2((duplicate.qty || 1) + qty),
        // A scanned barcode is worth keeping if the existing row lacks one.
        barcode: fields.barcode || duplicate.barcode,
        updatedAt: timestamp,
      });
      return;
    }

    await db.shoppingItems.put({
      id: newId(),
      listId,
      name,
      qty,
      unit: fields.unit ?? '',
      category: fields.category ?? 'other',
      storeLocation: fields.storeLocation ?? '',
      note: fields.note ?? '',
      estimatedPrice: fields.estimatedPrice ?? null,
      barcode: fields.barcode ?? '',
      checked: false,
      addedAt: timestamp,
      updatedAt: timestamp,
      deletedAt: null,
    });
  });
}

export async function updateItem(
  itemId: string,
  updates: Partial<ShoppingItem>,
): Promise<void> {
  await db.shoppingItems.update(itemId, { ...updates, updatedAt: now() });
}

export async function removeItem(itemId: string): Promise<void> {
  const timestamp = now();
  await db.shoppingItems.update(itemId, { deletedAt: timestamp, updatedAt: timestamp });
}

/** Clears every ticked-off item from a list in one transaction. */
export async function clearCheckedItems(listId: string): Promise<void> {
  await db.transaction('rw', db.shoppingItems, async () => {
    const items = (await db.shoppingItems.where('listId').equals(listId).toArray())
      .filter(i => isLive(i) && i.checked);
    const timestamp = now();
    await db.shoppingItems.bulkPut(
      items.map(i => ({ ...i, deletedAt: timestamp, updatedAt: timestamp })),
    );
  });
}

/**
 * Records a purchase against the name-keyed frequency table.
 *
 * Names are matched case-insensitively but stored with the casing the user
 * typed, so "Milk" does not become "milk" in the suggestions list.
 */
async function recordPurchaseWithin(item: ShoppingItem, timestamp: string): Promise<void> {
  const entries = (await db.shoppingHistory.toArray()).filter(isLive);
  const existing = entries.find(h => sameName(h.name, item.name));

  if (existing) {
    await db.shoppingHistory.put({
      ...existing,
      count: existing.count + 1,
      lastBought: timestamp,
      barcode: item.barcode || existing.barcode,
      updatedAt: timestamp,
      deletedAt: null,
    });
    return;
  }

  await db.shoppingHistory.put({
    name: item.name,
    unit: item.unit,
    category: item.category,
    estimatedPrice: item.estimatedPrice,
    barcode: item.barcode,
    count: 1,
    lastBought: timestamp,
    updatedAt: timestamp,
    deletedAt: null,
  });

  // Trim the oldest beyond the cap. This is a derived cache rather than user
  // content, so the excess is removed outright instead of soft-deleted.
  const live = (await db.shoppingHistory.toArray()).filter(isLive);
  if (live.length > HISTORY_LIMIT) {
    const doomed = live
      .sort((a, b) => b.lastBought.localeCompare(a.lastBought))
      .slice(HISTORY_LIMIT);
    await db.shoppingHistory.bulkDelete(doomed.map(h => h.name));
  }
}

/** Restocks the pantry tracker after a purchase. */
async function restockPantryWithin(item: ShoppingItem, timestamp: string): Promise<void> {
  const pantry = (await db.pantry.toArray()).filter(isLive);
  const existing = pantry.find(p => sameName(p.name, item.name));
  const qty = item.qty || 1;

  if (!existing) {
    const row: PantryItem = {
      id: newId(),
      name: item.name,
      qty,
      unit: item.unit || '',
      category: item.category || 'other',
      // Default restock threshold: twice what was just bought.
      parQty: Math.max(1, qty * 2),
      updatedAt: timestamp,
      deletedAt: null,
    };
    await db.pantry.put(row);
    return;
  }

  await db.pantry.update(existing.id, {
    qty: round2((existing.qty || 0) + qty),
    updatedAt: timestamp,
  });
}

/**
 * Toggles an item's checked state.
 *
 * Ticking an item *on* also records the purchase and restocks the pantry;
 * un-ticking only flips the flag, matching the previous behaviour. All three
 * tables move together in one transaction.
 */
export async function toggleItemChecked(itemId: string): Promise<void> {
  await db.transaction('rw', db.shoppingItems, db.shoppingHistory, db.pantry, async () => {
    const item = await db.shoppingItems.get(itemId);
    if (!item || !isLive(item)) return;

    const timestamp = now();
    const nowChecked = !item.checked;
    await db.shoppingItems.update(itemId, { checked: nowChecked, updatedAt: timestamp });

    if (!nowChecked) return;
    await recordPurchaseWithin(item, timestamp);
    await restockPantryWithin(item, timestamp);
  });
}

/* ── Lists ──────────────────────────────────────────────────────────────── */

export async function createList(name: string): Promise<string> {
  const id = newId();
  const timestamp = now();
  const row: ShoppingList = {
    id, name, budget: null,
    createdAt: timestamp, updatedAt: timestamp, deletedAt: null,
  };
  await db.shoppingLists.put(row);
  return id;
}

export async function updateList(
  listId: string,
  updates: Partial<ShoppingList>,
): Promise<void> {
  await db.shoppingLists.update(listId, { ...updates, updatedAt: now() });
}

/** Deletes a list and its items together, so no item is left orphaned. */
export async function removeList(listId: string): Promise<void> {
  await db.transaction('rw', db.shoppingLists, db.shoppingItems, async () => {
    const timestamp = now();
    const items = (await db.shoppingItems.where('listId').equals(listId).toArray())
      .filter(isLive);
    await db.shoppingItems.bulkPut(
      items.map(i => ({ ...i, deletedAt: timestamp, updatedAt: timestamp })),
    );
    await db.shoppingLists.update(listId, { deletedAt: timestamp, updatedAt: timestamp });
  });
}
