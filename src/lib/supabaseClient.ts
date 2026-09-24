// Auth-only Supabase client. There are no app tables or RLS policies yet —
// see the "HeroDay data architecture" memory: Postgres/Supabase is deferred
// to the Pro tier, this client exists purely to gate access to the Free-tier
// app with real accounts while Dexie stays the local source of truth.
import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!url || !key) {
  throw new Error(
    'Missing VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY. Copy .env.example to .env.local and fill them in.',
  );
}

export const supabase = createClient(url, key);
