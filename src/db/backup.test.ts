import { describe, it, expect, beforeEach } from 'vitest';
import { db } from './schema';
import {
  exportData, exportToJSON, parseBackup, importData, importFromJSON,
  backupFilename, countLegacyKeys, clearLegacyStorage,
  InvalidBackupError, BACKUP_VERSION,
} from './backup';

const ts = '2026-09-18T00:00:00.000Z';

const task = (id: string, title: string) => ({
  id, title, priority: 'medium' as const, categoryId: 'work',
  date: '2026-09-18', startTime: '09:00', duration: 30, tags: [],
  reminder: false, reminderOffsets: [], completed: false, completedAt: null,
  description: '', location: '', endDate: null, endTime: '',
  recurrence: null, completedDates: {}, createdAt: ts,
  updatedAt: ts, deletedAt: null,
});

beforeEach(async () => {
  await db.open();
  await Promise.all(db.tables.map(t => t.clear()));
  localStorage.clear();
});

describe('exportData', () => {
  it('captures rows and counts for every exported table', async () => {
    await db.tasks.bulkPut([task('t1', 'One'), task('t2', 'Two')]);
    await db.settings.put({ key: 'theme', value: 'light', updatedAt: ts });

    const backup = await exportData();

    expect(backup.format).toBe('heroday-backup');
    expect(backup.version).toBe(BACKUP_VERSION);
    expect(backup.counts.tasks).toBe(2);
    expect(backup.data.tasks).toHaveLength(2);
    expect(backup.data.settings).toHaveLength(1);
  });

  it('excludes internal bookkeeping', async () => {
    await db.meta.put({ key: 'legacyBackup', value: { mtp_tasks: '[]' } });

    const backup = await exportData();

    // meta describes this browser's migration history, not the user's data.
    expect(backup.data.meta).toBeUndefined();
  });

  it('round-trips through JSON', async () => {
    await db.tasks.put(task('t1', 'Round trip'));

    const text = await exportToJSON();
    await db.tasks.clear();
    await importFromJSON(text);

    expect((await db.tasks.get('t1'))?.title).toBe('Round trip');
  });

  it('includes soft-deleted rows so a restore preserves them', async () => {
    await db.tasks.put({ ...task('gone', 'Deleted'), deletedAt: ts });

    const backup = await exportData();

    expect(backup.data.tasks).toHaveLength(1);
  });
});

describe('parseBackup', () => {
  it('rejects malformed JSON', () => {
    expect(() => parseBackup('{ nope')).toThrow(InvalidBackupError);
  });

  it('rejects a JSON file that is not a backup', () => {
    expect(() => parseBackup('{"hello":"world"}')).toThrow(/not a HeroDay backup/);
  });

  it('rejects a backup from a newer format version', () => {
    const future = JSON.stringify({
      format: 'heroday-backup', version: BACKUP_VERSION + 1, data: {},
    });
    expect(() => parseBackup(future)).toThrow(/newer version/);
  });

  it('accepts a well-formed backup', () => {
    const valid = JSON.stringify({
      format: 'heroday-backup', version: BACKUP_VERSION, exportedAt: ts,
      counts: {}, data: { tasks: [] },
    });
    expect(parseBackup(valid).format).toBe('heroday-backup');
  });
});

describe('importData', () => {
  const backupWith = (tasks: unknown[]) => ({
    format: 'heroday-backup' as const,
    version: BACKUP_VERSION,
    exportedAt: ts,
    counts: { tasks: tasks.length },
    data: { tasks },
  });

  it('replace mode makes the file the whole state', async () => {
    await db.tasks.put(task('existing', 'Already here'));

    await importData(backupWith([task('t1', 'From file')]), 'replace');

    const all = await db.tasks.toArray();
    expect(all).toHaveLength(1);
    expect(all[0]?.id).toBe('t1');
  });

  it('merge mode keeps rows the file does not mention', async () => {
    await db.tasks.put(task('existing', 'Already here'));

    await importData(backupWith([task('t1', 'From file')]), 'merge');

    expect(await db.tasks.count()).toBe(2);
  });

  it('merge mode overwrites rows with the same key', async () => {
    await db.tasks.put(task('t1', 'Old title'));

    await importData(backupWith([task('t1', 'New title')]), 'merge');

    expect(await db.tasks.count()).toBe(1);
    expect((await db.tasks.get('t1'))?.title).toBe('New title');
  });

  it('tolerates a backup missing a table', async () => {
    const partial = {
      format: 'heroday-backup' as const, version: BACKUP_VERSION,
      exportedAt: ts, counts: {}, data: { tasks: [task('t1', 'Only tasks')] },
    };

    const result = await importData(partial, 'replace');

    expect(result.imported.tasks).toBe(1);
    expect(result.imported.notes).toBe(0);
  });

  it('reports the number of rows written', async () => {
    const result = await importData(backupWith([task('a', 'A'), task('b', 'B')]), 'replace');
    expect(result.total).toBe(2);
  });
});

