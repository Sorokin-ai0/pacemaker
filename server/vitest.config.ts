import { defineConfig } from "vitest/config";

/**
 * Server test config.
 *
 * - `env` is applied to `process.env` before any test module (and therefore
 *   before the PrismaClient in src/db.ts) is imported, pointing Prisma at a
 *   throwaway SQLite db. src/env.ts uses dotenv, which never overrides
 *   variables already present, so server/.env (dev.db) cannot leak in.
 * - `globalSetup` creates/destroys server/prisma/test.db around the run.
 * - `fileParallelism: false` — all test files share the one SQLite file, so
 *   they must run serially.
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/tests/**/*.test.ts"],
    setupFiles: ["src/tests/setup.ts"],
    globalSetup: ["src/tests/globalSetup.ts"],
    fileParallelism: false,
    env: {
      NODE_ENV: "test",
      DATABASE_URL: "file:./test.db",
      JWT_SECRET: "pacemaker-test-secret",
      SEED_DEMO: "false",
    },
  },
});
