/**
 * Unit tests for the pure plan generator (PLAN.md §4, DECISIONS.md #5–7,
 * #15, #18–19). No DB, no HTTP — the function is called directly with an
 * injected fixed `today`, so everything here is fully deterministic.
 */

import { describe, expect, it } from "vitest";
import {
  computePhaseWeeks,
  generatePlan,
  type ExperienceLevel,
  type GeneratedPlan,
  type GeneratedWorkout,
  type GeneratePlanInput,
} from "../lib/planGenerator.js";
import { addDays, daysBetween, round1, toDateString, utcMidnight } from "../lib/dates.js";

// Fixed reference date (a Monday), with a time-of-day component to prove the
// generator truncates to UTC midnight.
const TODAY = new Date("2026-07-06T15:23:45.000Z");
const T0 = utcMidnight(TODAY);

function makeInput(overrides: Partial<GeneratePlanInput> = {}): GeneratePlanInput {
  return {
    today: TODAY,
    raceDate: addDays(T0, 70), // exactly 10 weeks out
    experienceLevel: "intermediate",
    currentWeeklyMileageKm: 40,
    longRunDay: 6,
    ...overrides,
  };
}

function byWeek(plan: GeneratedPlan): GeneratedWorkout[][] {
  const weeks: GeneratedWorkout[][] = Array.from({ length: plan.totalWeeks }, () => []);
  for (const w of plan.workouts) weeks[w.weekIndex].push(w);
  return weeks;
}

function weeklyTotal(workouts: GeneratedWorkout[]): number {
  return workouts.reduce((sum, w) => sum + (w.targetDistanceKm ?? 0), 0);
}

function longRuns(plan: GeneratedPlan): GeneratedWorkout[] {
  return plan.workouts.filter((w) => w.type === "long");
}

/** Plan must span exactly totalWeeks×7 consecutive days ending on race date. */
function expectSpansConsecutiveDaysEndingOnRace(plan: GeneratedPlan): void {
  expect(plan.workouts).toHaveLength(plan.totalWeeks * 7);
  expect(plan.startDate).toEqual(addDays(plan.raceDate, -(plan.totalWeeks * 7 - 1)));
  plan.workouts.forEach((w, i) => {
    expect(w.date).toEqual(addDays(plan.startDate, i));
  });
  expect(plan.workouts[plan.workouts.length - 1].date).toEqual(plan.raceDate);
}

describe("length & clamping (DECISIONS #7, #15)", () => {
  it("race exactly 10 weeks out → 10-week plan ending on race day", () => {
    const plan = generatePlan(makeInput());
    expect(plan.totalWeeks).toBe(10);
    expect(plan.raceDate).toEqual(addDays(T0, 70));
    expectSpansConsecutiveDaysEndingOnRace(plan);
  });

  it("race 5 weeks out → clamped up to 8 weeks; early weeks fall in the past", () => {
    const plan = generatePlan(makeInput({ raceDate: addDays(T0, 35) }));
    expect(plan.totalWeeks).toBe(8);
    expect(plan.raceDate).toEqual(addDays(T0, 35));
    expect(plan.startDate.getTime()).toBeLessThan(T0.getTime());
    expectSpansConsecutiveDaysEndingOnRace(plan);
  });

  it("race 30 weeks out → clamped down to 20 weeks; plan starts in the future", () => {
    const plan = generatePlan(makeInput({ raceDate: addDays(T0, 210) }));
    expect(plan.totalWeeks).toBe(20);
    expect(plan.raceDate).toEqual(addDays(T0, 210));
    expect(plan.startDate.getTime()).toBeGreaterThan(T0.getTime());
    expectSpansConsecutiveDaysEndingOnRace(plan);
  });

  it("race date null → 14 weeks with raceDate = today + 14 weeks", () => {
    const plan = generatePlan(makeInput({ raceDate: null }));
    expect(plan.totalWeeks).toBe(14);
    expect(plan.raceDate).toEqual(addDays(T0, 98));
    expectSpansConsecutiveDaysEndingOnRace(plan);
  });

  it("race date in the past → 14 weeks with raceDate = today + 14 weeks", () => {
    const plan = generatePlan(makeInput({ raceDate: addDays(T0, -7) }));
    expect(plan.totalWeeks).toBe(14);
    expect(plan.raceDate).toEqual(addDays(T0, 98));
  });

  it("race date today or invalid → 14-week default", () => {
    expect(generatePlan(makeInput({ raceDate: T0 })).totalWeeks).toBe(14);
    expect(generatePlan(makeInput({ raceDate: new Date("nonsense") })).totalWeeks).toBe(14);
  });

  it("partial weeks floor: 69 days out → 9 weeks; 56 days → exactly 8", () => {
    expect(generatePlan(makeInput({ raceDate: addDays(T0, 69) })).totalWeeks).toBe(9);
    expect(generatePlan(makeInput({ raceDate: addDays(T0, 56) })).totalWeeks).toBe(8);
  });
});

