/**
 * Stores and store categories, plus the operations the Stores tab needs.
 *
 * Unlike the fire-and-forget hooks elsewhere, the write functions return their
 * promises: the store form has real ways to fail (a bad name, a database error)
 * and needs to show the user, not swallow it.
 */
import { useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/schema';
import { isLive } from '../db/repo';
import * as ops from '../db/storeOps';
import { OTHER_STORE_CATEGORY_ID } from '../data/storeCategories.js';
import type { Store, StoreCategory } from '../db/types';

const EMPTY_STORES: Store[] = [];
const EMPTY_CATEGORIES: StoreCategory[] = [];

export function useStores() {
  const storeRows = useLiveQuery(() => db.stores.toArray(), []);
  const categoryRows = useLiveQuery(() => db.storeCategories.toArray(), []);

  const stores = useMemo(
    () => (storeRows
      ? storeRows.filter(isLive).sort((a, b) => a.name.localeCompare(b.name))
      : EMPTY_STORES),
    [storeRows],
  );

  // Alphabetical, but 'Other' always last — it is the catch-all, not a peer.
  const storeCategories = useMemo(
    () => (categoryRows
      ? categoryRows.filter(isLive).sort((a, b) => {
        if (a.id === OTHER_STORE_CATEGORY_ID) return 1;
        if (b.id === OTHER_STORE_CATEGORY_ID) return -1;
        return a.label.localeCompare(b.label);
      })
      : EMPTY_CATEGORIES),
    [categoryRows],
  );

  return {
    stores,
    storeCategories,
    createStore: ops.createStore,
    updateStore: ops.updateStore,
    removeStore: ops.removeStore,
    saveStoreCategories: ops.saveStoreCategories,
    linkListToStore: ops.linkListToStore,
    createListForStore: ops.createListForStore,
  };
}
