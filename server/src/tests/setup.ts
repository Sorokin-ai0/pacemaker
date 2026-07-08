/**
 * Per-file safety net. When DB-backed tests are enabled (TEST_DATABASE_URL set),
 * refuse to run unless the live DATABASE_URL is exactly that throwaway test DB —
 * this prevents the suites (which delete/truncate rows) from ever touching a
 * real database. When TEST_DATABASE_URL is unset, the DB suites skip themselves.
 */
const testUrl = process.env.TEST_DATABASE_URL;
if (testUrl && process.env.DATABASE_URL !== testUrl) {
  throw new Error(
    "Refusing to run DB tests: DATABASE_URL does not match TEST_DATABASE_URL. " +
      "Point TEST_DATABASE_URL at a dedicated throwaway Postgres database.",
  );
}
