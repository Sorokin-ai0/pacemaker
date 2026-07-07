import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { env } from "../env.js";
import { unauthorized } from "../lib/errors.js";

export const AUTH_COOKIE = "pm_token";

/**
 * Verifies the JWT from the `pm_token` httpOnly cookie (payload `{ userId }`)
 * and attaches `req.userId`. Responds 401 UNAUTHORIZED otherwise.
 */
export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  const cookies = req.cookies as Record<string, unknown> | undefined;
  const token = cookies?.[AUTH_COOKIE];
  if (typeof token !== "string" || token.length === 0) {
    next(unauthorized());
    return;
  }
  try {
    const payload = jwt.verify(token, env.JWT_SECRET);
    if (typeof payload === "string" || typeof payload.userId !== "string") {
      next(unauthorized());
      return;
    }
    req.userId = payload.userId;
    next();
  } catch {
    next(unauthorized());
  }
}
