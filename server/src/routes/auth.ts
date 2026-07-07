import { Router, type CookieOptions, type Response } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { prisma } from "../db.js";
import { env } from "../env.js";
import { AppError, unauthorized } from "../lib/errors.js";
import { toProfileDTO, toUserDTO } from "../lib/dto.js";
import { loginSchema, registerSchema } from "../lib/schemas.js";
import { AUTH_COOKIE, requireAuth } from "../middleware/requireAuth.js";
import { asyncHandler, validate } from "../middleware/validate.js";

const BCRYPT_ROUNDS = 10;
const TOKEN_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

const cookieOptions: CookieOptions = {
  httpOnly: true,
  sameSite: "lax",
  secure: env.isProduction,
  path: "/",
};

function setAuthCookie(res: Response, userId: string): void {
  const token = jwt.sign({ userId }, env.JWT_SECRET, { expiresIn: "7d" });
  res.cookie(AUTH_COOKIE, token, { ...cookieOptions, maxAge: TOKEN_MAX_AGE_MS });
}

export const authRouter = Router();

authRouter.post(
  "/register",
  validate(registerSchema),
  asyncHandler(async (req, res) => {
    const { email, password } = req.body as { email: string; password: string };

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new AppError(409, "EMAIL_TAKEN", "An account with this email already exists");
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const user = await prisma.user.create({ data: { email, passwordHash } });

    setAuthCookie(res, user.id);
    res.status(201).json({ user: toUserDTO(user, false) });
  }),
);

authRouter.post(
  "/login",
  validate(loginSchema),
  asyncHandler(async (req, res) => {
    const { email, password } = req.body as { email: string; password: string };

    const user = await prisma.user.findUnique({ where: { email }, include: { profile: true } });
    const invalid = new AppError(401, "INVALID_CREDENTIALS", "Invalid email or password");
    if (!user) throw invalid;

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) throw invalid;

    setAuthCookie(res, user.id);
    res.json({ user: toUserDTO(user, user.profile !== null) });
  }),
);

// Logout is deliberately auth-optional: clearing the cookie is idempotent and
// the contract specifies an error-free 204.
authRouter.post("/logout", (_req, res) => {
  res.clearCookie(AUTH_COOKIE, cookieOptions);
  res.status(204).end();
});

authRouter.get(
  "/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      include: { profile: true },
    });
    if (!user) throw unauthorized();

    res.json({
      user: toUserDTO(user, user.profile !== null),
      profile: user.profile ? toProfileDTO(user.profile) : null,
    });
  }),
);
