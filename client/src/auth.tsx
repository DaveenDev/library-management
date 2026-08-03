import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { AuthUser, Permission } from "@lumen/shared";
import { api, onUnauthorized } from "./api.ts";

interface AuthState {
  user: AuthUser | null;
  /** True until the first `/auth/me` settles, so the app never flashes login. */
  checking: boolean;
  can: (permission: Permission) => boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthCtx = createContext<AuthState | null>(null);

export function useAuth(): AuthState {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [checking, setChecking] = useState(true);

  // The session lives in an httpOnly cookie, which script cannot read — so a
  // reload has to ask the server whether it is still signed in.
  useEffect(() => {
    let cancelled = false;
    api
      .me()
      .then((s) => {
        if (cancelled) return;
        setUser(s.user);
        setPermissions(s.permissions);
      })
      .catch(() => {
        /* no session, or the API is down — either way, show the login form */
      })
      .finally(() => {
        if (!cancelled) setChecking(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // A session can expire mid-visit. Rather than leave every page showing an
  // error it cannot recover from, drop straight back to the login form.
  useEffect(
    () =>
      onUnauthorized(() => {
        setUser(null);
        setPermissions([]);
      }),
    [],
  );

  const signIn = useCallback(async (email: string, password: string) => {
    const session = await api.login(email, password);
    setUser(session.user);
    setPermissions(session.permissions);
  }, []);

  const signOut = useCallback(async () => {
    try {
      await api.logout();
    } finally {
      // Even if the request fails the local session is over; leaving the user
      // apparently signed in would be worse than a stale cookie.
      setUser(null);
      setPermissions([]);
    }
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      user,
      checking,
      can: (permission) => permissions.includes(permission),
      signIn,
      signOut,
    }),
    [user, checking, permissions, signIn, signOut],
  );

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}
