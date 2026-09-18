/**
 * Shopping module state, presented in the nested shape the existing UI expects.
 *
 * `setLists` / `setHistory` / `setRecipes` accept the same updater functions the
 * component already passes, so `ShoppingList.jsx` needs no changes to its own
 * logic — only its storage moves.
 */
import { useCallback, useMemo, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/schema';
import { isLive } from '../db/repo';
import { assembleLists, reconcileLists, type NestedList } from '../db/shopping';
import { now } from '../db/ids';
import type { ShoppingHistoryEntry, ShoppingRecipe } from '../db/types';

type Updater<T> = T | ((previous: T) => T);

const EMPTY_LISTS: NestedList[] = [];
const EMPTY_HISTORY: ShoppingHistoryEntry[] = [];
const EMPTY_RECIPES: ShoppingRecipe[] = [];

function resolve<T>(update: Updater<T>, previous: T): T {
  return typeof update === 'function'
    ? (update as (p: T) => T)(previous)
    : update;
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

  // Updaters must see the latest lists even when several fire before the live
  // query re-renders — a ref keeps them chained rather than each starting from
  // the same stale snapshot.
  const latestLists = useRef(lists);
  latestLists.current = lists;

  const setLists = useCallback((update: Updater<NestedList[]>) => {
    const next = resolve(update, latestLists.current);
    latestLists.current = next;
    void reconcileLists(next);
  }, []);

  const setHistory = useCallback((update: Updater<ShoppingHistoryEntry[]>) => {
    void (async () => {
      const current = (await db.shoppingHistory.toArray()).filter(isLive);
      const next = resolve(update, current);
      const timestamp = now();
      const keep = new Set(next.map(h => h.name));
      await db.shoppingHistory.bulkPut([
        ...next.map(h => ({ ...h, updatedAt: timestamp, deletedAt: null })),
        ...current
          .filter(h => !keep.has(h.name))
          .map(h => ({ ...h, deletedAt: timestamp, updatedAt: timestamp })),
      ]);
    })();
  }, []);

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
    setLists, setHistory, setRecipes,
  };
}
