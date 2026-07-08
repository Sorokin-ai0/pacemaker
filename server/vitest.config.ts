import { defineConfig } from "vitest/config";

/**
 * Server test config.
 *
 * - The PURE planGenerator tests always run (no database needed).
 * - The DB-backed suites (auth.test.ts, flow.test.ts) run only when
 *   TEST_DATABASE_URL points at a SEPARATE, throwaway Postgres database — its
 *   tables are truncated on every run, so NEVER point it at a real/production
 *   database. When it is unset, those suites skip cleanly.
 *
 *   Example:
 *     TEST_DATABASE_URL="postgresql://…pooler.supabase.com:5432/postgres" npm test
 */
const testDbUrl = process.env.TEST_DATABASE_URL;

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/tests/**/*.test.ts"],
    setupFiles: ["src/tests/setup.ts"],
    globalSetup: ["src/tests/globalSetup.ts"],
    fileParallelism: false,
    env: {
      NODE_ENV: "test",
      JWT_SECRET: "pacemaker-test-secret",
      SEED_DEMO: "false",
      // Only override the connection when a dedicated test DB is provided.
      ...(testDbUrl ? { DATABASE_URL: testDbUrl } : {}),
    },
  },
});
