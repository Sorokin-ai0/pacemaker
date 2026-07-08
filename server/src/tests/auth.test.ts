/**
 * Auth flows (API_CONTRACT.md §Auth) driven through Supertest against the
 * Express app factory — no listening server, isolated test.db.
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";
import { createApp } from "../app.js";
import { prisma } from "../db.js";
import { env } from "../env.js";

const app = createApp();

/** Set-Cookie entries for the pm_token auth cookie. */
function authCookies(res: request.Response): string[] {
  const header = res.get("Set-Cookie") ?? [];
  return header.filter((c) => c.startsWith("pm_token="));
}

beforeAll(async () => {
  if (!process.env.TEST_DATABASE_URL) return; // DB suites skip without a test DB
  await prisma.user.deleteMany({}); // cascades: profiles, plans, workouts, runs
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe.skipIf(!process.env.TEST_DATABASE_URL)("POST /api/auth/register", () => {
  it("creates a user: 201, UserDTO shape, HttpOnly pm_token cookie", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({ email: "runner@example.com", password: "password123" });

    expect(res.status).toBe(201);
    const { user } = res.body as { user: Record<string, unknown> };
    expect(user).toMatchObject({
      email: "runner@example.com",
      unitPreference: "mi",
      hasProfile: false,
    });
    expect(typeof user.id).toBe("string");
    expect((user.id as string).length).toBeGreaterThan(0);
    expect(Number.isNaN(Date.parse(user.createdAt as string))).toBe(false);
    expect(Object.keys(user).sort()).toEqual([
      "createdAt",
      "email",
      "hasProfile",
      "id",
      "unitPreference",
    ]);
    expect(user).not.toHaveProperty("passwordHash");

    const cookies = authCookies(res);
    expect(cookies).toHaveLength(1);
    expect(cookies[0]).toMatch(/HttpOnly/i);
    expect(cookies[0]).toMatch(/SameSite=Lax/i);
    expect(cookies[0]).toMatch(/Path=\//i);
  });

  it("rejects a duplicate email with 409 EMAIL_TAKEN", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({ email: "runner@example.com", password: "password123" });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("EMAIL_TAKEN");
  });

  it("treats emails case-insensitively (A@b.com then a@b.com → 409)", async () => {
    const first = await request(app)
      .post("/api/auth/register")
      .send({ email: "A@b.com", password: "password123" });
    expect(first.status).toBe(201);
    expect(first.body.user.email).toBe("a@b.com"); // normalized on the way in

    const second = await request(app)
      .post("/api/auth/register")
      .send({ email: "a@b.com", password: "password123" });
    expect(second.status).toBe(409);
    expect(second.body.error.code).toBe("EMAIL_TAKEN");
  });

  it("rejects an invalid email with 400 VALIDATION and issue details", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({ email: "not-an-email", password: "password123" });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION");
    expect(Array.isArray(res.body.error.details)).toBe(true);
    expect(res.body.error.details.length).toBeGreaterThan(0);
  });

  it("rejects a short password with 400 VALIDATION", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({ email: "short@example.com", password: "1234567" });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION");
    const paths = (res.body.error.details as Array<{ path: unknown[] }>).map((i) => i.path[0]);
    expect(paths).toContain("password");
  });

  it("rejects a missing body with 400 VALIDATION", async () => {
    const res = await request(app).post("/api/auth/register").send({});
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION");
  });
});

describe.skipIf(!process.env.TEST_DATABASE_URL)("POST /api/auth/login", () => {
  it("logs in with correct credentials: 200 + user + cookie", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "runner@example.com", password: "password123" });

    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe("runner@example.com");
    expect(authCookies(res)).toHaveLength(1);
  });

  it("logs in regardless of email casing", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "RUNNER@EXAMPLE.COM", password: "password123" });
    expect(res.status).toBe(200);
  });

  it("rejects a wrong password with 401 INVALID_CREDENTIALS", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "runner@example.com", password: "wrong-password" });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("INVALID_CREDENTIALS");
    expect(authCookies(res)).toHaveLength(0);
  });

  it("rejects an unknown email with the same 401 INVALID_CREDENTIALS", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "nobody@example.com", password: "password123" });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("INVALID_CREDENTIALS");
  });
});

