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
  /**
   * The store this list is for, or `null` for a plain list ("Party", "Weekly").
   * Optional by design: several lists can share one store (Costco - Weekly,
   * Costco - Bulk), and lists that predate stores stay valid without a store.
   * Rows written before stores existed have no value at all, so read it as
   * `list.storeId ?? null`.
   */
  storeId: string | null;
  createdAt: Timestamp;
}

/**
 * A place you shop — the thing a list can be linked to.
 *
 * Distinct from `ShoppingItem.storeLocation`, which is *where inside a store*
 * an item lives ("Aisle 4", "Deli Counter").
 */
export interface Store extends Auditable {
  id: string;
  name: string;
  /** Emoji shown when there is no `logo`. Defaults to the category's emoji. */
  icon: string;
  /**
   * Optional uploaded logo as a resized JPEG data URL. A string rather than a
   * Blob on purpose: the JSON backup uses JSON.stringify, which turns a Blob
   * into `{}`, so a Blob logo would vanish from every export.
   */
  logo: string | null;
  categoryId: string;
  address: string;
  city: string;
  /** State, province or region. */
  region: string;
  postalCode: string;
  country: string;
  lat: number | null;
  lon: number | null;
  /** Free text, e.g. "Mon–Sat 8–20, Sun 9–14". */
  hours: string;
  notes: string;
  createdAt: Timestamp;
  /** Set on sample data only, so "remove sample data" can find exactly it. */
  demo?: boolean;
}

/** Editable type of store: Supermarket, Bakery, Hardware Store… */
export interface StoreCategory extends Auditable {
  id: string;
  label: string;
  emoji: string;
  color: string;
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
  /**
   * The catalog product this row is an instance of. `null` until linked; rows
   * written before the catalog existed have no value at all, so read it as
   * `item.productId ?? null`.
   */
  productId: string | null;
  checked: boolean;
  addedAt: Timestamp;
}

/* ── Catalog ────────────────────────────────────────────────────────────── */

/**
 * A thing you buy, independent of any list. List items are *instances* of a
 * product; the Items section is a view of these, with analytics computed from
 * the purchase log.
 */
export interface Product extends Auditable {
  id: string;
  name: string;
  /**
   * `name` normalised (trimmed, lower-cased, whitespace collapsed). Kept as a
   * column so list items can be matched to products by an index lookup.
   */
  nameKey: string;
  /** A shopping category id — the same ids list items use. */
  category: string;
  brand: string;
  /** Free text: "1 gal", "500 g", "6-pack". Distinguishes similar products. */
  packageSize: string;
  barcode: string;
  /**
   * Optional photo as a resized JPEG data URL — a string, not a Blob, because
   * the JSON backup would turn a Blob into `{}`.
   */
  photo: string | null;
  notes: string;
  /**
   * How many times this was bought before purchase tracking began. Carried over
   * from the old per-name history, which recorded a count and a last date but
   * no dates for the earlier ones, so they cannot be turned into purchases.
   */
  priorPurchases: number;
  createdAt: Timestamp;
  demo?: boolean;
}

/** Where a purchase record came from. */
export type PurchaseSource =
  /** Ticking an item off a list. */
  | 'tick'
  /** Logged by hand, e.g. from a receipt. */
  | 'manual'
  /** Carried over from the pre-catalog history: a date, but no price or store. */
  | 'legacy';

/**
 * One purchase of a product. The log is append-only in spirit: editing a price
 * or store corrects a record, and a mistaken tick voids it.
 */
export interface Purchase extends Auditable {
  id: string;
  productId: string;
  /** The list item whose tick created this, so un-ticking can void it. */
  itemId: string | null;
  listId: string | null;
  /** Taken from the list's store when ticked; `null` when unknown. */
  storeId: string | null;
  /** Local calendar day of the purchase. */
  date: DateOnly;
  qty: number;
  /**
   * What was paid for the whole line. Unit price is `price / qty`, which is
   * what trends compare, so buying two instead of one does not look like a
   * price change. `null` when no price is known.
   */
  price: number | null;
  /**
   * True once the user has entered or confirmed the price. A price that was
   * merely pre-filled from an estimate is not confirmed, and analytics leave it
   * out — otherwise ignoring the prompt would fill the history with echoes of
   * the last price and hide real changes.
   */
  confirmed: boolean;
  source: PurchaseSource;
  createdAt: Timestamp;
  demo?: boolean;
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
  lat: number;
  lon: number;
}

/** Theme ids offered by the settings modal. */
export type ThemeName = 'dark' | 'light' | 'heroday' | 'heroday-light';
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
  /** Local display identity, shown in the header — not an account yet. */
  profileName: string;
  /** Data URL, resized like a store logo. Null shows the initials fallback. */
  profilePhoto: string | null;
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
