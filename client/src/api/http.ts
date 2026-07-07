/** Central error type for everything that comes back from the API. */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function toApiError(err: unknown): ApiError {
  if (err instanceof ApiError) return err;
  if (err instanceof Error) return new ApiError(0, "UNKNOWN", err.message);
  return new ApiError(0, "UNKNOWN", "Something went wrong.");
}

interface ApiErrorBody {
  error?: { code?: string; message?: string; details?: unknown };
}

interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  /**
   * What to do on a 401. "redirect" (default) sends the browser to /login unless
   * we are already on an auth page; "ignore" lets the caller handle it (used by
   * the auth endpoints themselves).
   */
  on401?: "redirect" | "ignore";
}

function isAuthPage(pathname: string): boolean {
  return pathname === "/login" || pathname === "/register";
}

export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, on401 = "redirect" } = options;

  let res: Response;
  try {
    res = await fetch(path, {
      method,
      credentials: "include",
      headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, "NETWORK", "Could not reach the server. Check your connection.");
  }

  let payload: unknown = null;
  if (res.status !== 204) {
    try {
      payload = await res.json();
    } catch {
      payload = null;
    }
  }

  if (!res.ok) {
    const parsed = (payload ?? {}) as ApiErrorBody;
    const error = new ApiError(
      res.status,
      parsed.error?.code ?? "UNKNOWN",
      parsed.error?.message ?? `Request failed (${res.status}).`,
      parsed.error?.details,
    );
    if (res.status === 401 && on401 === "redirect" && !isAuthPage(window.location.pathname)) {
      window.location.assign("/login");
    }
    throw error;
  }

  return payload as T;
}
