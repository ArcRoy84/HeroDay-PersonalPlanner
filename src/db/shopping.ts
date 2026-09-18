/**
 * Read-side shape for the shopping UI.
 *
 * Items live in their own table but the UI renders them grouped under the list
 * that owns them, so this joins the two back together. Writes do not come
 * through here — each user action is a scoped operation in `shoppingOps.ts`.
 */
import { db } from './schema';
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