describe("phase distribution", () => {
  it("W=8 splits per the formulas: base 2 / build 3 / peak 1 / taper 2", () => {
    expect(computePhaseWeeks(8)).toEqual({ base: 2, build: 3, peak: 1, taper: 2 });
  });

  it("for every W in 8–20: phases sum to W, taper ≥ 2, peak ≥ 1, base ≥ 1", () => {
    for (let w = 8; w <= 20; w++) {
      const p = computePhaseWeeks(w);
      expect(p.base + p.build + p.peak + p.taper).toBe(w);
      expect(p.taper).toBeGreaterThanOrEqual(2);
      expect(p.peak).toBeGreaterThanOrEqual(1);
      expect(p.base).toBeGreaterThanOrEqual(1);
      expect(p.build).toBeGreaterThanOrEqual(0);
    }
  });

  it("workouts are tagged base→build→peak→taper in contiguous blocks with correct weekIndex", () => {
    const plan = generatePlan(makeInput({ raceDate: addDays(T0, 12 * 7) }));
    expect(plan.totalWeeks).toBe(12);
    const p = computePhaseWeeks(12);

    const expectedPhase = (week: number): string => {
      if (week < p.base) return "base";
      if (week < p.base + p.build) return "build";
      if (week < p.base + p.build + p.peak) return "peak";
      return "taper";
    };

    for (const w of plan.workouts) {
      expect(w.weekIndex).toBe(Math.floor(daysBetween(plan.startDate, w.date) / 7));
      expect(w.phase).toBe(expectedPhase(w.weekIndex));
    }

    // Ordering is monotone: phase rank never decreases as weeks advance.
    const rank = { base: 0, build: 1, peak: 2, taper: 3 } as const;
    const weekPhases = byWeek(plan).map((ws) => ws[0].phase);
    for (let i = 1; i < weekPhases.length; i++) {
      expect(rank[weekPhases[i]]).toBeGreaterThanOrEqual(rank[weekPhases[i - 1]]);
    }
    expect(weekPhases[0]).toBe("base");
    expect(weekPhases[weekPhases.length - 1]).toBe("taper");
  });
});

describe("weekly composition (DECISIONS #6)", () => {
  it.each([0, 3, 6])(
    "longRunDay=%i: non-race weeks have 1 long + 1 quality + 3 easy + 2 rest, long on the requested weekday",
    (longRunDay) => {
      const plan = generatePlan(makeInput({ longRunDay, raceDate: addDays(T0, 12 * 7) }));
      const weeks = byWeek(plan);

      for (let w = 0; w < plan.totalWeeks - 1; w++) {
        const week = weeks[w];
        expect(week).toHaveLength(7);
        const count = (type: string) => week.filter((d) => d.type === type).length;

        expect(count("long")).toBe(1);
        expect(count("easy")).toBe(3);
        expect(count("rest")).toBe(2);
        // Quality alternates: tempo on even weekIndex, speed on odd.
        expect(count("tempo")).toBe(w % 2 === 0 ? 1 : 0);
        expect(count("speed")).toBe(w % 2 === 0 ? 0 : 1);
        expect(count("race")).toBe(0);

        const long = week.find((d) => d.type === "long")!;
        expect(long.date.getUTCDay()).toBe(longRunDay);
      }
    },
  );
});

