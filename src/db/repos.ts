/**
 * Concrete repositories, one per table, plus the few operations that carry real
 * domain logic rather than plain CRUD.
 */
import { db } from './schema';
import { createRepo } from './repo';
import { newId, now } from './ids';
import type {
  Task, Category, Note, LearningCourse, LearningGoal,
  ShoppingList, ShoppingItem, ShoppingHistoryEntry, ShoppingRecipe,
  ShoppingCategory, PantryItem, BudgetCategory, BudgetIncome,
  BudgetBill, BudgetExpense, SettingKey, SettingsMap, SettingRow,
  DateOnly, WeeklyData,
} from './types';

/* ── Plain CRUD repositories ────────────────────────────────────────────── */

export const tasksRepo = createRepo<Task, 'id'>(db.tasks);
export const categoriesRepo = createRepo<Category, 'id'>(db.categories);
export const notesRepo = createRepo<Note, 'id'>(db.notes);
export const coursesRepo = createRepo<LearningCourse, 'id'>(db.learningCourses);
export const goalsRepo = createRepo<LearningGoal, 'id'>(db.learningGoals);
export const listsRepo = createRepo<ShoppingList, 'id'>(db.shoppingLists);
export const itemsRepo = createRepo<ShoppingItem, 'id'>(db.shoppingItems);
export const historyRepo = createRepo<ShoppingHistoryEntry, 'name'>(db.shoppingHistory);
export const recipesRepo = createRepo<ShoppingRecipe, 'id'>(db.shoppingRecipes);
export const shopCategoriesRepo = createRepo<ShoppingCategory, 'id'>(db.shoppingCategories);
export const pantryRepo = createRepo<PantryItem, 'id'>(db.pantry);
export const budgetCategoriesRepo = createRepo<BudgetCategory, 'id'>(db.budgetCategories);
export const budgetIncomeRepo = createRepo<BudgetIncome, 'id'>(db.budgetIncome);
export const budgetBillsRepo = createRepo<BudgetBill, 'id'>(db.budgetBills);
export const budgetExpensesRepo = createRepo<BudgetExpense, 'id'>(db.budgetExpenses);

/* ── Settings ───────────────────────────────────────────────────────────── */

export async function getSetting<K extends SettingKey>(
  key: K,
  fallback: SettingsMap[K],
): Promise<SettingsMap[K]> {
  const row = await db.settings.get(key);
  return row ? (row.value as SettingsMap[K]) : fallback;
}

export async function setSetting<K extends SettingKey>(
  key: K,
  value: SettingsMap[K],
): Promise<void> {
  await db.settings.put({ key, value, updatedAt: now() } as SettingRow);
}

/* ── Tasks ──────────────────────────────────────────────────────────────── */

/** Field defaults for a newly created task, so callers supply only what varies. */
const TASK_DEFAULTS = {
  title: '', priority: 'medium' as const, categoryId: 'personal',
  date: '', startTime: '', duration: 30, tags: [] as string[],
  reminder: false, reminderOffsets: [] as number[],
  completed: false, completedAt: null, description: '', location: '',
  endDate: null, endTime: '', recurrence: null,
  completedDates: {} as Record<DateOnly, boolean>,
};

export type NewTaskInput = Partial<Omit<Task, 'id' | 'updatedAt' | 'deletedAt' | 'createdAt'>>;

export async function addTask(input: NewTaskInput): Promise<string> {
  const id = newId();
  await tasksRepo.put({
    ...TASK_DEFAULTS,
    ...input,
    id,
    createdAt: now(),
  } as Omit<Task, 'updatedAt' | 'deletedAt'>);
  return id;
}

/**
 * Toggles completion for `date`.
 *
 * Recurring tasks have no single completed state — they are done or not done on
 * a particular day — so they flip an entry in `completedDates` while one-off
 * tasks flip the `completed` flag.
 */
export async function toggleTask(id: string, date: DateOnly): Promise<void> {
  const task = await tasksRepo.get(id);
  if (!task) return;

  if (task.recurrence?.days.length) {
    const completedDates = { ...task.completedDates };
    if (completedDates[date]) delete completedDates[date];
    else completedDates[date] = true;
    await tasksRepo.patch(id, { completedDates });
    return;
  }

  const completed = !task.completed;
  await tasksRepo.patch(id, {
    completed,
    completedAt: completed ? now() : null,
  });
}

/**
 * Per-day totals derived from the current tasks.
 *
 * This was previously stored as its own `mtp_weekly` blob kept in sync by hand
 * on every task write, which could drift from the tasks it described. It is
 * pure derived data, so it is computed instead.
 */
export function tallyByDate(tasks: Task[]): WeeklyData {
  const tally: WeeklyData = {};
  for (const task of tasks) {
    if (!task.date) continue;
    const day = (tally[task.date] ??= { total: 0, completed: 0 });
    day.total++;
    if (task.completed) day.completed++;
  }
  return tally;
}

/* ── Notes ──────────────────────────────────────────────────────────────── */

export async function addNote(date: DateOnly): Promise<string> {
  const id = newId();
  await notesRepo.put({ id, date, text: '', color: 'yellow' });
  return id;
}
