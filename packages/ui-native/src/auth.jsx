/* The app session, shared by both apps.

   The signed-in account is kept in AsyncStorage and replayed to the API as
   `x-app-user: <role>:<id>`. Demo authentication: the phone number must match a
   real account and the OTP row is genuinely written, checked and expired — only
   the delivery is stubbed. Swapping in real auth means changing this file and
   the middleware; no screen changes. */
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { configureAppApi } from '@wag/api-client/app';

const AuthContext = createContext(null);

export function AuthProvider({ role, baseUrl, children }) {
  const storageKey = `wag.app.session.${role}`;
  const [user, setUser] = useState(null);
  const [restoring, setRestoring] = useState(true);

  /* Point the client at the API before anything renders. */
  configureAppApi({ baseUrl });

  useEffect(() => {
    let live = true;
    AsyncStorage.getItem(storageKey)
      .then((raw) => {
        if (!live) return;
        const parsed = raw ? JSON.parse(raw) : null;
        if (parsed) configureAppApi({ user: parsed });
        setUser(parsed);
      })
      .catch(() => {})
      .finally(() => { if (live) setRestoring(false); });
    return () => { live = false; };
  }, [storageKey]);

  const value = useMemo(() => ({
    user,
    role,
    restoring,
    signIn: (next) => {
      configureAppApi({ user: next });
      setUser(next);
      AsyncStorage.setItem(storageKey, JSON.stringify(next)).catch(() => {});
    },
    signOut: () => {
      configureAppApi({ user: null });
      setUser(null);
      AsyncStorage.removeItem(storageKey).catch(() => {});
    }
  }), [user, role, restoring, storageKey]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside an AuthProvider.');
  return ctx;
}
