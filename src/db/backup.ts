/**
 * Full data export and import.
 *
 * This is the user-facing backup story: everything HeroDay holds, in one JSON
 * file the user owns. It is also what makes it safe to finally clear the legacy
 * localStorage keys — until there is an export button, that copy is the only
 * backup a user has.
 *
 * Internal bookkeeping (`meta`) is deliberately excluded. It holds migration
 * markers and the legacy snapshot, which describe *this* browser's history
 * rather than the user's data, and re-importing them elsewhere would confuse
 * the boot sequence.
 */
import { db } from './schema';
import { now } from './ids';

/** Bumped when the file layout changes in a way importers must notice. */
export const BACKUP_VERSION = 1;

/** Tables included in a backup, in dependency order (lists before items). */
const EXPORTED_TABLES = [
  'tasks', 'categories', 'notes',
  'learningCourses', 'learningGoals',
  'shoppingLists', 'shoppingItems', 'shoppingHistory', 'shoppingRecipes',
  'shoppingCategories', 'pantry',
  'budgetCategories', 'budgetIncome', 'budgetBills', 'budgetExpenses',
  'settings',
] as const;

type ExportedTable = (typeof EXPORTED_TABLES)[number];

export interface BackupFile {
  format: 'heroday-backup';
  version: number;
  exportedAt: string;
  /** Row counts, so a user can sanity-check a file without reading all of it. */
  counts: Record<string, number>;
  data: Record<string, unknown[]>;
}

/** Reads every exported table into a single serialisable object. */
export async function exportData(): Promise<BackupFile> {
  const data: Record<string, unknown[]> = {};
  const counts: Record<string, number> = {};

  // One transaction, so the export is a consistent snapshot rather than a set
  // of reads that could interleave with writes from another tab.
  await db.transaction('r', db.tables, async () => {
    for (const name of EXPORTED_TABLES) {
      const rows = await db.table(name).toArray();
      data[name] = rows;
      counts[name] = rows.length;
    }
  });

  return {
    format: 'heroday-backup',
    version: BACKUP_VERSION,
    exportedAt: now(),
    counts,
    data,
  };
}

/** Serialises an export to a pretty-printed JSON string. */
export async function exportToJSON(): Promise<string> {
  return JSON.stringify(await exportData(), null, 2);
}

/** A filename that sorts chronologically and is safe on every platform. */
export function backupFilename(date = new Date()): string {
  const stamp = date.toISOString().slice(0, 19).replace(/[:T]/g, '-');
  return `heroday-backup-${stamp}.json`;
}

export class InvalidBackupError extends Error {
  override name = 'InvalidBackupError';
}

/**
 * Validates a parsed backup without trusting any of it.
 *
 * An import reads a file the user picked off their disk, so this checks the
 * shape rather than assuming it, and reports the reason rather than throwing
 * something opaque at the UI.
 */
export function parseBackup(text: string): BackupFile {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new InvalidBackupError('That file is not valid JSON.');
  }

  if (!parsed || typeof parsed !== 'object') {
    throw new InvalidBackupError('That file does not contain a backup.');
  }

  const candidate = parsed as Partial<BackupFile>;
  if (candidate.format !== 'heroday-backup') {
    throw new InvalidBackupError('That file is not a HeroDay backup.');
  }
  if (typeof candidate.version !== 'number' || candidate.version > BACKUP_VERSION) {
    throw new InvalidBackupError(
      `That backup was made by a newer version of HeroDay (format ${String(candidate.version)}).`,
    );
  }
  if (!candidate.data || typeof candidate.data !== 'object') {
    throw new InvalidBackupError('That backup is missing its data.');
  }

  return candidate as BackupFile;
}

export type ImportMode =
  /** Wipes the exported tables first — the file becomes the whole state. */
  | 'replace'
  /** Writes the file's rows over any with matching keys, keeping the rest. */
  | 'merge';

export interface ImportResult {
  imported: Record<string, number>;
  total: number;
}

/**
 * Writes a validated backup into the database.
 *
 * The whole import is one transaction: a file that fails partway through
 * leaves the existing data untouched rather than half-replaced.
 */
export async function importData(
  backup: BackupFile,
  mode: ImportMode = 'replace',
): Promise<ImportResult> {
  const imported: Record<string, number> = {};
  let total = 0;

  await db.transaction('rw', db.tables, async () => {
    for (const name of EXPORTED_TABLES) {
      const rows = backup.data[name];
      // A backup from an older format may simply not have a table. That is not
      // an error; it means there was nothing to save.
      if (!Array.isArray(rows)) {
        imported[name] = 0;
        continue;
      }

      const table = db.table(name);
      if (mode === 'replace') await table.clear();
      if (rows.length) await table.bulkPut(rows);

      imported[name] = rows.length;
      total += rows.length;
    }
  });

  return { imported, total };
}

/** Convenience wrapper: validate then import in one call. */
export async function importFromJSON(
  text: string,
  mode: ImportMode = 'replace',
): Promise<ImportResult> {
  return importData(parseBackup(text), mode);
}

/* ── Legacy storage cleanup ─────────────────────────────────────────────── */

/** Number of `mtp_*` keys still sitting in localStorage. */
export function countLegacyKeys(): number {
  try {
    let count = 0;
    for (let i = 0; i < localStorage.length; i++) {
      if (localStorage.key(i)?.startsWith('mtp_')) count++;
    }
    return count;
  } catch {
    return 0;
  }
}

/**
 * Removes the legacy `mtp_*` keys.
 *
 * Only ever called from an explicit user action. The verbatim snapshot taken at
 * migration time stays in `meta.legacyBackup`, so this is recoverable even
 * after the fact.
 */
export function clearLegacyStorage(): number {
  const keys: string[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith('mtp_')) keys.push(key);
    }
    for (const key of keys) localStorage.removeItem(key);
  } catch {
    return 0;
  }
  return keys.length;
}

export { EXPORTED_TABLES };
export type { ExportedTable };
