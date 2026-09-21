/**
 * Database boot: open, migrate, seed.
 *
 * Runs exactly once per page load. The promise is memoised, so React
 * StrictMode's double-invoked effects — and any component that asks
 * independently — all await the same run rather than racing each other.
 */
import { db } from './schema';
import { migrateFromLocalStorage } from './migrate';
import { newId, now } from './ids';
import { DEFAULT_BUDGET_CATEGORIES } from '../data/budgetCategories.js';
import { CATEGORIES as SHOPPING_CATEGORIES } from '../data/shoppingCategories.js';
import { ensureDefaultStoreCategories } from './storeOps';
import { reconcileCatalog } from './catalog';
import type { BudgetCategory, Category, Task } from './types';

const DEFAULT_CATEGORIES: Omit<Category, 'updatedAt' | 'deletedAt'>[] = [
  { id: 'work', name: 'Work', color: '#7c66ff' },
  { id: 'personal', name: 'Personal', color: '#22d3ee' },
  { id: 'health', name: 'Health', color: '#10b981' },
  { id: 'learning', name: 'Learning', color: '#f59e0b' },
];

/** The starter tasks a brand-new user sees, matching the previous seed. */
function seedTasks(today: string): Omit<Task, 'updatedAt' | 'deletedAt'>[] {
  const base = {
    tags: [] as string[], reminder: false, reminderOffsets: [] as number[],
    completed: false, completedAt: null, description: '', location: '',
    endDate: null, endTime: '', recurrence: null,
    completedDates: {} as Record<string, boolean>, createdAt: now(),
  };
  return [
    { ...base, id: newId(), title: 'Morning review', priority: 'high', categoryId: 'work', date: today, startTime: '09:00', duration: 30, tags: ['focus'], reminder: true, reminderOffsets: [5], description: 'Review emails and plan the day' },
    { ...base, id: newId(), title: 'Team standup', priority: 'medium', categoryId: 'work', date: today, startTime: '10:00', duration: 15, tags: ['meeting'] },
    { ...base, id: newId(), title: 'Lunch walk', priority: 'low', categoryId: 'health', date: today, startTime: '13:00', duration: 30 },
    { ...base, id: newId(), title: 'Read 30 pages', priority: 'medium', categoryId: 'learning', date: today, startTime: '21:00', duration: 45, tags: ['books'], reminder: true, reminderOffsets: [5] },
  ];
}

/**
 * Fills in what a first-time user needs.
 *
 * Only ever *adds* — seeding must never overwrite an existing row, or a user
 * who deleted the sample tasks would find them back on next launch.
 */
async function seedIfEmpty(): Promise<void> {
  const timestamp = now();

  if (await db.categories.count() === 0) {
    await db.categories.bulkPut(
      DEFAULT_CATEGORIES.map(c => ({ ...c, updatedAt: timestamp, deletedAt: null })),
    );
  }

  // Seed tasks only for a genuinely untouched database. A user with zero tasks
  // who has used the app before deleted them on purpose.
  const untouched = await db.meta.get('seeded');
  if (!untouched && await db.tasks.count() === 0) {
    const today = new Date().toISOString().split('T')[0]!;
    await db.tasks.bulkPut(
      seedTasks(today).map(t => ({ ...t, updatedAt: timestamp, deletedAt: null })),
    );
  }
  await db.meta.put({ key: 'seeded', value: timestamp });

  if (await db.shoppingLists.count() === 0) {
    await db.shoppingLists.put({
      id: 'default', name: 'Grocery', budget: null, storeId: null,
      createdAt: timestamp, updatedAt: timestamp, deletedAt: null,
    });
  }

  // Budget categories used to be a read-time fallback inside BudgetView. Now
  // they are seeded once and recorded, so clearing them stays cleared.
  if (!await db.meta.get('budgetSeeded')) {
    if (await db.budgetCategories.count() === 0) {
      await db.budgetCategories.bulkPut(
        DEFAULT_BUDGET_CATEGORIES.map(c => ({
          ...c,
          type: c.type as BudgetCategory['type'],
          updatedAt: timestamp,
          deletedAt: null,
        })),
      );
    }
    await db.meta.put({ key: 'budgetSeeded', value: timestamp });
  }

  if (await db.shoppingCategories.count() === 0) {
    await db.shoppingCategories.bulkPut(
      SHOPPING_CATEGORIES.map(c => ({ ...c, updatedAt: timestamp, deletedAt: null })),
    );
  }
}

let bootPromise: Promise<void> | null = null;

export function bootDatabase(): Promise<void> {
  bootPromise ??= (async () => {
    await db.open();
    const migration = await migrateFromLocalStorage(db);
    await seedIfEmpty();
    await ensureDefaultStoreCategories();
    // Give every list item a product. History is only turned into products the
    // once, right after it was created from localStorage: doing it on every boot
    // would resurrect any product the user had deleted.
    await reconcileCatalog(db, { seedLegacy: migration.migrated });
  })();
  return bootPromise;
}

/** Test seam — lets a test reset the memoised boot. */
export function resetBootForTests(): void {
  bootPromise = null;
}
