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
