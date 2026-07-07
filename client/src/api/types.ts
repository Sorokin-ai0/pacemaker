/**
 * DTOs mirroring API_CONTRACT.md exactly.
 * All distances in km, durations in seconds, paces in seconds-per-km.
 * Dates are ISO strings (YYYY-MM-DD for calendar dates, full ISO for timestamps).
 */

export type ExperienceLevel = "beginner" | "intermediate" | "advanced";
export type WorkoutType = "long" | "easy" | "tempo" | "speed" | "rest" | "race";
export type Phase = "base" | "build" | "peak" | "taper";
export type Unit = "mi" | "km";

export interface UserDTO {
  id: string;
  email: string;
  unitPreference: Unit;
  createdAt: string;
  hasProfile: boolean;
}

export interface ProfileDTO {
  experienceLevel: ExperienceLevel;
  currentWeeklyMileageKm: number;
  raceDate: string;
  /** 0 = Sunday … 6 = Saturday */
  longRunDay: number;
}

export interface PlannedWorkoutDTO {
  id: string;
  date: string;
  type: WorkoutType;
  targetDistanceKm: number | null;
  targetPaceZone: string | null;
  notes: string | null;
  weekIndex: number;
  phase: Phase;
  loggedRunId: string | null;
}

export interface PlanDTO {
  id: string;
  startDate: string;
  raceDate: string;
  totalWeeks: number;
  generatedAt: string;
  workouts: PlannedWorkoutDTO[];
}

export interface LoggedRunDTO {
  id: string;
  date: string;
  distanceKm: number;
  durationSeconds: number;
  paceSecPerKm: number;
  avgHeartRate: number | null;
  rpe: number | null;
  notes: string | null;
  plannedWorkoutId: string | null;
}

// ---- Request bodies ----

export interface OnboardingBody {
  experienceLevel: ExperienceLevel;
  currentWeeklyMileageKm: number;
  raceDate: string;
  longRunDay: number;
}

export type RegenerateBody = Partial<OnboardingBody>;

export interface WorkoutPatchBody {
  date?: string;
  type?: WorkoutType;
  targetDistanceKm?: number | null;
  targetPaceZone?: string | null;
  notes?: string | null;
}

export interface RunCreateBody {
  date: string;
  distanceKm: number;
  durationSeconds: number;
  avgHeartRate?: number | null;
  rpe?: number | null;
  notes?: string | null;
  plannedWorkoutId?: string | null;
}

export type RunPatchBody = Partial<RunCreateBody>;

// ---- Stats ----

export interface WeeklyMileagePointDTO {
  weekStart: string;
  plannedKm: number;
  loggedKm: number;
}

export interface PaceTrendPointDTO {
  date: string;
  paceSecPerKm: number;
  distanceKm: number;
}

export interface AdherenceDTO {
  plannedToDate: number;
  completed: number;
  percent: number;
}

export interface ProjectionBasisRunDTO {
  date: string;
  distanceKm: number;
  durationSeconds: number;
}

export interface ProjectionDTO {
  basisRun: ProjectionBasisRunDTO | null;
  projectedSeconds: number | null;
}

export interface CountdownDTO {
  raceDate: string;
  daysToRace: number;
}

export interface TaperDTO {
  active: boolean;
  startDate: string;
}

export interface StatsDTO {
  weeklyMileage: WeeklyMileagePointDTO[];
  paceTrend: PaceTrendPointDTO[];
  adherence: AdherenceDTO;
  projection: ProjectionDTO;
  countdown: CountdownDTO;
  taper: TaperDTO;
}
