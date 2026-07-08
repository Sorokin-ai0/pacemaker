import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";

import { toApiError } from "@/api";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/context/auth";

const EMAIL_RE = /\S+@\S+\.\S+/;

/**
 * LOCAL PREVIEW SIGN-UP — TEMPORARY.
 * Saves a profile object to localStorage and treats it as "signed in".
 * No password, no hashing, no JWT — to be replaced with the real
 * register endpoint (server/src/routes/auth.ts) when the backend is wired in.
 */
export function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
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
      await register(email.trim(), name);
      navigate("/onboarding", { replace: true });
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
          <CardTitle className="text-xl">Create your profile</CardTitle>
          <CardDescription>
            Thirteen point one miles. One plan, built around your race day.
          </CardDescription>
        </CardHeader>
        <CardContent>
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
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                type="text"
                autoComplete="name"
                placeholder="Optional"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
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
              {fieldErrors.email && <p className="text-xs text-destructive">{fieldErrors.email}</p>}
            </div>
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? "Creating profile…" : "Create profile & continue"}
            </Button>
            <p className="text-center text-xs text-muted-foreground">
              Preview build — your data stays in this browser (no account, no server).
            </p>
          </form>
          <p className="mt-4 text-center text-sm text-muted-foreground">
            Already set up on this device?{" "}
            <Link
              to="/login"
              className="font-medium text-primary underline-offset-4 hover:underline"
            >
              Continue
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
