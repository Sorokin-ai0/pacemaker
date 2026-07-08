/**
 * Vitest global setup for the DB-backed suites.
 *
 * Runs only when TEST_DATABASE_URL is set (a SEPARATE throwaway Postgres DB):
 * syncs the Prisma schema to it and truncates every table so each run starts
 * clean. When unset, this is a no-op and the DB suites skip themselves.
 */

import { execSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const serverDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

export async function setup(): Promise<void> {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) return;

  execSync("npx prisma db push --skip-generate --accept-data-loss", {
    cwd: serverDir,
    env: { ...process.env, DATABASE_URL: url },
    stdio: "pipe",
  });

  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient({ datasources: { db: { url } } });
  try {
    await prisma.$executeRawUnsafe(
      'TRUNCATE "LoggedRun", "PlannedWorkout", "TrainingPlan", "Profile", "User" RESTART IDENTITY CASCADE',
    );
  } finally {
    await prisma.$disconnect();
  }
}

export function teardown(): void {
  // Nothing to tear down — the throwaway DB is truncated at the start of each run.
}
