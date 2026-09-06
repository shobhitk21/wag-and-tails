/* Sign-in, shared by both consoles — the prototype's stfLogin() with a real
   password behind it now. The server verifies a bcrypt hash and issues a JWT
   (backend/src/modules/users/auth.routes.js); this component's only job is to
   collect the two fields and hand back what the server returns. */
import { useState } from 'react';
import api from '@wag/api-client';
import { LogoMark } from './Brand.jsx';
import { Ico } from './Icon.jsx';
import { useApi } from './useApi.js';

export function SignIn({ surface, onSignedIn }) {
  const title = surface === 'admin' ? 'Admin console' : 'Staff portal';
  const blurb =
    surface === 'admin'
      ? 'Revenue, catalogue, partners and payouts across every channel.'
      : 'Take bookings from WhatsApp, assign partners and keep the day moving.';

  const { data } = useApi(() => api.auth.demoUsers(surface), [surface]);
  const accounts = data?.users ?? [];

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  /* Prefill the email with the first account offered, so there's always
     something to submit; the password still has to be typed or picked. */
  const emailValue = email || accounts[0]?.email || '';

  /* A stale error from a previous failed attempt (API down, wrong password)
     shouldn't keep sitting on screen once the person starts correcting
     something — clear it the moment either field changes. */
  function updateEmail(v) { setEmail(v); if (error) setError(null); }
  function updatePassword(v) { setPassword(v); if (error) setError(null); }

  async function submit(e, overrides) {
    e?.preventDefault();
    const useEmail = overrides?.email ?? emailValue;
    const usePassword = overrides?.password ?? password;
    if (!usePassword) { setError('Enter your password.'); return; }

    setBusy(true);
    setError(null);
    try {
      const { user, token } = await api.auth.login(useEmail, usePassword, surface);
      onSignedIn(user, token);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  /* One-click account shortcut: fills both fields with a real, checked
     account and its demo password, then submits — a convenience for this
     seeded data, not a bypass of the check itself. */
  function continueAs(account) {
    setEmail(account.email);
    setPassword(data.demoPassword);
    setError(null);
    submit(null, { email: account.email, password: data.demoPassword });
  }

  /* Fills both fields with the default account's credentials but does not
     submit — for a quick look at what got filled in, or to hand off to a
     screen-reader/password manager flow that expects the normal submit step. */
  function autofill() {
    const account = accounts[0];
    if (!account) return;
    setEmail(account.email);
    setPassword(data.demoPassword);
    setError(null);
  }

  return (
    <div className="signin">
      <div className="signin__brand">
        <div><LogoMark size={52} ink="#fff" ground="var(--brand-700)" /></div>
        <div>
          <div className="t-hero" style={{ color: '#fff', fontSize: 38 }}>{title}</div>
          <p className="t-body mt3" style={{ color: 'rgba(255,255,255,.72)', maxWidth: 380 }}>
            {blurb}
          </p>
        </div>
        <div className="t-xs" style={{ color: 'rgba(255,255,255,.4)' }}>
          Wag &amp; Tails · EST. 2022
        </div>
      </div>

      <form className="signin__form" onSubmit={submit}>
        <div className="row g3" style={{ alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div>
            <div className="t-h1">Sign in</div>
            <div className="t-body dim mt2">Use your work email address.</div>
          </div>
          {accounts.length > 0 && (
            <button
              type="button"
              className="filterchip"
              onClick={autofill}
              disabled={busy}
              style={{ whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: 6 }}
            >
              <Ico name="edit" size={13} /> Fill demo credentials
            </button>
          )}
        </div>

        <div className="mt6">
          <div className="formlabel">Email</div>
          <div className="field">
            <input
              className="field__input"
              type="email"
              value={emailValue}
              onChange={(e) => updateEmail(e.target.value)}
              autoComplete="username"
            />
          </div>
        </div>

        <div className="mt4">
          <div className="formlabel">Password</div>
          <div className="field">
            <div className="field__row">
              <input
                className="field__input"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => updatePassword(e.target.value)}
                autoComplete="current-password"
                placeholder="Enter your password"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                style={{ color: 'var(--ink-4)' }}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                <Ico name="eye" size={17} />
              </button>
            </div>
          </div>
        </div>

        {error && <div className="errbox mt4">{error}</div>}

        <button className="btn btn--primary btn--block mt5" type="submit" disabled={busy}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>

        {accounts.length > 1 && (
          <>
            <div className="t-xs dim mt5 mb2">Or continue as:</div>
            <div className="row g2 wrap">
              {accounts.map((a) => (
                <button
                  key={a.code}
                  type="button"
                  className={`filterchip${emailValue === a.email ? ' is-on' : ''}`}
                  onClick={() => continueAs(a)}
                  disabled={busy}
                >
                  {a.name}
                </button>
              ))}
            </div>
          </>
        )}

        {data?.demoPassword && (
          <div className="t-xs dim mt4 center">
            Demo password for every seeded account: <strong>{data.demoPassword}</strong>
          </div>
        )}
      </form>
    </div>
  );
}
