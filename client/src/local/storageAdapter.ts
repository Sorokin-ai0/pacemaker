/**
 * TEMPORARY LOCAL-ONLY PERSISTENCE — preview build.
 *
 * All app data (user, profile, plan, runs, display settings) lives in browser
 * localStorage behind this tiny adapter. It exists so the rest of the app talks
 * to a storage *interface* rather than localStorage directly: when the real
 * backend (Express + Prisma + JWT auth) is wired back in, swap the
 * implementation in `src/api/endpoints.ts` from `localBackend` back to the
 * HTTP client in `src/api/http.ts` and delete the `src/local/` folder —
 * no component changes required.
 */

const NAMESPACE = "pacemaker.";

export const storageKeys = {
  user: `${NAMESPACE}user`,
  session: `${NAMESPACE}session`,
  profile: `${NAMESPACE}profile`,
  plan: `${NAMESPACE}plan`,
  runs: `${NAMESPACE}runs`,
  displaySettings: `${NAMESPACE}displaySettings`,
  /** Theme key predates this adapter; kept for back-compat with ThemeProvider. */
  theme: `${NAMESPACE}theme`,
  // AI coach state (client-side only): rolling chat history + small caches so we
  // don't re-bill the model for an unchanged brief/check-in, and snapshots used
  // to detect a regenerated plan or a newly logged run.
  coachChat: `${NAMESPACE}coach.chat`,
  coachDailyBrief: `${NAMESPACE}coach.dailyBrief`,
  coachWeekly: `${NAMESPACE}coach.weekly`,
  coachPlanSnapshot: `${NAMESPACE}coach.planSnapshot`,
} as const;

export const storage = {
  getJSON<T>(key: string): T | null {
    try {
      const raw = window.localStorage.getItem(key);
      return raw === null ? null : (JSON.parse(raw) as T);
    } catch {
      return null;
    }
  },

  setJSON(key: string, value: unknown): void {
    window.localStorage.setItem(key, JSON.stringify(value));
  },

  remove(key: string): void {
    window.localStorage.removeItem(key);
  },

  /** "Reset all local data" — wipes every pacemaker.* key (including theme). */
  clearAll(): void {
    const doomed: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (key !== null && key.startsWith(NAMESPACE)) doomed.push(key);
    }
    doomed.forEach((key) => window.localStorage.removeItem(key));
  },
};
