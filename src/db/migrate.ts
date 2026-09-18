/**
 * One-time migration of the legacy `mtp_*` localStorage payloads into Dexie.
 *
 * Three properties matter here, because this is the only step in the whole
 * project that can destroy user data:
 *
 *  1. **Idempotent.** React StrictMode invokes effects twice in development, and
 *     a user can have two tabs open. Completion is recorded in `meta`, and the
 *     whole copy runs inside a single Dexie transaction, so a crash halfway
 *     leaves nothing behind and the next attempt starts clean.
 *  2. **Non-destructive.** localStorage is *not* cleared. It stays as a manual
 *     escape hatch for a release or two.
 *  3. **Recoverable.** A verbatim snapshot of every legacy key is written to
 *     `meta.legacyBackup` before anything is transformed, so a bad transform is
 *     recoverable without the user having exported anything.
 */
import type { HeroDayDB } from './schema';
import { newId, now } from './ids';
import type {
  Task, Category, Note, LearningCourse, LearningGoal,
  ShoppingList, ShoppingItem, ShoppingHistoryEntry, ShoppingRecipe,
  ShoppingCategory, PantryItem, BudgetCategory, BudgetIncome,
  BudgetBill, BudgetExpense, SettingRow, SettingKey, SettingsMap,
} from './types';

export const MIGRATION_KEY = 'migratedFromLocalStorage@v1';
const LEGACY_PREFIX = 'mtp_';
const NOTES_PREFIX = 'mtp_notes_';

/** Reads and JSON-parses a legacy key, returning `fallback` when absent or corrupt. */
function readLegacy<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    const parsed = JSON.parse(raw) as T;
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

/** Every `mtp_*` key currently in localStorage, verbatim. */
function snapshotLegacyKeys(): Record<string, string> {
  const snapshot: Record<string, string> = {};
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key || !key.startsWith(LEGACY_PREFIX)) continue;
      const value = localStorage.getItem(key);
      if (value !== null) snapshot[key] = value;
    }
  } catch {
    // Storage disabled entirely (private mode, blocked cookies) — nothing to migrate.
  }
  return snapshot;
}

/** Stamps the audit columns onto a legacy record that never had them. */
function audited<T extends object>(row: T, timestamp: string): T & { updatedAt: string; deletedAt: null } {
  return { ...row, updatedAt: timestamp, deletedAt: null };
}

/** Legacy rows are untyped JSON; this narrows without trusting the contents. */
function asArray(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? (value as Record<string, unknown>[]) : [];
}

export interface MigrationResult {
  /** False when the migration had already run — nothing was written. */
  migrated: boolean;
  /** Rows written, by table. Empty when `migrated` is false. */
  counts: Record<string, number>;
}

/**
 * Copies legacy localStorage data into `db`. Safe to call on every boot.
 */
