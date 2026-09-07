/* The app session, shared by both apps.

   The signed-in account and its tokens live in AsyncStorage and the access
   token is replayed as `Authorization: Bearer <token>`. It is minted by
   POST /api/app/auth/verify-otp once the OTP checks out.

   This used to store only the account and send `x-app-user: <role>:<id>`,
   which any caller could set to any account — a real authentication bypass,
   not a stub. The OTP delivery is still the only stubbed part: the code is
   fixed at 4321 and returned in the response, but the row is genuinely
   written, checked and expired, so wiring an SMS provider means sending the
   code instead of returning it. Nothing else about the session is faked.

   Access tokens last 15 minutes; the api-client rotates them with the refresh
   token and calls back through onSessionChange so the new pair is persisted.
   Refresh tokens are single-use, so persisting the rotation matters: replaying
   a retired one on next launch would be read as a leak and end the session. */
import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { configureAppApi, appApi } from '@wag/api-client/app';

const AuthContext = createContext(null);

export function AuthProvider({ role, baseUrl, children }) {
  const storageKey = `wag.app.session.${role}`;
  const [session, setSession] = useState(null);
  const [restoring, setRestoring] = useState(true);

  /* Point the client at the API before anything renders. */
  configureAppApi({ baseUrl });

  /* Kept in a ref so signOut can read the current token without making the
     memoised context value change on every rotation. */
  const sessionRef = useRef(null);
  sessionRef.current = session;

  const persist = (next) => {
    setSession(next);
    configureAppApi({
      token: next?.token ?? null,
      refresh: next?.refreshToken ?? null
    });
    if (next) AsyncStorage.setItem(storageKey, JSON.stringify(next)).catch(() => {});
    else AsyncStorage.removeItem(storageKey).catch(() => {});
  };

  useEffect(() => {
    let live = true;

    /* A rotation or a rejected refresh both arrive here, from inside a fetch. */
    configureAppApi({
      onSessionChange: (next) => { if (live) persist(next); }
    });

    AsyncStorage.getItem(storageKey)
      .then((raw) => {
        if (!live) return;
        const parsed = raw ? JSON.parse(raw) : null;
        if (parsed) {
          configureAppApi({
            token: parsed.token ?? null,
            refresh: parsed.refreshToken ?? null
          });
        }
        setSession(parsed);
      })
      .catch(() => {})
      .finally(() => { if (live) setRestoring(false); });

    return () => { live = false; };
  }, [storageKey]);

  const value = useMemo(() => ({
    user: session?.user ?? null,
    role,
    restoring,
    /* Called with the { user, token, refreshToken } verify-otp returns. */
    signIn: (user, token, refreshToken) => persist({ user, token, refreshToken }),
    signOut: () => {
      /* Best effort: revoke server-side, but sign out locally regardless so a
         failed call can never trap someone in a session. */
      const rt = sessionRef.current?.refreshToken;
      persist(null);
      if (rt) appApi.auth.logout(rt).catch(() => {});
    }
  }), [session, role, restoring, storageKey]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside an AuthProvider.');
  return ctx;
}
