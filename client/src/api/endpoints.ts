/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║ TEMPORARY: LOCAL-STORAGE PREVIEW MODE                                     ║
 * ║                                                                          ║
 * ║ Every "API" below delegates to src/local/localBackend.ts — data lives in ║
 * ║ browser localStorage; there is NO server, NO database, and NO real auth. ║
 * ║                                                                          ║
 * ║ To restore the real backend (Express + Prisma + JWT, already implemented ║
 * ║ in server/): re-implement these objects with `apiFetch` from             ║
 * ║ src/api/http.ts against the routes in API_CONTRACT.md (see git history   ║
 * ║ for the original HTTP version of this file) and delete src/local/.       ║
 * ║ Signatures and DTO shapes are identical, so no component changes.        ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 */

import type {
  LoggedRunDTO,
  OnboardingBody,
  PlanDTO,
  PlannedWorkoutDTO,
  ProfileDTO,
  RegenerateBody,
  RunCreateBody,
  RunPatchBody,
  StatsDTO,
  Unit,
  UserDTO,
  WorkoutPatchBody,
} from "@/api/types";
import {
  localAuth,
  localMe,
  localOnboarding,
  localPlan,
  localRuns,
  localStats,
  localWorkouts,
} from "@/local/localBackend";

export const authApi = {
  /** LOCAL PREVIEW: no password — just stores a profile object. */
  register(email: string, name: string): Promise<UserDTO> {
    return localAuth.register(email, name);
  },
  /** LOCAL PREVIEW: "login" re-activates the stored local profile. */
  login(email: string): Promise<UserDTO> {
    return localAuth.login(email);
  },
  logout(): Promise<void> {
    return localAuth.logout();
  },
  me(): Promise<{ user: UserDTO; profile: ProfileDTO | null }> {
    return localAuth.me();
  },
  /** Read-only peek for the login screen. Local preview only. */
  peekUser(): { email: string; name: string } | null {
    return localAuth.peekUser();
  },
};

export const meApi = {
  update(body: { unitPreference: Unit }): Promise<UserDTO> {
    return localMe.update(body);
  },
};

export const onboardingApi = {
  submit(body: OnboardingBody): Promise<{ profile: ProfileDTO; plan: PlanDTO }> {
    return localOnboarding.submit(body);
  },
};

export const planApi = {
  get(): Promise<PlanDTO | null> {
    return localPlan.get();
  },
  regenerate(body: RegenerateBody): Promise<{ profile: ProfileDTO; plan: PlanDTO }> {
    return localPlan.regenerate(body);
  },
};

export const workoutsApi = {
  update(id: string, body: WorkoutPatchBody): Promise<PlannedWorkoutDTO> {
    return localWorkouts.update(id, body);
  },
};

export const runsApi = {
  list(params?: { from?: string; to?: string }): Promise<LoggedRunDTO[]> {
    return localRuns.list(params);
  },
  create(body: RunCreateBody): Promise<LoggedRunDTO> {
    return localRuns.create(body);
  },
  update(id: string, body: RunPatchBody): Promise<LoggedRunDTO> {
    return localRuns.update(id, body);
  },
  remove(id: string): Promise<void> {
    return localRuns.remove(id);
  },
};

export const statsApi = {
  get(): Promise<StatsDTO> {
    return localStats.get();
  },
};
