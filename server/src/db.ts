import { PrismaClient } from "@prisma/client";
import "./env.js"; // ensure .env is loaded before Prisma reads DATABASE_URL

// Singleton PrismaClient. Constructing the client performs no I/O; the first
// query lazily opens the SQLite connection, so importing this module is
// side-effect free from a test's point of view.
export const prisma = new PrismaClient();
