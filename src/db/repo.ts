/**
 * Generic repository over a Dexie table.
 *
 * Two invariants live here rather than at the call sites, because a call site
 * that forgets either one creates a bug that only shows up once syncing exists:
 *
 *   - every write stamps `updatedAt`
 *   - every delete is a *soft* delete (`deletedAt`), and every read filters
 *     soft-deleted rows back out
 *
 * Soft-deleted rows are filtered in memory rather than by index, because
 * IndexedDB cannot index `null` — a `deletedAt: null` row would silently vanish
 * from any index built on that field.
 */
import type { EntityTable } from 'dexie';
import type { Auditable } from './types';
import { now } from './ids';

/** Fields the repository manages; callers never pass them. */
type Managed = keyof Auditable;

/** A row as supplied by a caller — audit columns are filled in by the repo. */
export type NewRow<T extends Auditable> = Omit<T, Managed>;
/** A patch as supplied by a caller. The primary key is never patchable. */
export type RowPatch<T extends Auditable, K extends keyof T> = Partial<Omit<T, Managed | K>>;

export interface Repo<T extends Auditable, K extends keyof T & string> {
  /** All live rows. */
  all(): Promise<T[]>;
  /** One live row, or `undefined` if missing or soft-deleted. */
  get(id: T[K]): Promise<T | undefined>;
  /** Inserts or replaces a row wholesale. */
  put(row: NewRow<T>): Promise<void>;
  /** Inserts or replaces many rows in one transaction. */
  putMany(rows: NewRow<T>[]): Promise<void>;
  /** Merges a patch into an existing row. No-op if the row is missing. */
  patch(id: T[K], changes: RowPatch<T, K>): Promise<void>;
  /** Soft-deletes a row — it stays on disk with `deletedAt` set. */
  remove(id: T[K]): Promise<void>;
  /** Permanently removes a row. Only for data the user asked to purge. */
  hardRemove(id: T[K]): Promise<void>;
  /** Live rows matching an indexed equality, e.g. `where('listId', id)`. */
  where<F extends keyof T & string>(field: F, value: T[F]): Promise<T[]>;
  /** The underlying table, for queries the generic API does not cover. */
  table: EntityTable<T, K>;
}

/** True for rows that have not been soft-deleted. */
export const isLive = <T extends Auditable>(row: T): boolean => !row.deletedAt;

export function createRepo<T extends Auditable, K extends keyof T & string>(
  table: EntityTable<T, K>,
): Repo<T, K> {
  const stamp = (row: NewRow<T>): T =>
    ({ ...row, updatedAt: now(), deletedAt: null }) as unknown as T;

  return {
    table,

    async all() {
      return (await table.toArray()).filter(isLive);
    },

    async get(id) {
      const row = await table.get(id as never);
      return row && isLive(row) ? row : undefined;
    },

    async put(row) {
      await table.put(stamp(row));
    },

    async putMany(rows) {
      await table.bulkPut(rows.map(stamp));
    },

    async patch(id, changes) {
      await table.update(id as never, {
        ...changes,
        updatedAt: now(),
      } as never);
    },

    async remove(id) {
      await table.update(id as never, {
        deletedAt: now(),
        updatedAt: now(),
      } as never);
    },

    async hardRemove(id) {
      await table.delete(id as never);
    },

    async where(field, value) {
      const rows = await table.where(field).equals(value as never).toArray();
      return rows.filter(isLive);
    },
  };
}
