/**
 * Per-file safety net: refuse to run if the environment does not point at the
 * throwaway test database. Protects server/prisma/dev.db (seeded demo data)
 * from ever being wiped by a misconfigured run.
 */
if (!process.env.DATABASE_URL?.includes("test.db")) {
  throw new Error(
    `Refusing to run tests against DATABASE_URL="${process.env.DATABASE_URL ?? ""}" — ` +
      "expected the isolated file:./test.db (see server/vitest.config.ts).",
  );
}
