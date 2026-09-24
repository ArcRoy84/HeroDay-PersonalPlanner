/**
 * Tracks the Supabase auth session and exposes the two actions the login
 * gate needs: request a magic link, and sign out.
 *
 * Invite-only: sign-up is disabled in the Supabase project, so
 * `signInWithOtp` only succeeds for emails an admin has already added as a
 * user. Unknown emails get Supabase's "Signups not allowed" error, which the
 * login screen shows as-is.
 */
import { useEffect, useState, useCallback } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabaseClient';

export type AuthStatus = 'loading' | 'signed-out' | 'signed-in';

export interface UseAuth {
  status: AuthStatus;
  session: Session | null;
  sendMagicLink: (email: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

export function useAuth(): UseAuth {
  const [session, setSession] = useState<Session | null>(null);
  const [status, setStatus] = useState<AuthStatus>('loading');

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setStatus(data.session ? 'signed-in' : 'signed-out');
    });

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      setStatus(next ? 'signed-in' : 'signed-out');
    });

    return () => subscription.subscription.unsubscribe();
  }, []);

  const sendMagicLink = useCallback(async (email: string) => {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: false,
        // Without this, the link redirects to the project's fixed Site URL
        // regardless of where the request came from — breaks whenever a
        // tester is on a devtunnel/staging origin instead of that default.
        // The target origin must also be in the Supabase Auth "Redirect
        // URLs" allow list, or Supabase silently falls back to the Site URL.
        emailRedirectTo: window.location.origin,
      },
    });
    return { error: error ? error.message : null };
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  return { status, session, sendMagicLink, signOut };
}
