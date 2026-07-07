/**
 * Vitest global setup: provision an isolated throwaway SQLite database at
 * server/prisma/test.db (never dev.db) and delete it after the run.
 *
 * Runs in the vitest main process; test workers get DATABASE_URL from the
 * `test.env` block in vitest.config.ts, which points at the same file
 * (Prisma resolves relative `file:` URLs against the schema directory).
 */

import { execSync } from "node:child_process";
import { existsSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const serverDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const testDbFile = path.join(serverDir, "prisma", "test.db");

function removeTestDb(): void {
  for (const suffix of ["", "-journal", "-wal", "-shm"]) {
    const file = testDbFile + suffix;
    if (existsSync(file)) rmSync(file);
  }
}

export function setup(): void {
  removeTestDb(); // stale file from a crashed run must not leak state
  execSync("npx prisma db push --skip-generate", {
    cwd: serverDir,
    env: { ...process.env, DATABASE_URL: "file:./test.db" },
    stdio: "pipe",
  });
}

export function teardown(): void {
  removeTestDb();
}
