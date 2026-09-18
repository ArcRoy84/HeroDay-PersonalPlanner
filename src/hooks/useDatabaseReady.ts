/**
 * Gates rendering until the database is open, migrated and seeded.
 *
 * Without this the app would render against empty tables for a frame or two and
 * flash empty state at a user who has data — and worse, effects that write
 * derived values could persist that empty state over the real one.
 */
import { useEffect, useState } from 'react';
import { bootDatabase } from '../db/boot';

export type DatabaseStatus = 'loading' | 'ready' | 'error';

export interface DatabaseReady {
  status: DatabaseStatus;
  error: Error | null;
}

export function useDatabaseReady(): DatabaseReady {
  const [status, setStatus] = useState<DatabaseStatus>('loading');
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let cancelled = false;
    bootDatabase().then(
      () => { if (!cancelled) setStatus('ready'); },
      (cause: unknown) => {
        if (cancelled) return;
        // Most likely causes are private-browsing restrictions or a browser
        // with IndexedDB disabled. Surface it rather than hanging on a spinner.
        setError(cause instanceof Error ? cause : new Error(String(cause)));
        setStatus('error');
      },
    );
    return () => { cancelled = true; };
  }, []);

  return { status, error };
}