export async function migrateFromLocalStorage(db: HeroDayDB): Promise<MigrationResult> {
  const already = await db.meta.get(MIGRATION_KEY);
  if (already) return { migrated: false, counts: {} };

  const ts = now();
  const backup = snapshotLegacyKeys();

  /* ── Read every legacy slice up front ─────────────────────────────────── */

  const legacyTasks = asArray(readLegacy('mtp_tasks', []));
  const legacyCategories = asArray(readLegacy('mtp_categories', []));
  const legacyCourses = asArray(readLegacy('mtp_learning_courses', []));
  const legacyGoals = asArray(readLegacy('mtp_learning_goals', []));
  const legacyLists = asArray(readLegacy('mtp_shop_lists', []));
  const legacyHistory = asArray(readLegacy('mtp_shop_history', []));
  const legacyRecipes = asArray(readLegacy('mtp_shop_recipes', []));
  const legacyShopCats = asArray(readLegacy('mtp_shop_categories', []));
  const legacyPantry = asArray(readLegacy('mtp_pantry', []));
  const legacyBudgetCats = asArray(readLegacy('mtp_budget_categories', []));
  const legacyIncome = asArray(readLegacy('mtp_budget_income', []));
  const legacyBills = asArray(readLegacy('mtp_budget_bills', []));
  const legacyExpenses = asArray(readLegacy('mtp_budget_expenses', []));

  /* ── Shopping lists: split the nested items array into its own table ───── */

  const lists: ShoppingList[] = [];
  const items: ShoppingItem[] = [];
  for (const raw of legacyLists) {
    const listId = typeof raw.id === 'string' ? raw.id : newId();
    lists.push(audited({
      id: listId,
      name: typeof raw.name === 'string' ? raw.name : 'Untitled',
      budget: typeof raw.budget === 'number' ? raw.budget : null,
      createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : ts,
    }, ts));

    for (const rawItem of asArray(raw.items)) {
      items.push(audited({
        id: typeof rawItem.id === 'string' ? rawItem.id : newId(),
        listId,
        name: typeof rawItem.name === 'string' ? rawItem.name : '',
        qty: typeof rawItem.qty === 'number' ? rawItem.qty : 1,
        unit: typeof rawItem.unit === 'string' ? rawItem.unit : '',
        category: typeof rawItem.category === 'string' ? rawItem.category : 'other',
        storeLocation: typeof rawItem.storeLocation === 'string' ? rawItem.storeLocation : '',
        note: typeof rawItem.note === 'string' ? rawItem.note : '',
        estimatedPrice: typeof rawItem.estimatedPrice === 'number' ? rawItem.estimatedPrice : null,
        barcode: typeof rawItem.barcode === 'string' ? rawItem.barcode : '',
        checked: rawItem.checked === true,
        addedAt: typeof rawItem.addedAt === 'string' ? rawItem.addedAt : ts,
      }, ts));
    }
  }

  /* ── Sticky notes: collapse the unbounded mtp_notes_<date> keys ────────── */

  const notes: Note[] = [];
  for (const [key, rawValue] of Object.entries(backup)) {
    if (!key.startsWith(NOTES_PREFIX)) continue;
    const date = key.slice(NOTES_PREFIX.length);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
    let parsed: unknown;
    try { parsed = JSON.parse(rawValue); } catch { continue; }
    for (const rawNote of asArray(parsed)) {
      notes.push(audited({
        id: typeof rawNote.id === 'string' ? rawNote.id : newId(),
        date,
        text: typeof rawNote.text === 'string' ? rawNote.text : '',
        color: typeof rawNote.color === 'string' ? rawNote.color : 'yellow',
      }, ts));
    }
  }

  /* ── Singletons ───────────────────────────────────────────────────────── */

  const settingRows: SettingRow[] = [];
  const setting = <K extends SettingKey>(key: K, value: SettingsMap[K]) => {
    settingRows.push({ key, value, updatedAt: ts } as SettingRow);
  };
  setting('theme', readLegacy('mtp_theme', 'dark'));
  setting('view', readLegacy('mtp_view', 'checklist'));
  setting('streak', readLegacy('mtp_streak', { count: 0, lastDate: null }));
  setting('learningStreak', readLegacy('mtp_learning_streak', { count: 0, lastDate: null }));
  setting('weeklyData', readLegacy('mtp_weekly', {}));
  setting('weatherLocation', readLegacy('mtp_weather_loc', null));
  setting('weatherUnit', readLegacy('mtp_weather_unit', 'fahrenheit'));
  setting('shoppingUnits', readLegacy('mtp_shop_units', []));
  setting('budgetSettings', readLegacy('mtp_budget_settings', { methodology: 'zero-based', cashOnHand: 0 }));

  /* ── Write it all in one transaction ──────────────────────────────────── */

  const tasks = legacyTasks.map(t => audited(t, ts)) as unknown as Task[];
  const categories = legacyCategories.map(c => audited(c, ts)) as unknown as Category[];
  const courses = legacyCourses.map(c => audited({ lessons: [], progress: 0, ...c }, ts)) as unknown as LearningCourse[];
  const goals = legacyGoals.map(g => audited(g, ts)) as unknown as LearningGoal[];
  const history = legacyHistory.map(h => audited(h, ts)) as unknown as ShoppingHistoryEntry[];
  const recipes = legacyRecipes.map(r => audited(r, ts)) as unknown as ShoppingRecipe[];
  const shopCats = legacyShopCats.map(c => audited(c, ts)) as unknown as ShoppingCategory[];
  const pantry = legacyPantry.map(p => audited(p, ts)) as unknown as PantryItem[];
  const budgetCats = legacyBudgetCats.map(c => audited(c, ts)) as unknown as BudgetCategory[];
  const income = legacyIncome.map(i => audited(i, ts)) as unknown as BudgetIncome[];
  const bills = legacyBills.map(b => audited(b, ts)) as unknown as BudgetBill[];
  const expenses = legacyExpenses.map(e => audited(e, ts)) as unknown as BudgetExpense[];

  await db.transaction('rw', db.tables, async () => {
    // Re-check inside the transaction: two tabs booting at once would both pass
    // the check above, but only one can win this one.
    if (await db.meta.get(MIGRATION_KEY)) return;

    await Promise.all([
      db.tasks.bulkPut(tasks),
      db.categories.bulkPut(categories),
      db.notes.bulkPut(notes),
      db.learningCourses.bulkPut(courses),
      db.learningGoals.bulkPut(goals),
      db.shoppingLists.bulkPut(lists),
      db.shoppingItems.bulkPut(items),
      db.shoppingHistory.bulkPut(history),
      db.shoppingRecipes.bulkPut(recipes),
      db.shoppingCategories.bulkPut(shopCats),
      db.pantry.bulkPut(pantry),
      db.budgetCategories.bulkPut(budgetCats),
      db.budgetIncome.bulkPut(income),
      db.budgetBills.bulkPut(bills),
      db.budgetExpenses.bulkPut(expenses),
      db.settings.bulkPut(settingRows),
    ]);

    await db.meta.bulkPut([
      { key: 'legacyBackup', value: backup },
      { key: MIGRATION_KEY, value: { at: ts, keys: Object.keys(backup).length } },
    ]);
  });

  return {
    migrated: true,
    counts: {
      tasks: tasks.length,
      categories: categories.length,
      notes: notes.length,
      learningCourses: courses.length,
      learningGoals: goals.length,
      shoppingLists: lists.length,
      shoppingItems: items.length,
      shoppingHistory: history.length,
      shoppingRecipes: recipes.length,
      shoppingCategories: shopCats.length,
      pantry: pantry.length,
      budgetCategories: budgetCats.length,
      budgetIncome: income.length,
      budgetBills: bills.length,
      budgetExpenses: expenses.length,
      settings: settingRows.length,
    },
  };
}
