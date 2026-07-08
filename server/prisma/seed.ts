/**
 * Demo seed CLI — `npm run db:seed -w server` (runs via tsx, not compiled).
 * Idempotent: delegates to ensureDemoSeed(), which deletes and rebuilds the
 * demo user's data on every invocation.
 *
 * PREVIEW BUILD: demo data is disabled by default so the app launches blank
 * (the client currently runs on localStorage only — see README). Seeding is
 * explicit opt-in for when the real backend is wired back up:
 *   SEED_DEMO=true npm run db:seed
 */

import { prisma } from "../src/db.js";
import { DEMO_PASSWORD, ensureDemoSeed } from "../src/lib/demoSeed.js";

async function main(): Promise<void> {
  if (process.env.SEED_DEMO !== "true") {
    console.log(
      "Demo seeding is disabled in the local-storage preview build.\n" +
        "Run with SEED_DEMO=true to seed the demo user (real-backend mode only).",
    );
    return;
  }
  const summary = await ensureDemoSeed();
  console.log("Demo seed complete:");
  console.log(`  user:      ${summary.email} / ${DEMO_PASSWORD}`);
  console.log(`  race date: ${summary.raceDate}`);
  console.log(`  plan:      ${summary.totalWeeks} weeks, ${summary.workouts} workouts`);
  console.log(`  runs:      ${summary.runs} logged`);
}

main()
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
