/**
 * `useState`-shaped access to a single persisted setting.
 *
 * The returned setter accepts a value or an updater function, so call sites
 * that used `setTheme(t => ...)` against React state keep working unchanged.
 */
import { useCallback } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/schema';
import { setSetting } from '../db/repos';
import type { SettingKey, SettingsMap } from '../db/types';

export type SettingUpdater<K extends SettingKey> =
  | SettingsMap[K]
  | ((previous: SettingsMap[K]) => SettingsMap[K]);

export function useSetting<K extends SettingKey>(
  key: K,
  fallback: SettingsMap[K],
): [SettingsMap[K], (next: SettingUpdater<K>) => void] {
  // `useLiveQuery` yields undefined on the first render, before IndexedDB has
  // answered. The fallback stands in until then, so callers never see undefined.
  const stored = useLiveQuery(() => db.settings.get(key), [key]);
  const value = stored ? (stored.value as SettingsMap[K]) : fallback;

  const update = useCallback((next: SettingUpdater<K>) => {
    // Read-modify-write goes through the database rather than the rendered
    // value, so a stale render cannot overwrite a newer stored value.
    void (async () => {
      const current = await db.settings.get(key);
      const previous = current ? (current.value as SettingsMap[K]) : fallback;
      const resolved = typeof next === 'function'
        ? (next as (p: SettingsMap[K]) => SettingsMap[K])(previous)
        : next;
      await setSetting(key, resolved);
    })();
  }, [key, fallback]);

  return [value, update];
}
