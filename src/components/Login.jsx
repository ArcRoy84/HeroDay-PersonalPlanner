// Invite-only magic-link sign-in, shown in place of the app when there is no
// Supabase session. See useAuth — unknown emails are rejected client-side and
// by the Supabase project (sign-up disabled), since testers are added by hand.
//
// Styled on its own brand palette (see login.css) rather than the app's
// dark/light theme tokens: theme is a Dexie setting that only loads after
// sign-in, so this screen renders before it's known.
import React, { useState } from 'react';

export default function Login({ sendMagicLink }) {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState('idle'); // idle | sending | sent
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    const trimmed = email.trim();
    if (!trimmed) return;
    setStatus('sending');
    setError('');
    const { error: sendError } = await sendMagicLink(trimmed);
    if (sendError) {
      setError(
        /signup/i.test(sendError)
          ? "That email isn't on the tester list yet. Ask for an invite."
          : sendError,
      );
      setStatus('idle');
      return;
    }
    setStatus('sent');
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <img src="/heroday-logo.png" alt="HeroDay" className="login-logo" />

        {status === 'sent' ? (
          <>
            <h1 className="login-heading">Check your email</h1>
            <p className="login-copy">
              We sent a sign-in link to <strong>{email}</strong>. It expires
              shortly, so use it soon.
            </p>
            <button
              type="button"
              className="login-back"
              onClick={() => { setStatus('idle'); setError(''); }}
            >
              Use a different email
            </button>
          </>
        ) : (
          <>
            <p className="login-copy">Early tester build — sign in with an invited email.</p>
            <form onSubmit={handleSubmit} className="login-form">
              <input
                type="email"
                inputMode="email"
                autoComplete="email"
                autoFocus
                required
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="login-input"
              />
              <button type="submit" className="login-submit" disabled={status === 'sending'}>
                {status === 'sending' ? 'Sending…' : 'Send magic link'}
              </button>
            </form>
            {error && <p className="login-error">{error}</p>}
          </>
        )}
      </div>
    </div>
  );
}