describe.skipIf(!process.env.TEST_DATABASE_URL)("GET /api/auth/me", () => {
  it("returns the user with a null profile before onboarding", async () => {
    const agent = request.agent(app);
    await agent
      .post("/api/auth/register")
      .send({ email: "me-check@example.com", password: "password123" })
      .expect(201);

    const res = await agent.get("/api/auth/me");
    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe("me-check@example.com");
    expect(res.body.user.hasProfile).toBe(false);
    expect(res.body.profile).toBeNull();
  });

  it("returns 401 UNAUTHORIZED without a cookie", async () => {
    const res = await request(app).get("/api/auth/me");
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("UNAUTHORIZED");
  });
});

describe.skipIf(!process.env.TEST_DATABASE_URL)("POST /api/auth/logout", () => {
  it("returns 204, clears the cookie, and subsequent /api/plan is 401", async () => {
    const agent = request.agent(app);
    await agent
      .post("/api/auth/register")
      .send({ email: "logout@example.com", password: "password123" })
      .expect(201);
    await agent.get("/api/plan").expect(200); // sanity: authenticated first

    const res = await agent.post("/api/auth/logout");
    expect(res.status).toBe(204);
    const cleared = authCookies(res);
    expect(cleared).toHaveLength(1);
    expect(cleared[0]).toMatch(/pm_token=;/);
    expect(cleared[0]).toMatch(/Expires=Thu, 01 Jan 1970/);

    const after = await agent.get("/api/plan");
    expect(after.status).toBe(401);
    expect(after.body.error.code).toBe("UNAUTHORIZED");
  });
});

describe.skipIf(!process.env.TEST_DATABASE_URL)("token integrity", () => {
  it("rejects a garbage cookie value with 401", async () => {
    const res = await request(app).get("/api/auth/me").set("Cookie", "pm_token=garbage-not-a-jwt");
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("UNAUTHORIZED");
  });

  it("rejects a token signed with the wrong secret", async () => {
    const user = await prisma.user.findUniqueOrThrow({
      where: { email: "runner@example.com" },
    });
    const forged = jwt.sign({ userId: user.id }, "not-the-server-secret");
    const res = await request(app).get("/api/auth/me").set("Cookie", `pm_token=${forged}`);
    expect(res.status).toBe(401);
  });

  it("rejects a validly-signed token whose payload has no userId", async () => {
    const token = jwt.sign({ sub: "something-else" }, env.JWT_SECRET);
    const res = await request(app).get("/api/auth/me").set("Cookie", `pm_token=${token}`);
    expect(res.status).toBe(401);
  });

  it("rejects a validly-signed token for a user that no longer exists", async () => {
    const token = jwt.sign({ userId: "cl-no-such-user" }, env.JWT_SECRET);
    const res = await request(app).get("/api/auth/me").set("Cookie", `pm_token=${token}`);
    expect(res.status).toBe(401);
  });
});

describe.skipIf(!process.env.TEST_DATABASE_URL)("protected routes without a cookie", () => {
  it.each([
    ["GET", "/api/plan"],
    ["GET", "/api/runs"],
    ["GET", "/api/stats"],
    ["GET", "/api/auth/me"],
    ["PATCH", "/api/me"],
    ["POST", "/api/onboarding"],
    ["POST", "/api/plan/regenerate"],
    ["POST", "/api/runs"],
    ["PATCH", "/api/workouts/some-id"],
    ["PATCH", "/api/runs/some-id"],
    ["DELETE", "/api/runs/some-id"],
  ] as const)("%s %s → 401 UNAUTHORIZED", async (method, path) => {
    const res =
      await request(app)[method.toLowerCase() as "get" | "post" | "patch" | "delete"](path);
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("UNAUTHORIZED");
  });
});
