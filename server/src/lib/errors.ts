/** Application error carrying an HTTP status and a machine-readable code. */
export class AppError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export const unauthorized = (message = "Authentication required") =>
  new AppError(401, "UNAUTHORIZED", message);

export const notFound = (message = "Not found") => new AppError(404, "NOT_FOUND", message);

export const validationError = (message: string, details?: unknown) =>
  new AppError(400, "VALIDATION", message, details);
