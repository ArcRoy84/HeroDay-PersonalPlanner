/**
 * The three collections ShoppingList.jsx used to persist itself: the store
 * category list, the pantry tracker and the unit vocabulary.
 *
 * Units are a plain string array with no identity of their own, so they live in
 * the `settings` table rather than getting a table; categories and pantry items
 * are real rows.
 */
import { useCallback, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/schema';
import { isLive } from '../db/repo';
import { now } from '../db/ids';
import { useSetting } from './useSetting';
import type { ShoppingCategory, PantryItem } from '../db/types';

type Updater<T> = T | ((previous: T) => T);

const DEFAULT_UNITS = [
  'lbs', 'oz', 'kg', 'g', 'can', 'bottle', 'pack', 'dozen',
  'bunch', 'bag', 'box', 'jar', 'gallon', 'liter', 'cup',
  'pint', 'quart', 'piece', 'slice', 'head', 'clove', 'stalk',
];

const EMPTY_CATEGORIES: ShoppingCategory[] = [];
const EMPTY_PANTRY: PantryItem[] = [];

function resolve<T>(update: Updater<T>, previous: T): T {
  return typeof update === 'function' ? (update as (p: T) => T)(previous) : update;
}

export function useShoppingPrefs() {
  const categoryRows = useLiveQuery(() => db.shoppingCategories.toArray(), []);
  const pantryRows = useLiveQuery(() => db.pantry.toArray(), []);
  const [storedUnits, setUnits] = useSetting('shoppingUnits', DEFAULT_UNITS);

  const categories = useMemo(
    () => (categoryRows ? categoryRows.filter(isLive) : EMPTY_CATEGORIES),
    [categoryRows],
  );
  const pantryItems = useMemo(
    () => (pantryRows ? pantryRows.filter(isLive) : EMPTY_PANTRY),
    [pantryRows],
  );
  // A migrated user can arrive with an empty array saved; fall back so the unit
  // picker is never blank.
  const units = storedUnits.length ? storedUnits : DEFAULT_UNITS;

  const setCategories = useCallback((next: ShoppingCategory[]) => {
    void (async () => {
      const current = (await db.shoppingCategories.toArray()).filter(isLive);
      const timestamp = now();
      const keep = new Set(next.map(c => c.id));
      await db.shoppingCategories.bulkPut([
        ...next.map(c => ({ ...c, updatedAt: timestamp, deletedAt: null })),
        ...current
          .filter(c => !keep.has(c.id))
          .map(c => ({ ...c, deletedAt: timestamp, updatedAt: timestamp })),
      ]);
    })();
  }, []);

  const setPantryItems = useCallback((update: Updater<PantryItem[]>) => {
    void (async () => {
      const current = (await db.pantry.toArray()).filter(isLive);
      const next = resolve(update, current);
      const timestamp = now();
      const keep = new Set(next.map(p => p.id));
      await db.pantry.bulkPut([
        ...next.map(p => ({ ...p, updatedAt: timestamp, deletedAt: null })),
        ...current
          .filter(p => !keep.has(p.id))
          .map(p => ({ ...p, deletedAt: timestamp, updatedAt: timestamp })),
      ]);
    })();
  }, []);

  return { categories, setCategories, pantryItems, setPantryItems, units, setUnits };
}