describe('legacy storage cleanup', () => {
  it('counts only the mtp_ keys', () => {
    localStorage.setItem('mtp_tasks', '[]');
    localStorage.setItem('mtp_theme', '"dark"');
    localStorage.setItem('unrelated', 'x');

    expect(countLegacyKeys()).toBe(2);
  });

  it('removes the legacy keys and leaves others alone', () => {
    localStorage.setItem('mtp_tasks', '[]');
    localStorage.setItem('unrelated', 'keep me');

    const removed = clearLegacyStorage();

    expect(removed).toBe(1);
    expect(countLegacyKeys()).toBe(0);
    expect(localStorage.getItem('unrelated')).toBe('keep me');
  });
});

describe('backupFilename', () => {
  it('is chronologically sortable and filesystem safe', () => {
    const name = backupFilename(new Date('2026-09-18T21:30:05.000Z'));
    expect(name).toBe('heroday-backup-2026-09-18-21-30-05.json');
    expect(name).not.toMatch(/[:<>"/\\|?*]/);
  });
});

describe('stores in backups', () => {
  const LOGO = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQ==';
  const aStore = (id: string, name: string, logo: string | null = null) => ({
    id, name, icon: '🏪', logo, categoryId: 'supermarket', address: '1 Main St', city: 'Springfield',
    region: 'IL', postalCode: '62704', country: 'US', lat: 39.78, lon: -89.65,
    hours: 'Mon-Sat 8-20', notes: 'Park at the back', createdAt: ts, updatedAt: ts, deletedAt: null,
  });

  it('exports both new tables', async () => {
    await db.stores.put(aStore('s1', 'Costco'));
    await db.storeCategories.put({ id: 'supermarket', label: 'Supermarket', emoji: '🛒', color: '#97C459', updatedAt: ts, deletedAt: null });

    const backup = await exportData();

    expect(backup.version).toBe(BACKUP_VERSION);
    expect(backup.data.stores).toHaveLength(1);
    expect(backup.data.storeCategories).toHaveLength(1);
    expect(backup.counts.stores).toBe(1);
  });

  it('round-trips a store including its logo and coordinates', async () => {
    await db.stores.put(aStore('s1', 'Costco', LOGO));

    const text = await exportToJSON();
    await db.stores.clear();
    await importFromJSON(text);

    const restored = await db.stores.get('s1');
    // A Blob would have come back as {}. A string survives.
    expect(restored?.logo).toBe(LOGO);
    expect(restored?.lat).toBe(39.78);
    expect(restored?.hours).toBe('Mon-Sat 8-20');
  });

  it('round-trips the list-to-store link', async () => {
    await db.shoppingLists.put({ id: 'l1', name: 'Costco', budget: null, storeId: 's1', createdAt: ts, updatedAt: ts, deletedAt: null });

    const text = await exportToJSON();
    await db.shoppingLists.clear();
    await importFromJSON(text);

    expect((await db.shoppingLists.get('l1'))?.storeId).toBe('s1');
  });

  it('a v1 backup, replaced in, leaves no stores from before it', async () => {
    await db.stores.put(aStore('mine', 'Stores that did not exist in the backup'));
    const v1File = JSON.stringify({
      format: 'heroday-backup', version: 1, exportedAt: ts, counts: {},
      data: { tasks: [], shoppingLists: [{ id: 'l1', name: 'Grocery', budget: null, createdAt: ts, updatedAt: ts, deletedAt: null }] },
    });

    await importFromJSON(v1File, 'replace');

    // The file predates stores, so the honest state is "no stores".
    expect(await db.stores.count()).toBe(0);
    // Its list has no storeId at all; the app must read that as "no store".
    expect((await db.shoppingLists.get('l1') as unknown as { storeId?: string | null }).storeId ?? null).toBeNull();
  });

  it('a v1 backup, merged in, keeps existing stores', async () => {
    await db.stores.put(aStore('mine', 'Keep me'));
    const v1File = JSON.stringify({
      format: 'heroday-backup', version: 1, exportedAt: ts, counts: {}, data: { tasks: [] },
    });

    await importFromJSON(v1File, 'merge');

    expect(await db.stores.count()).toBe(1);
  });

  it('does not wipe stores for a current-format file that merely lacks the table', async () => {
    // Version 2 knows about stores, so a v2 file with no "stores" key is
    // malformed, not an instruction to delete them.
    await db.stores.put(aStore('mine', 'Keep me'));
    const oddFile = JSON.stringify({
      format: 'heroday-backup', version: BACKUP_VERSION, exportedAt: ts, counts: {}, data: { tasks: [] },
    });

    await importFromJSON(oddFile, 'replace');

    expect(await db.stores.count()).toBe(1);
  });

  it('restores the default store categories after a replace that left none', async () => {
    const v1File = JSON.stringify({
      format: 'heroday-backup', version: 1, exportedAt: ts, counts: {}, data: {},
    });

    await importFromJSON(v1File, 'replace');

    const live = (await db.storeCategories.toArray()).filter(c => !c.deletedAt);
    expect(live.map(c => c.id)).toContain('supermarket');
    expect(live.map(c => c.id)).toContain('other');
  });

  it('rejects a file from a newer format than this build understands', () => {
    const future = JSON.stringify({ format: 'heroday-backup', version: BACKUP_VERSION + 1, data: {} });
    expect(() => parseBackup(future)).toThrow(/newer version/);
  });
});
