import { createContext, useContext } from "react";

import type { ProfileDTO, UserDTO } from "@/api/types";

export interface AuthContextValue {
  user: UserDTO | null;
  profile: ProfileDTO | null;
  /** True only during the initial /api/auth/me boot check. */
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  /** Re-fetches /api/auth/me. */
  refresh: () => Promise<void>;
  /** Optimistic local user patch (e.g. unit preference). */
  patchUser: (patch: Partial<UserDTO>) => void;
  /** Called after onboarding / plan regeneration with the fresh profile. */
  applyProfile: (profile: ProfileDTO) => void;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
