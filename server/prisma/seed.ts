/**
 * Demo seed CLI — `npm run db:seed -w server` (runs via tsx, not compiled).
 * Idempotent: delegates to ensureDemoSeed(), which deletes and rebuilds the
 * demo user's data on every invocation.
 */

import { prisma } from "../src/db.js";
import { DEMO_PASSWORD, ensureDemoSeed } from "../src/lib/demoSeed.js";

async function main(): Promise<void> {
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
