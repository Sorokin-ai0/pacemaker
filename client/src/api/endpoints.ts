import { apiFetch } from "@/api/http";
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

export const authApi = {
  register(email: string, password: string): Promise<UserDTO> {
    return apiFetch<{ user: UserDTO }>("/api/auth/register", {
      method: "POST",
      body: { email, password },
      on401: "ignore",
    }).then((r) => r.user);
  },
  login(email: string, password: string): Promise<UserDTO> {
    return apiFetch<{ user: UserDTO }>("/api/auth/login", {
      method: "POST",
      body: { email, password },
      on401: "ignore",
    }).then((r) => r.user);
  },
  logout(): Promise<void> {
    return apiFetch<undefined>("/api/auth/logout", { method: "POST", on401: "ignore" }).then(
      () => undefined,
    );
  },
  me(): Promise<{ user: UserDTO; profile: ProfileDTO | null }> {
    return apiFetch<{ user: UserDTO; profile: ProfileDTO | null }>("/api/auth/me", {
      on401: "ignore",
    });
  },
};

export const meApi = {
  update(body: { unitPreference: Unit }): Promise<UserDTO> {
    return apiFetch<{ user: UserDTO }>("/api/me", { method: "PATCH", body }).then((r) => r.user);
  },
};

export const onboardingApi = {
  submit(body: OnboardingBody): Promise<{ profile: ProfileDTO; plan: PlanDTO }> {
    return apiFetch<{ profile: ProfileDTO; plan: PlanDTO }>("/api/onboarding", {
      method: "POST",
      body,
    });
  },
};

export const planApi = {
  get(): Promise<PlanDTO | null> {
    return apiFetch<{ plan: PlanDTO | null }>("/api/plan").then((r) => r.plan);
  },
  regenerate(body: RegenerateBody): Promise<{ profile: ProfileDTO; plan: PlanDTO }> {
    return apiFetch<{ profile: ProfileDTO; plan: PlanDTO }>("/api/plan/regenerate", {
      method: "POST",
      body,
    });
  },
};

export const workoutsApi = {
  update(id: string, body: WorkoutPatchBody): Promise<PlannedWorkoutDTO> {
    return apiFetch<{ workout: PlannedWorkoutDTO }>(`/api/workouts/${id}`, {
      method: "PATCH",
      body,
    }).then((r) => r.workout);
  },
};

export const runsApi = {
  list(params?: { from?: string; to?: string }): Promise<LoggedRunDTO[]> {
    const query = new URLSearchParams();
    if (params?.from) query.set("from", params.from);
    if (params?.to) query.set("to", params.to);
    const qs = query.toString();
    return apiFetch<{ runs: LoggedRunDTO[] }>(`/api/runs${qs ? `?${qs}` : ""}`).then((r) => r.runs);
  },
  create(body: RunCreateBody): Promise<LoggedRunDTO> {
    return apiFetch<{ run: LoggedRunDTO }>("/api/runs", { method: "POST", body }).then(
      (r) => r.run,
    );
  },
  update(id: string, body: RunPatchBody): Promise<LoggedRunDTO> {
    return apiFetch<{ run: LoggedRunDTO }>(`/api/runs/${id}`, { method: "PATCH", body }).then(
      (r) => r.run,
    );
  },
  remove(id: string): Promise<void> {
    return apiFetch<undefined>(`/api/runs/${id}`, { method: "DELETE" }).then(() => undefined);
  },
};

export const statsApi = {
  get(): Promise<StatsDTO> {
    return apiFetch<StatsDTO>("/api/stats");
  },
};