describe("long-run caps & overreach (DECISIONS #5)", () => {
  it("beginner longs never exceed 19.3 km and there is NO overreach anywhere", () => {
    for (const weeks of [8, 16, 20]) {
      const plan = generatePlan(
        makeInput({
          experienceLevel: "beginner",
          currentWeeklyMileageKm: 45,
          raceDate: addDays(T0, weeks * 7),
        }),
      );
      const longs = longRuns(plan);
      expect(longs).toHaveLength(plan.totalWeeks - 1); // every non-race week
      for (const l of longs) {
        expect(l.targetDistanceKm!).toBeLessThanOrEqual(19.3);
      }
      expect(plan.workouts.some((w) => w.targetDistanceKm === 22.5)).toBe(false);
    }
  });

  it.each<[ExperienceLevel, number]>([
    ["intermediate", 40],
    ["advanced", 60],
  ])("%s: longs ≤ 21.1 except exactly one 22.5 overreach 2 weeks before taper", (level, kml) => {
    const plan = generatePlan(
      makeInput({
        experienceLevel: level,
        currentWeeklyMileageKm: kml,
        raceDate: addDays(T0, 16 * 7),
      }),
    );
    const firstTaperWeek = plan.totalWeeks - computePhaseWeeks(plan.totalWeeks).taper;

    const overreaches = longRuns(plan).filter((l) => l.targetDistanceKm === 22.5);
    expect(overreaches).toHaveLength(1);
    expect(overreaches[0].weekIndex).toBe(firstTaperWeek - 2);

    for (const l of longRuns(plan)) {
      if (l.weekIndex === firstTaperWeek - 2) continue;
      expect(l.targetDistanceKm!).toBeLessThanOrEqual(21.1);
    }
  });

  it("advanced 60 km/wk over 20 weeks actually reaches the 21.1 km cap", () => {
    const plan = generatePlan(
      makeInput({
        experienceLevel: "advanced",
        currentWeeklyMileageKm: 60,
        raceDate: addDays(T0, 20 * 7),
      }),
    );
    expect(longRuns(plan).some((l) => l.targetDistanceKm === 21.1)).toBe(true);
  });
});

describe("race week", () => {
  it("has exactly one 21.1 km race on race day, two 3 km shakeouts before it, rest otherwise, no long", () => {
    const plan = generatePlan(makeInput({ raceDate: addDays(T0, 12 * 7) }));
    const raceWeek = byWeek(plan)[plan.totalWeeks - 1];
    expect(raceWeek).toHaveLength(7);

    const races = raceWeek.filter((w) => w.type === "race");
    expect(races).toHaveLength(1);
    expect(races[0].targetDistanceKm).toBe(21.1);
    expect(races[0].date).toEqual(plan.raceDate);

    const shakeouts = raceWeek.filter((w) => w.type === "easy");
    expect(shakeouts).toHaveLength(2);
    for (const s of shakeouts) {
      expect(s.targetDistanceKm).toBe(3);
      expect(s.date.getTime()).toBeLessThan(plan.raceDate.getTime());
    }
    expect(shakeouts.map((s) => toDateString(s.date)).sort()).toEqual(
      [addDays(plan.raceDate, -4), addDays(plan.raceDate, -2)].map(toDateString).sort(),
    );

    expect(raceWeek.filter((w) => w.type === "rest")).toHaveLength(4);
    expect(raceWeek.filter((w) => w.type === "long")).toHaveLength(0);
  });
});

