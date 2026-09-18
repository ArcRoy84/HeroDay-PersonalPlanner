/**
 * Bridge between the shopping UI's nested shape and the normalized tables.
 *
 * `ShoppingList.jsx` is built around `lists[].items[]` and a `setLists(prev =>
 * next)` setter. Rewriting its 2,000+ lines to issue item-level writes is a
 * separate job; until then this reconciles a whole desired state into the two
 * tables.
 *
 * Reconcile, not diff: the caller hands over the complete intended array and
 * this makes the database match it. There is no attempt to infer *which*
 * operation the caller performed, which is where that class of bridge usually
 * goes wrong and silently drops writes.
 */
import { db } from './schema';
import { now } from './ids';
import { isLive } from './repo';
import type { ShoppingList, ShoppingItem } from './types';

/** A list with its items nested, as the shopping UI consumes it. */
export interface NestedList extends ShoppingList {
  items: ShoppingItem[];
}

/** Joins the two tables back into the nested shape. */
export function assembleLists(
  lists: ShoppingList[],
  items: ShoppingItem[],
): NestedList[] {
  const byList = new Map<string, ShoppingItem[]>();
  for (const item of items) {
    if (!isLive(item)) continue;
    const bucket = byList.get(item.listId);
    if (bucket) bucket.push(item);
    else byList.set(item.listId, [item]);
  }
  return lists
    .filter(isLive)
    .map(list => ({ ...list, items: byList.get(list.id) ?? [] }));
}

/**
 * Makes the database match `desired`.
 *
 * Rows present in `desired` are written; rows absent from it are soft-deleted.
 * The whole reconcile runs in one transaction, so a failure leaves the previous
 * state intact rather than a half-applied one.
 */
export async function reconcileLists(desired: NestedList[]): Promise<void> {
  await db.transaction('rw', db.shoppingLists, db.shoppingItems, async () => {
    const timestamp = now();

    const existingLists = await db.shoppingLists.toArray();
    const existingItems = await db.shoppingItems.toArray();

    const desiredListIds = new Set(desired.map(l => l.id));
    const desiredItemIds = new Set(desired.flatMap(l => l.items.map(i => i.id)));

    /* Upsert every list and item in the desired state. */
    const listRows: ShoppingList[] = [];
    const itemRows: ShoppingItem[] = [];

    for (const list of desired) {
      const { items, ...listFields } = list;
      listRows.push({
        ...listFields,
        updatedAt: timestamp,
        deletedAt: null,
      });
      for (const item of items) {
        itemRows.push({
          ...item,
          // Trust the list that contains it over any stale listId on the item.
          listId: list.id,
          updatedAt: timestamp,
          deletedAt: null,
        });
      }
    }

    /* Soft-delete anything that used to be live but is no longer desired. */
    const removedLists = existingLists
      .filter(l => isLive(l) && !desiredListIds.has(l.id))
      .map(l => ({ ...l, deletedAt: timestamp, updatedAt: timestamp }));

    const removedItems = existingItems
      .filter(i => isLive(i) && !desiredItemIds.has(i.id))
      .map(i => ({ ...i, deletedAt: timestamp, updatedAt: timestamp }));

    await Promise.all([
      db.shoppingLists.bulkPut([...listRows, ...removedLists]),
      db.shoppingItems.bulkPut([...itemRows, ...removedItems]),
    ]);
  });
}
