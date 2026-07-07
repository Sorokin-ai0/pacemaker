import { createApp } from "./app.js";
import { prisma } from "./db.js";
import { env } from "./env.js";
import { ensureDemoSeed } from "./lib/demoSeed.js";

async function main(): Promise<void> {
  if (env.SEED_DEMO) {
    const userCount = await prisma.user.count();
    if (userCount === 0) {
      console.log("SEED_DEMO=true and database is empty — seeding demo data…");
      const summary = await ensureDemoSeed();
      console.log(
        `Seeded demo user ${summary.email} (${summary.totalWeeks}-week plan, ` +
          `${summary.workouts} workouts, ${summary.runs} logged runs)`,
      );
    }
  }

  const app = createApp();
  app.listen(env.PORT, () => {
    console.log(`Pacemaker API listening on http://localhost:${env.PORT} (${env.NODE_ENV})`);
  });
}

main().catch((err) => {
  console.error("Fatal startup error:", err);
  process.exitCode = 1;
});
