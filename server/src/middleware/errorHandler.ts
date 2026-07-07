import type { ErrorRequestHandler } from "express";
import { ZodError } from "zod";
import { env } from "../env.js";
import { AppError } from "../lib/errors.js";

/**
 * Uniform error rendering: `{ error: { code, message, details? } }`.
 * - ZodError            → 400 VALIDATION with the zod issues as details
 * - malformed JSON body → 400 VALIDATION
 * - AppError            → its own status/code/message
 * - anything else       → 500 INTERNAL
 */
export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof ZodError) {
    res.status(400).json({
      error: { code: "VALIDATION", message: "Invalid request body", details: err.issues },
    });
    return;
  }

  // body-parser JSON syntax error
  if (err instanceof SyntaxError && "body" in err) {
    res.status(400).json({ error: { code: "VALIDATION", message: "Malformed JSON body" } });
    return;
  }

  if (err instanceof AppError) {
    res.status(err.status).json({
      error: {
        code: err.code,
        message: err.message,
        ...(err.details !== undefined ? { details: err.details } : {}),
      },
    });
    return;
  }

  if (env.NODE_ENV !== "test") {
    console.error("Unhandled error:", err);
  }
  res.status(500).json({ error: { code: "INTERNAL", message: "Internal server error" } });
};
