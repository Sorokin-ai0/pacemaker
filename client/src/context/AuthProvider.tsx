import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";

import { authApi } from "@/api/endpoints";
import type { ProfileDTO, UserDTO } from "@/api/types";
import { AuthContext, type AuthContextValue } from "@/context/auth";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserDTO | null>(null);
  const [profile, setProfile] = useState<ProfileDTO | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const me = await authApi.me();
        if (!cancelled) {
          setUser(me.user);
          setProfile(me.profile);
        }
      } catch {
        if (!cancelled) {
          setUser(null);
          setProfile(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const refresh = useCallback(async () => {
    try {
      const me = await authApi.me();
      setUser(me.user);
      setProfile(me.profile);
    } catch {
      setUser(null);
      setProfile(null);
    }
  }, []);

  // LOCAL PREVIEW AUTH — no passwords/JWT; see src/local/localBackend.ts.
  const login = useCallback(async (email: string) => {
    const nextUser = await authApi.login(email);
    setUser(nextUser);
    if (nextUser.hasProfile) {
      try {
        const me = await authApi.me();
        setProfile(me.profile);
      } catch {
        setProfile(null);
      }
    } else {
      setProfile(null);
    }
  }, []);

  const register = useCallback(async (email: string, name: string) => {
    const nextUser = await authApi.register(email, name);
    setUser(nextUser);
    setProfile(null);
  }, []);

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } finally {
      setUser(null);
      setProfile(null);
    }
  }, []);

  const patchUser = useCallback((patch: Partial<UserDTO>) => {
    setUser((current) => (current ? { ...current, ...patch } : current));
  }, []);

  const applyProfile = useCallback((nextProfile: ProfileDTO) => {
    setProfile(nextProfile);
    setUser((current) => (current ? { ...current, hasProfile: true } : current));
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ user, profile, loading, login, register, logout, refresh, patchUser, applyProfile }),
    [user, profile, loading, login, register, logout, refresh, patchUser, applyProfile],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
