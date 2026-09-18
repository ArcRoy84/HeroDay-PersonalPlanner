/**
 * Domain types for HeroDay's persisted data.
 *
 * These mirror the shapes the app already writes to localStorage. They are the
 * contract between the Dexie tables, the repositories and the components — if a
 * shape changes, it changes here first and the compiler finds the callers.
 *
 * Sync-readiness: every user-owned row carries `updatedAt` and `deletedAt`.
 * Nothing reads them yet (this is the single-user Free tier, no sync engine),
 * but adding them later would mean a second schema migration over live user
 * data, so they are here from version 1. `deletedAt` means rows are soft
 * deleted — a hard delete is invisible to a future sync and would resurrect
 * from another device.
 */

/** ISO-8601 instant, e.g. `2026-09-18T21:00:00.000Z`. */
export type Timestamp = string;
/** Calendar day, `YYYY-MM-DD`. The app keys tasks and notes by this. */
export type DateOnly = string;
/** Wall-clock time of day, `HH:MM`. */
export type TimeOnly = string;
/** Month bucket, `YYYY-MM`. */
export type MonthOnly = string;

/** Audit columns carried by every user-owned row. */
export interface Auditable {
  updatedAt: Timestamp;
  /** Soft-delete marker. `null` for live rows. */
  deletedAt: Timestamp | null;
}

/* ── Planner ────────────────────────────────────────────────────────────── */

export type Priority = 'high' | 'medium' | 'low';

/** Weekly repeat rule. `days` holds day-of-week indices, 0 = Sunday. */
export interface Recurrence {
  days: number[];
}

export interface Task extends Auditable {
  id: string;
  title: string;
  priority: Priority;
  categoryId: string;
  date: DateOnly;
  startTime: TimeOnly;
  duration: number;
  tags: string[];
  /** Kept in sync with `reminderOffsets.length > 0` by the task modal. */
  reminder: boolean;
  /** Minutes before `startTime` to notify. Supersedes the boolean `reminder`. */
  reminderOffsets: number[];
  completed: boolean;
  completedAt: Timestamp | null;
  description: string;
  location: string;
  /** Multi-day tasks span `date`..`endDate`; `null` for single-day. */
  endDate: DateOnly | null;
  endTime: TimeOnly;
  /** `null` when the task does not repeat. */
  recurrence: Recurrence | null;
  /**
   * Per-day completion for recurring tasks, keyed by date. A recurring task
   * has no single `completed` state — it is done or not done *on a given day*.
   */
  completedDates: Record<DateOnly, boolean>;
  createdAt: Timestamp;
}

export interface Category extends Auditable {
  id: string;
  name: string;
  color: string;
}

export interface Note extends Auditable {
  id: string;
  /** Replaces the old per-day `mtp_notes_${date}` localStorage keys. */
  date: DateOnly;
  text: string;
  color: string;
}

/* ── Learning ───────────────────────────────────────────────────────────── */

export type CourseMode = 'checklist' | 'progress';

export interface Lesson {
  id: string;
  text: string;
  notes: string;
  done: boolean;
  completedAt: Timestamp | null;
}

export interface LearningCourse extends Auditable {
  id: string;
  title: string;
  categoryId: string;
  provider: string;
  mode: CourseMode;
  targetDate: DateOnly | null;
  weeklyHours: number | null;
  goalId: string | null;
  notes: string;
  lessons: Lesson[];
  progress: number;
  createdAt: Timestamp;
}

export interface LearningGoal extends Auditable {
  id: string;
  title: string;
  motivation: string;
  targetDate: DateOnly | null;
  createdAt: Timestamp;
}

/* ── Shopping ───────────────────────────────────────────────────────────── */

export interface ShoppingList extends Auditable {
  id: string;
  name: string;
  budget: number | null;
  createdAt: Timestamp;
}

/**
 * Lifted out of the nested `list.items` array so items are addressable and
 * indexable on their own. `listId` is the former containment relationship.
 */
export interface ShoppingItem extends Auditable {
  id: string;
  listId: string;
  name: string;
  qty: number;
  unit: string;
  category: string;
  storeLocation: string;
  note: string;
  estimatedPrice: number | null;
  barcode: string;
  checked: boolean;
  addedAt: Timestamp;
}

/**
 * Purchase frequency, keyed by lowercased name rather than a generated id —
 * that is how the existing code dedupes entries, so `name` is the primary key.
 */
export interface ShoppingHistoryEntry extends Auditable {
  name: string;
  unit: string;
  category: string;
  estimatedPrice: number | null;
  barcode: string;
  count: number;
  lastBought: Timestamp;
}

export interface RecipeIngredient {
  name: string;
  qty: number;
  unit: string;
  category?: string;
}

export interface ShoppingRecipe extends Auditable {
  id: string;
  name: string;
  servings: number;
  ingredients: RecipeIngredient[];
  createdAt: Timestamp;
}

export interface ShoppingCategory extends Auditable {
  id: string;
  label: string;
  emoji: string;
  color: string;
}

export interface PantryItem extends Auditable {
  id: string;
  name: string;
  qty: number;
  unit: string;
  category: string;
  /** Restock threshold — "par level" in inventory terms. */
  parQty: number;
}

/* ── Budget ─────────────────────────────────────────────────────────────── */

export type BudgetCategoryType = 'need' | 'want' | 'saving';

export interface BudgetCategory extends Auditable {
  id: string;
  name: string;
  emoji: string;
  type: BudgetCategoryType;
  allocated: number;
}

export type IncomeFrequency = 'monthly' | 'biweekly' | 'weekly' | 'yearly' | 'once';

export interface BudgetIncome extends Auditable {
  id: string;
  source: string;
  amount: number;
  frequency: IncomeFrequency;
}

export interface BudgetBill extends Auditable {
  id: string;
  name: string;
  emoji: string;
  amount: number;
  categoryId: string;
  /** Day of month, 1-31. */
  dueDay: number;
}

export interface BudgetExpense extends Auditable {
  id: string;
  amount: number;
  payee: string;
  categoryId: string;
  date: DateOnly;
  note: string;
  createdAt: Timestamp;
}

/* ── Settings & singletons ──────────────────────────────────────────────── */

export interface Streak {
  count: number;
  lastDate: DateOnly | null;
}

export interface WeatherLocation {
  name: string;
  latitude: number;
  longitude: number;
}

export type ThemeName = 'dark' | 'light';
export type TemperatureUnit = 'fahrenheit' | 'celsius';
export type ViewName = string;

export interface BudgetSettings {
  methodology: string;
  cashOnHand: number;
}

/** Task totals per ISO date, derived from `tasks` and used by the stats panel. */
export interface DayTally {
  total: number;
  completed: number;
}
export type WeeklyData = Record<DateOnly, DayTally>;

/**
 * Small singleton values live in one `settings` table keyed by name, rather
 * than one table each. This map types that table: `getSetting('theme')`
 * returns `ThemeName`, not `unknown`.
 */
export interface SettingsMap {
  theme: ThemeName;
  view: ViewName;
  streak: Streak;
  learningStreak: Streak;
  weeklyData: WeeklyData;
  weatherLocation: WeatherLocation | null;
  weatherUnit: TemperatureUnit;
  shoppingUnits: string[];
  budgetSettings: BudgetSettings;
}

export type SettingKey = keyof SettingsMap;

/** Row shape of the `settings` table. */
export interface SettingRow<K extends SettingKey = SettingKey> {
  key: K;
  value: SettingsMap[K];
  updatedAt: Timestamp;
}

/** Internal bookkeeping — migration markers, schema provenance. */
export interface MetaRow {
  key: string;
  value: unknown;
}
