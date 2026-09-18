import { describe, it, expect, beforeEach } from 'vitest';
import { db } from './schema';
import { bootDatabase, resetBootForTests } from './boot';

async function wipe(): Promise<void> {
  await db.open();
  await Promise.all(db.tables.map(t => t.clear()));
}

describe('bootDatabase', () => {
  beforeEach(async () => {
    await wipe();
    resetBootForTests();
    localStorage.clear();
  });

  it('seeds a first-time user with categories, tasks and a shopping list', async () => {
    await bootDatabase();

    expect(await db.categories.count()).toBe(4);
    expect(await db.tasks.count()).toBe(4);
    expect(await db.shoppingLists.count()).toBe(1);
    expect(await db.budgetCategories.count()).toBeGreaterThan(0);
    expect(await db.shoppingCategories.count()).toBeGreaterThan(0);
  });

  it('gives seeded rows the audit columns', async () => {
    await bootDatabase();

    const task = (await db.tasks.toArray())[0]!;
    expect(task.deletedAt).toBeNull();
    expect(task.updatedAt).toEqual(expect.any(String));
    // Fields the older code did not have must still be present.
    expect(task.completedDates).toEqual({});
    expect(task.recurrence).toBeNull();
  });

  it('does not resurrect sample tasks the user deleted', async () => {
    await bootDatabase();
    expect(await db.tasks.count()).toBe(4);

    // The user clears every sample task, then reloads the page.
    await db.tasks.clear();
    resetBootForTests();
    await bootDatabase();

    expect(await db.tasks.count()).toBe(0);
  });

  it('does not resurrect budget categories the user deleted', async () => {
    await bootDatabase();
    expect(await db.budgetCategories.count()).toBeGreaterThan(0);

    await db.budgetCategories.clear();
    resetBootForTests();
    await bootDatabase();

    expect(await db.budgetCategories.count()).toBe(0);
  });

  it('runs once per page load even when called concurrently', async () => {
    // Mirrors StrictMode's double-invoked effect: two callers, one boot.
    await Promise.all([bootDatabase(), bootDatabase(), bootDatabase()]);

    // A second boot would have doubled the seed.
    expect(await db.tasks.count()).toBe(4);
    expect(await db.categories.count()).toBe(4);
  });

  it('migrates legacy localStorage data instead of seeding over it', async () => {
    localStorage.setItem('mtp_tasks', JSON.stringify([
      { id: 'mine', title: 'My real task', date: '2026-09-18' },
    ]));

    await bootDatabase();

    // The user's one task must survive, and the 4 sample tasks must not appear
    // on top of it.
    expect(await db.tasks.count()).toBe(1);
    expect((await db.tasks.get('mine'))?.title).toBe('My real task');
  });
});
