/**
 * Budget module state.
 *
 * `BudgetView.jsx` drives four collections plus a settings object through
 * `setX(prev => next)` updaters. Those signatures are preserved here so the
 * component's own logic is untouched — only its storage moves off the private
 * `mtp_budget_*` localStorage keys it used to own.
 */
import { useCallback, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/schema';
import { isLive } from '../db/repo';
import { now } from '../db/ids';
import { useSetting } from './useSetting';
import type {
  BudgetCategory, BudgetIncome, BudgetBill, BudgetExpense, BudgetSettings,
} from '../db/types';
import type { EntityTable } from 'dexie';

type Updater<T> = T | ((previous: T) => T);
type Auditables = { updatedAt: string; deletedAt: string | null };

const DEFAULT_SETTINGS: BudgetSettings = { methodology: 'zero-based', cashOnHand: 0 };

const EMPTY_CATEGORIES: BudgetCategory[] = [];
const EMPTY_INCOME: BudgetIncome[] = [];
const EMPTY_BILLS: BudgetBill[] = [];
const EMPTY_EXPENSES: BudgetExpense[] = [];

function resolve<T>(update: Updater<T>, previous: T): T {
  return typeof update === 'function' ? (update as (p: T) => T)(previous) : update;
}

/**
 * Builds a `setX(prev => next)` setter backed by a table.
 *
 * Like the shopping bridge, this reconciles a whole desired array rather than
 * inferring which operation the caller performed: rows in `next` are written,
 * rows missing from it are soft-deleted.
 */
function useCollectionSetter<T extends Auditables, K extends keyof T & string>(
  table: EntityTable<T, K>,
  key: K,
) {
  return useCallback((update: Updater<T[]>) => {
    void (async () => {
      const current = (await table.toArray()).filter(isLive);
      const next = resolve(update, current);
      const timestamp = now();
      const keep = new Set(next.map(row => row[key]));
      await table.bulkPut([
        ...next.map(row => ({ ...row, updatedAt: timestamp, deletedAt: null })),
        ...current
          .filter(row => !keep.has(row[key]))
          .map(row => ({ ...row, deletedAt: timestamp, updatedAt: timestamp })),
      ] as T[]);
    })();
  }, [table, key]);
}

export function useBudget() {
  const categoryRows = useLiveQuery(() => db.budgetCategories.toArray(), []);
  const incomeRows = useLiveQuery(() => db.budgetIncome.toArray(), []);
  const billRows = useLiveQuery(() => db.budgetBills.toArray(), []);
  const expenseRows = useLiveQuery(() => db.budgetExpenses.toArray(), []);
  const [settings, setSettings] = useSetting('budgetSettings', DEFAULT_SETTINGS);

  const categories = useMemo(
    () => (categoryRows ? categoryRows.filter(isLive) : EMPTY_CATEGORIES),
    [categoryRows],
  );
  const income = useMemo(
    () => (incomeRows ? incomeRows.filter(isLive) : EMPTY_INCOME),
    [incomeRows],
  );
  const bills = useMemo(
    () => (billRows ? billRows.filter(isLive) : EMPTY_BILLS),
    [billRows],
  );
  const expenses = useMemo(
    () => (expenseRows ? expenseRows.filter(isLive) : EMPTY_EXPENSES),
    [expenseRows],
  );

  const setCategories = useCollectionSetter(db.budgetCategories, 'id');
  const setIncome = useCollectionSetter(db.budgetIncome, 'id');
  const setBills = useCollectionSetter(db.budgetBills, 'id');
  const setExpenses = useCollectionSetter(db.budgetExpenses, 'id');

  return {
    categories, income, bills, expenses, settings,
    setCategories, setIncome, setBills, setExpenses, setSettings,
  };
}
