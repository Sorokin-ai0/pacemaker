import path from "node:path";
import { fileURLToPath } from "node:url";
import express, { type Express } from "express";
import cookieParser from "cookie-parser";
import { env } from "./env.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { authRouter } from "./routes/auth.js";
import { healthRouter } from "./routes/health.js";
import { meRouter } from "./routes/me.js";
import { onboardingRouter } from "./routes/onboarding.js";
import { planRouter } from "./routes/plan.js";
import { runsRouter } from "./routes/runs.js";
import { statsRouter } from "./routes/stats.js";
import { workoutsRouter } from "./routes/workouts.js";

/**
 * Express app factory — no listening, no side effects beyond middleware setup,
 * so tests can import it and drive it with Supertest.
 */
export function createApp(): Express {
  const app = express();
  app.disable("x-powered-by");

  app.use(express.json());
  app.use(cookieParser());

  app.use("/api/health", healthRouter);
  app.use("/api/auth", authRouter);
  app.use("/api/me", meRouter);
  app.use("/api/onboarding", onboardingRouter);
  app.use("/api/plan", planRouter);
  app.use("/api/workouts", workoutsRouter);
  app.use("/api/runs", runsRouter);
  app.use("/api/stats", statsRouter);

  // Unknown /api/* → uniform JSON 404.
  app.use("/api", (_req, res) => {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Route not found" } });
  });

  // Production: serve the built SPA with an index.html fallback for non-API GETs.
  if (env.isProduction) {
    // From server/dist/app.js (or server/src/app.ts) → repo-root/client/dist.
    const clientDist = path.resolve(
      path.dirname(fileURLToPath(import.meta.url)),
      "../../client/dist",
    );
    app.use(express.static(clientDist));
    app.get("*", (req, res, next) => {
      if (req.path.startsWith("/api")) {
        next();
        return;
      }
      res.sendFile(path.join(clientDist, "index.html"));
    });
  }

  app.use(errorHandler);
  return app;
}