describe("weekly volume (DECISIONS #18, #19)", () => {
  it("week 3 is a cutback at ≈80% of week 2, and week 4 resumes above it", () => {
    const plan = generatePlan(makeInput({ raceDate: addDays(T0, 12 * 7) }));
    const totals = byWeek(plan).map(weeklyTotal);
    expect(Math.abs(totals[3] / totals[2] - 0.8)).toBeLessThan(0.02);
    expect(totals[4]).toBeGreaterThan(totals[3]);
    expect(totals[4]).toBeGreaterThan(totals[2]); // resumes pre-cutback trajectory
  });

  it.each<[ExperienceLevel, number, number]>([
    // [level, starting km, documented cap = min(2×start, 50/70/90)]
    ["advanced", 60, 90],
    ["beginner", 30, 50],
    ["beginner", 20, 40],
    ["intermediate", 45, 70],
  ])("%s starting at %i km/wk never exceeds %i km in any week", (level, start, cap) => {
    const plan = generatePlan(
      makeInput({
        experienceLevel: level,
        currentWeeklyMileageKm: start,
        raceDate: addDays(T0, 20 * 7), // longest ramp = worst case
      }),
    );
    const totals = byWeek(plan).map(weeklyTotal);
    for (let w = 0; w < plan.totalWeeks - 1; w++) {
      // + 0.31 tolerance: each of the five runnable distances rounds to 0.1 km
      expect(totals[w]).toBeLessThanOrEqual(cap + 0.31);
    }
    // The ramp must actually approach the cap, or the assertion is vacuous.
    expect(Math.max(...totals)).toBeGreaterThan(cap * 0.9);
  });

  it("taper weekly volume is below peak weekly volume", () => {
    for (const level of ["beginner", "intermediate", "advanced"] as const) {
      const plan = generatePlan(
        makeInput({ experienceLevel: level, raceDate: addDays(T0, 14 * 7) }),
      );
      const totals = byWeek(plan).map(weeklyTotal);
      const firstTaperWeek = plan.totalWeeks - computePhaseWeeks(plan.totalWeeks).taper;
      const peakMax = Math.max(...totals.slice(0, firstTaperWeek));
      expect(totals[firstTaperWeek]).toBeLessThan(peakMax);
    }
  });
});

describe("determinism & distances", () => {
  it("two calls with identical inputs produce deep-equal plans", () => {
    const a = generatePlan(makeInput());
    const b = generatePlan(makeInput());
    expect(a).toEqual(b);
    expect(generatePlan(makeInput({ raceDate: null }))).toEqual(
      generatePlan(makeInput({ raceDate: null })),
    );
  });

  it("runnable workouts have positive 0.1-rounded distances; rest days are null", () => {
    const scenarios: Array<Partial<GeneratePlanInput>> = [
      // beginner below the 15 km floor over the shortest plan = tightest volumes
      { experienceLevel: "beginner", currentWeeklyMileageKm: 10, raceDate: addDays(T0, 56) },
      { experienceLevel: "intermediate", currentWeeklyMileageKm: 40, raceDate: addDays(T0, 84) },
      { experienceLevel: "advanced", currentWeeklyMileageKm: 60, raceDate: addDays(T0, 140) },
      { experienceLevel: "beginner", currentWeeklyMileageKm: 45, raceDate: null },
    ];
    for (const overrides of scenarios) {
      const plan = generatePlan(makeInput(overrides));
      for (const w of plan.workouts) {
        if (w.type === "rest") {
          expect(w.targetDistanceKm).toBeNull();
          expect(w.targetPaceZone).toBeNull();
        } else {
          expect(w.targetDistanceKm).not.toBeNull();
          expect(w.targetDistanceKm!).toBeGreaterThan(0);
          expect(round1(w.targetDistanceKm!)).toBe(w.targetDistanceKm);
          expect(w.targetPaceZone).toBeTruthy();
        }
      }
    }
  });
});
