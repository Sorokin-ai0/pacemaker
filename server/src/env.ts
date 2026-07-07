import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

// Load server/.env regardless of cwd (works from src/ in dev and dist/ in prod).
// dotenv never overrides variables already present in process.env, so tests and
// deploy environments that set DATABASE_URL etc. explicitly always win.
const serverDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
dotenv.config({ path: path.join(serverDir, ".env") });

const nodeEnv = process.env.NODE_ENV ?? "development";

export const env = {
  NODE_ENV: nodeEnv,
  isProduction: nodeEnv === "production",
  PORT: Number.parseInt(process.env.PORT ?? "3001", 10),
  JWT_SECRET: process.env.JWT_SECRET ?? "dev-secret-change-me",
  SEED_DEMO: process.env.SEED_DEMO === "true",
} as const;
