import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";

import { authApi, toApiError } from "@/api";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/context/auth";

const EMAIL_RE = /\S+@\S+\.\S+/;

/**
 * LOCAL PREVIEW SIGN-IN — TEMPORARY.
 * "Signing in" just re-activates the profile stored in this browser's
 * localStorage (no password, no JWT). Replaced by the real login endpoint
 * when the backend is wired back in.
 */
export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const stored = authApi.peekUser();
  const [email, setEmail] = useState(stored?.email ?? "");
  const [fieldErrors, setFieldErrors] = useState<{ email?: string }>({});
  const [apiError, setApiError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const errors: typeof fieldErrors = {};
    if (!EMAIL_RE.test(email.trim())) errors.email = "Enter a valid email address.";
    setFieldErrors(errors);
    setApiError(null);
    if (Object.keys(errors).length > 0) return;

    setSubmitting(true);
    try {
      await login(email.trim());
      navigate("/dashboard", { replace: true });
    } catch (err) {
      setApiError(toApiError(err).message);
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-6 px-4 py-10">
      <Logo />
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-xl">Welcome back</CardTitle>
          <CardDescription>
            {stored
              ? `Pick up your training where you left off${stored.name ? `, ${stored.name}` : ""}.`
              : "No local profile on this device yet — create one to get started."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {stored ? (
            <form className="space-y-4" onSubmit={handleSubmit} noValidate>
              {apiError && (
                <div
                  role="alert"
                  className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
                >
                  {apiError}
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  aria-invalid={fieldErrors.email ? true : undefined}
                />
                {fieldErrors.email && (
                  <p className="text-xs text-destructive">{fieldErrors.email}</p>
                )}
              </div>
              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? "Continuing…" : `Continue as ${stored.email}`}
              </Button>
              <p className="text-center text-xs text-muted-foreground">
                Preview build — no password needed; your data lives in this browser.
              </p>
            </form>
          ) : (
            <Button className="w-full" onClick={() => navigate("/register")}>
              Create your profile
            </Button>
          )}
          <p className="mt-4 text-center text-sm text-muted-foreground">
            Starting fresh?{" "}
            <Link
              to="/register"
              className="font-medium text-primary underline-offset-4 hover:underline"
            >
              Create a profile
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
