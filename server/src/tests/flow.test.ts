/**
 * End-to-end API happy path: register → onboarding → plan → reschedule →
 * log a linked run → stats — plus the input rejections around that flow.
 *
 * One walk, sequential `it` blocks sharing state (vitest runs them in
 * declaration order within a file).
 *
 * Date note (DECISIONS.md #15): a plan anchors its END at race date, so a
 * race exactly 10 weeks (70 days) out yields a 10-week plan starting
 * tomorrow. To exercise adherence we PATCH one workout onto today's date
 * before linking a run to it.
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../app.js";
import { prisma } from "../db.js";
import { addDays, toDateString, utcMidnight } from "../lib/dates.js";

const app = createApp();
const agent = request.agent(app); // user A, keeps the pm_token cookie

const today = utcMidnight(new Date());
const todayStr = toDateString(today);
const raceDateStr = toDateString(addDays(today, 70)); // exactly 10 weeks out

interface WorkoutDTO {
  id: string;
  date: string;
  type: string;
  targetDistanceKm: number | null;
  weekIndex: number;
  phase: string;
  loggedRunId: string | null;
}

let plan: { id: string; totalWeeks: number; startDate: string; workouts: WorkoutDTO[] };
let rescheduled: WorkoutDTO; // easy workout moved +1 day
let linked: WorkoutDTO; // easy workout moved to today, then linked to a run
let runId: string;

beforeAll(async () => {
  await prisma.user.deleteMany({});
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("happy path: register → onboarding → plan → run → stats", () => {
  it("registers the runner", async () => {
    const res = await agent
      .post("/api/auth/register")
      .send({ email: "flow-a@example.com", password: "password123" });
    expect(res.status).toBe(201);
    expect(res.body.user.hasProfile).toBe(false);
  });

  it("onboards with a race 10 weeks out and receives the full plan", async () => {
    const res = await agent.post("/api/onboarding").send({
      experienceLevel: "intermediate",
      currentWeeklyMileageKm: 40,
      raceDate: raceDateStr,
      longRunDay: 6,
    });

    expect(res.status).toBe(201);
    expect(res.body.profile).toEqual({
      experienceLevel: "intermediate",
      currentWeeklyMileageKm: 40,
      raceDate: raceDateStr,
      longRunDay: 6,
    });

    plan = res.body.plan;
    expect(plan.totalWeeks).toBe(10);
    expect(plan.workouts).toHaveLength(10 * 7);

    // Workouts are ordered by date; the very last one is the race on race day.
    const last = plan.workouts[plan.workouts.length - 1];
    expect(last.type).toBe("race");
    expect(last.date).toBe(raceDateStr);
    expect(last.targetDistanceKm).toBe(21.1);
  });

  it("GET /api/plan returns the same plan", async () => {
    const res = await agent.get("/api/plan");
    expect(res.status).toBe(200);
    expect(res.body.plan.id).toBe(plan.id);
    expect(res.body.plan.totalWeeks).toBe(10);
    expect(res.body.plan.workouts).toHaveLength(70);
  });

  it("reschedules a workout one day later", async () => {
    const target = plan.workouts.find((w) => w.type === "easy" && w.weekIndex === 4);
    expect(target).toBeDefined();
    const movedTo = toDateString(addDays(new Date(`${target!.date}T00:00:00.000Z`), 1));

    const res = await agent.patch(`/api/workouts/${target!.id}`).send({ date: movedTo });
    expect(res.status).toBe(200);
    expect(res.body.workout.id).toBe(target!.id);
    expect(res.body.workout.date).toBe(movedTo);
    expect(res.body.workout.weekIndex).toBe(4); // stays in its plan week (DECISIONS #20)
    rescheduled = res.body.workout;
  });

  it("logs a run against a planned workout with server-computed pace", async () => {
    // Move an easy workout onto today so it is due (the plan starts tomorrow).
    const target = plan.workouts.find(
      (w) => w.type === "easy" && w.weekIndex === 2 && w.id !== rescheduled.id,
    );
    expect(target).toBeDefined();
    const moved = await agent.patch(`/api/workouts/${target!.id}`).send({ date: todayStr });
    expect(moved.status).toBe(200);
    linked = moved.body.workout;

    const res = await agent.post("/api/runs").send({
      date: todayStr,
      distanceKm: 8,
      durationSeconds: 2400,
      rpe: 6,
      plannedWorkoutId: linked.id,
      paceSecPerKm: 1, // must be ignored — pace is server-computed
    });

    expect(res.status).toBe(201);
    expect(res.body.run.paceSecPerKm).toBe(300); // 2400 s / 8 km, not the bogus input
    expect(res.body.run.plannedWorkoutId).toBe(linked.id);
    expect(res.body.run.rpe).toBe(6);
    runId = res.body.run.id;
  });

  it("plan now carries loggedRunId on the linked workout", async () => {
    const res = await agent.get("/api/plan");
    expect(res.status).toBe(200);
    const workouts = res.body.plan.workouts as WorkoutDTO[];
    expect(workouts.find((w) => w.id === linked.id)?.loggedRunId).toBe(runId);
    // ...and only on that workout.
    const carrying = workouts.filter((w) => w.loggedRunId !== null);
    expect(carrying).toHaveLength(1);
  });

  it("stats expose all six keys and adherence reflects the run", async () => {
    const res = await agent.get("/api/stats");
    expect(res.status).toBe(200);
    const stats = res.body;

    expect(Object.keys(stats).sort()).toEqual([
      "adherence",
      "countdown",
      "paceTrend",
      "projection",
      "taper",
      "weeklyMileage",
    ]);

    // The workout moved to today is the only non-rest workout due so far.
    expect(stats.adherence).toEqual({ plannedToDate: 1, completed: 1, percent: 100 });

    expect(stats.weeklyMileage).toHaveLength(10);
    expect(stats.weeklyMileage[0].plannedKm).toBeGreaterThan(0);

    expect(stats.paceTrend).toEqual([{ date: todayStr, paceSecPerKm: 300, distanceKm: 8 }]);

    // Today's 8 km run qualifies as the Riegel basis (≥ 8 km, within 60 days).
    expect(stats.projection.basisRun).toEqual({
      date: todayStr,
      distanceKm: 8,
      durationSeconds: 2400,
    });
    expect(stats.projection.projectedSeconds).toBe(
      Math.round(2400 * Math.pow(21.0975 / 8, 1.06)),
    );

    expect(stats.countdown).toEqual({ raceDate: raceDateStr, daysToRace: 70 });

    // Taper = final two plan weeks; the plan barely started, so not active.
    expect(stats.taper.active).toBe(false);
    const planStart = utcMidnight(new Date(`${plan.startDate}T00:00:00.000Z`));
    expect(stats.taper.startDate).toBe(toDateString(addDays(planStart, 8 * 7)));
  });
});

describe("invalid inputs around the flow", () => {
  it("rejects rpe 11 with 400 VALIDATION", async () => {
    const res = await agent.post("/api/runs").send({
      date: todayStr,
      distanceKm: 5,
      durationSeconds: 1500,
      rpe: 11,
    });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION");
    const paths = (res.body.error.details as Array<{ path: unknown[] }>).map((i) => i.path[0]);
    expect(paths).toContain("rpe");
  });

  it("rejects non-positive distance and duration with 400 VALIDATION", async () => {
    const res = await agent.post("/api/runs").send({
      date: todayStr,
      distanceKm: 0,
      durationSeconds: -60,
    });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION");
  });

  it("rejects a run linked to another user's workout with 400 VALIDATION", async () => {
    const agentB = request.agent(app);
    await agentB
      .post("/api/auth/register")
      .send({ email: "flow-b@example.com", password: "password123" })
      .expect(201);
    await agentB
      .post("/api/onboarding")
      .send({
        experienceLevel: "beginner",
        currentWeeklyMileageKm: 20,
        raceDate: toDateString(addDays(today, 63)),
        longRunDay: 0,
      })
      .expect(201);

    // B has an active plan of their own, but the workout belongs to A.
    const res = await agentB.post("/api/runs").send({
      date: todayStr,
      distanceKm: 5,
      durationSeconds: 1500,
      plannedWorkoutId: linked.id,
    });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION");
  });

  it("rejects a run linked to a nonexistent workout with 400 VALIDATION", async () => {
    const res = await agent.post("/api/runs").send({
      date: todayStr,
      distanceKm: 5,
      durationSeconds: 1500,
      plannedWorkoutId: "no-such-workout",
    });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION");
  });

  it("returns 404 when patching another user's workout", async () => {
    const agentB = request.agent(app);
    await agentB
      .post("/api/auth/login")
      .send({ email: "flow-b@example.com", password: "password123" })
      .expect(200);
    const res = await agentB.patch(`/api/workouts/${linked.id}`).send({ notes: "mine now" });
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
  });
});
