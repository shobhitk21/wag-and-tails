/* Session for both consoles, backed by a real JWT.
   The signed-in account and its token are kept together in localStorage and
   the token is replayed to the API as `Authorization: Bearer <token>` on
   every request. A 7-day-expiring token is issued by POST /api/auth/login
   after real password verification (backend/src/modules/users/auth.routes.js);
   nothing here trusts the client's own claim about who it is. */
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { configureApi } from '@wag/api-client';

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

  /* Point the client at the API and hand it the current token. */
  configureApi({ baseUrl, token: session?.token ?? null });

  useEffect(() => {
    configureApi({ token: session?.token ?? null });
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
      /* Called with the { user, token } the login endpoint returns. */
      signIn: (user, token) => setSession({ user, token }),
      signOut: () => setSession(null)
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
