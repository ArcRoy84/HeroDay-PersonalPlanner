import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { HeroDayDB } from './schema';
import { migrateFromLocalStorage, MIGRATION_KEY } from './migrate';

/** A fresh database per test, so no test can see another's rows. */
let db: HeroDayDB;
let dbName: string;
let counter = 0;

beforeEach(() => {
  localStorage.clear();
  dbName = `heroday-test-${Date.now()}-${counter++}`;
  db = new HeroDayDB(dbName);
});

afterEach(async () => {
  db.close();
  await HeroDayDB.delete(dbName);
});

const seedLegacy = (entries: Record<string, unknown>) => {
  for (const [key, value] of Object.entries(entries)) {
    localStorage.setItem(key, JSON.stringify(value));
  }
};

describe('migrateFromLocalStorage', () => {
  it('copies tasks across with audit columns added', async () => {
    seedLegacy({
      mtp_tasks: [
        { id: 't1', title: 'Morning review', priority: 'high', categoryId: 'work',
          date: '2026-09-18', startTime: '09:00', duration: 30, tags: ['focus'],
          reminder: true, completed: false, description: '', createdAt: '2026-09-01T00:00:00.000Z' },
      ],
    });

    const result = await migrateFromLocalStorage(db);

    expect(result.migrated).toBe(true);
    expect(result.counts.tasks).toBe(1);

    const task = await db.tasks.get('t1');
    expect(task?.title).toBe('Morning review');
    expect(task?.deletedAt).toBeNull();
    expect(task?.updatedAt).toEqual(expect.any(String));
    // Original fields must survive untouched.
    expect(task?.tags).toEqual(['focus']);
    expect(task?.createdAt).toBe('2026-09-01T00:00:00.000Z');
  });

  it('backfills task fields that older rows predate', async () => {
    seedLegacy({
      mtp_tasks: [
        // A row from before reminderOffsets/recurrence/multi-day existed.
        { id: 'old', title: 'Legacy task', date: '2026-09-18', reminder: true },
      ],
    });

    await migrateFromLocalStorage(db);
    const task = await db.tasks.get('old');

    // The legacy boolean meant "5 minutes before".
    expect(task?.reminderOffsets).toEqual([5]);
    expect(task?.reminder).toBe(true);
    // Fields that did not exist must be present with sane defaults, not undefined.
    expect(task?.recurrence).toBeNull();
    expect(task?.completedDates).toEqual({});
    expect(task?.endDate).toBeNull();
    expect(task?.tags).toEqual([]);
    expect(task?.priority).toBe('medium');
    expect(task?.duration).toBe(30);
  });

  it('is idempotent — a second run writes nothing', async () => {
    seedLegacy({ mtp_tasks: [{ id: 't1', title: 'First' }] });

    const first = await migrateFromLocalStorage(db);
    expect(first.migrated).toBe(true);

    // Simulate the user editing the task after migration.
    await db.tasks.update('t1', { title: 'Edited after migration' });

    const second = await migrateFromLocalStorage(db);
    expect(second.migrated).toBe(false);

    // The re-run must not have clobbered the edit with the stale legacy value.
    const task = await db.tasks.get('t1');
    expect(task?.title).toBe('Edited after migration');
  });

  it('flattens nested shopping list items into their own table', async () => {
    seedLegacy({
      mtp_shop_lists: [
        {
          id: 'list1', name: 'Grocery', budget: 80, createdAt: '2026-09-01T00:00:00.000Z',
          items: [
            { id: 'i1', name: 'Milk', qty: 2, unit: 'gallon', category: 'dairy', checked: false },
            { id: 'i2', name: 'Bread', qty: 1, unit: '', category: 'bakery', checked: true },
          ],
        },
      ],
    });

    await migrateFromLocalStorage(db);

    const list = await db.shoppingLists.get('list1');
    expect(list?.name).toBe('Grocery');
    expect(list?.budget).toBe(80);
    // The nested array must not survive on the list row itself.
    expect((list as unknown as Record<string, unknown>).items).toBeUndefined();
    // Stores did not exist in the localStorage era.
    expect(list?.storeId).toBeNull();

    const items = await db.shoppingItems.where('listId').equals('list1').toArray();
    expect(items).toHaveLength(2);
    expect(items.map(i => i.name).sort()).toEqual(['Bread', 'Milk']);
    expect(items.find(i => i.id === 'i2')?.checked).toBe(true);
  });

  it('collapses the unbounded mtp_notes_<date> keys into one indexed table', async () => {
    seedLegacy({
      'mtp_notes_2026-09-17': [{ id: 'n1', text: 'Yesterday', color: 'yellow' }],
      'mtp_notes_2026-09-18': [
        { id: 'n2', text: 'Today A', color: 'blue' },
        { id: 'n3', text: 'Today B', color: 'pink' },
      ],
      // Not a date — must be ignored rather than creating a junk row.
      'mtp_notes_garbage': [{ id: 'n4', text: 'Nope', color: 'yellow' }],
    });

    await migrateFromLocalStorage(db);

    expect(await db.notes.count()).toBe(3);

    const today = await db.notes.where('date').equals('2026-09-18').toArray();
    expect(today).toHaveLength(2);
    expect(today.map(n => n.text).sort()).toEqual(['Today A', 'Today B']);

    expect(await db.notes.get('n4')).toBeUndefined();
  });

  it('stores singleton settings under typed keys', async () => {
    seedLegacy({
      mtp_theme: 'light',
      mtp_view: 'timeline',
      mtp_streak: { count: 5, lastDate: '2026-09-18' },
      mtp_weather_unit: 'celsius',
    });

    await migrateFromLocalStorage(db);

    expect((await db.settings.get('theme'))?.value).toBe('light');
    expect((await db.settings.get('view'))?.value).toBe('timeline');
    expect((await db.settings.get('streak'))?.value).toEqual({ count: 5, lastDate: '2026-09-18' });
    expect((await db.settings.get('weatherUnit'))?.value).toBe('celsius');
  });

  it('falls back to defaults for missing keys rather than failing', async () => {
    // Nothing seeded at all — a brand-new user.
    const result = await migrateFromLocalStorage(db);

    expect(result.migrated).toBe(true);
    expect(await db.tasks.count()).toBe(0);
    expect((await db.settings.get('theme'))?.value).toBe('dark');
  });

  it('survives corrupt JSON without losing the other slices', async () => {
    localStorage.setItem('mtp_tasks', '{ this is not valid json');
    seedLegacy({ mtp_categories: [{ id: 'work', name: 'Work', color: '#7c66ff' }] });

    const result = await migrateFromLocalStorage(db);

    expect(result.migrated).toBe(true);
    expect(await db.tasks.count()).toBe(0);
    // The corrupt slice must not take the healthy one down with it.
    expect(await db.categories.count()).toBe(1);
  });

  it('keeps a verbatim backup and leaves localStorage intact', async () => {
    seedLegacy({ mtp_tasks: [{ id: 't1', title: 'Keep me' }] });

    await migrateFromLocalStorage(db);

    // localStorage is the escape hatch — migration must not clear it.
    expect(localStorage.getItem('mtp_tasks')).toContain('Keep me');

    const backup = await db.meta.get('legacyBackup');
    expect((backup?.value as Record<string, string>).mtp_tasks).toContain('Keep me');

    const marker = await db.meta.get(MIGRATION_KEY);
    expect(marker).toBeDefined();
  });
});
