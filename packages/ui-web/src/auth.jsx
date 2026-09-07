/* Session for both consoles, backed by a real JWT.

   The signed-in account and its tokens are kept together in localStorage and
   the access token is replayed as `Authorization: Bearer <token>` on every
   request. POST /api/auth/login issues it after real password verification
   (backend/src/modules/users/auth.routes.js); nothing here trusts the client's
   own claim about who it is.

   The access token lasts 15 minutes. The api-client swaps it for a fresh one
   using the refresh token whenever it expires and calls back here through
   onSessionChange so the rotated pair is written to storage — otherwise a
   reload would replay a refresh token the server has already retired and the
   whole session would be revoked as a suspected leak. */
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { configureApi, api } from '@wag/api-client';

const AuthContext = createContext(null);

export function AuthProvider({ surface, baseUrl, children }) {
  const storageKey = `wag.session.${surface}`;

  const [session, setSession] = useState(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      return raw ? JSON.parse(raw) : null;
    } catch {
      /* Private windows and blocked site data both land here — start signed out
         rather than failing to render. */
      return null;
    }
  });

  /* Point the client at the API and hand it the current tokens. */
  configureApi({
    baseUrl,
    token: session?.token ?? null,
    refresh: session?.refreshToken ?? null
  });

  useEffect(() => {
    configureApi({
      token: session?.token ?? null,
      refresh: session?.refreshToken ?? null,
      /* null means the refresh itself was rejected: the session is over. */
      onSessionChange: (next) => setSession(next)
    });
    try {
      if (session) localStorage.setItem(storageKey, JSON.stringify(session));
      else localStorage.removeItem(storageKey);
    } catch {
      /* Session simply does not survive a reload here. Not worth failing over. */
    }
  }, [session, storageKey]);

  const value = useMemo(
    () => ({
      user: session?.user ?? null,
      surface,
      /* Called with the { user, token, refreshToken } login returns. */
      signIn: (user, token, refreshToken) => setSession({ user, token, refreshToken }),
      /* After someone edits their own profile. The sidebar reads the name and
         role from here, so without this the console would keep showing the old
         name until the next sign-in. Tokens are untouched — this is the same
         session, not a new one. */
      updateUser: (patch) =>
        setSession((prev) => (prev ? { ...prev, user: { ...prev.user, ...patch } } : prev)),
      signOut: () => {
        /* Best effort: tell the server to revoke the family, but sign out
           locally regardless — a failed call must not trap someone signed in. */
        const rt = session?.refreshToken;
        setSession(null);
        if (rt) api.auth.logout(rt).catch(() => {});
      }
    }),
    [session, surface]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside an AuthProvider.');
  return ctx;
}

/* Avatar colours per role, matching the prototype's who[] in webPage(). */
export function roleArt(role) {
  if (role === 'super_admin') return ['#4A1E0B', '#2B1206'];
  if (role === 'support') return ['#1F7A4D', '#0E4229'];
  return ['#F07B2C', '#A8480C'];
}

export const roleLabel = (role) =>
  ({ super_admin: 'Super admin', bookings_staff: 'Bookings staff', support: 'Support' }[role] ?? role);
