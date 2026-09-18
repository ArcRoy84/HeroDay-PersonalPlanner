/**
 * Shopping module state and operations.
 *
 * Reads still hand the UI the nested `lists[].items[]` shape it renders from,
 * but writes are now per-item calls against the normalized tables rather than a
 * reconcile of the whole array.
 */
import { useCallback, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/schema';
import { isLive } from '../db/repo';
import { assembleLists, type NestedList } from '../db/shopping';
import { now } from '../db/ids';
import * as ops from '../db/shoppingOps';
import type { ShoppingHistoryEntry, ShoppingRecipe, ShoppingItem } from '../db/types';

type Updater<T> = T | ((previous: T) => T);

const EMPTY_LISTS: NestedList[] = [];
const EMPTY_HISTORY: ShoppingHistoryEntry[] = [];
const EMPTY_RECIPES: ShoppingRecipe[] = [];

function resolve<T>(update: Updater<T>, previous: T): T {
  return typeof update === 'function' ? (update as (p: T) => T)(previous) : update;
}

export function useShopping() {
  const listRows = useLiveQuery(() => db.shoppingLists.toArray(), []);
  const itemRows = useLiveQuery(() => db.shoppingItems.toArray(), []);
  const historyRows = useLiveQuery(() => db.shoppingHistory.toArray(), []);
  const recipeRows = useLiveQuery(() => db.shoppingRecipes.toArray(), []);

  const lists = useMemo(
    () => (listRows && itemRows ? assembleLists(listRows, itemRows) : EMPTY_LISTS),
    [listRows, itemRows],
  );
  const history = useMemo(
    () => (historyRows ? historyRows.filter(isLive) : EMPTY_HISTORY),
    [historyRows],
  );
  const recipes = useMemo(
    () => (recipeRows ? recipeRows.filter(isLive) : EMPTY_RECIPES),
    [recipeRows],
  );

  /* ── Item operations ──────────────────────────────────────────────────── */

  const addItemToList = useCallback((listId: string, fields: ops.NewItemFields) => {
    void ops.addItemToList(listId, fields);
  }, []);

  const updateItem = useCallback((itemId: string, updates: Partial<ShoppingItem>) => {
    void ops.updateItem(itemId, updates);
  }, []);

  const removeItem = useCallback((itemId: string) => {
    void ops.removeItem(itemId);
  }, []);

  const toggleItem = useCallback((itemId: string) => {
    void ops.toggleItemChecked(itemId);
  }, []);

  const clearChecked = useCallback((listId: string) => {
    void ops.clearCheckedItems(listId);
  }, []);

  /* ── List operations ──────────────────────────────────────────────────── */

  // Returns the new id synchronously so the caller can select the list it just
  // created without waiting for the live query to catch up.
  const createList = useCallback((name: string): Promise<string> => ops.createList(name), []);

  const removeList = useCallback((listId: string) => {
    void ops.removeList(listId);
  }, []);

  const updateList = useCallback((listId: string, updates: Parameters<typeof ops.updateList>[1]) => {
    void ops.updateList(listId, updates);
  }, []);

  /* ── Recipes ──────────────────────────────────────────────────────────── */

  // Recipes keep the array-setter shape: the recipe editor builds a whole
  // recipe object at once, so there is no partial write to scope down to.
  const setRecipes = useCallback((update: Updater<ShoppingRecipe[]>) => {
    void (async () => {
      const current = (await db.shoppingRecipes.toArray()).filter(isLive);
      const next = resolve(update, current);
      const timestamp = now();
      const keep = new Set(next.map(r => r.id));
      await db.shoppingRecipes.bulkPut([
        ...next.map(r => ({ ...r, updatedAt: timestamp, deletedAt: null })),
        ...current
          .filter(r => !keep.has(r.id))
          .map(r => ({ ...r, deletedAt: timestamp, updatedAt: timestamp })),
      ]);
    })();
  }, []);

  return {
    lists, history, recipes,
    loading: listRows === undefined || itemRows === undefined,
    addItemToList, updateItem, removeItem, toggleItem, clearChecked,
    createList, removeList, updateList,
    setRecipes,
  };
}
