"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { Shield } from "lucide-react";
import { useAuth } from "../auth-provider";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { apiClient } from "../../lib/api/client";

function GoogleIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" {...props}>
      <path
        fill="#4285F4"
        d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"
      />
      <path
        fill="#FBBC05"
        d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
      />
    </svg>
  );
}

export default function LoginPage() {
  const { isConfigured, isLoading, isLocalDevelopment, user, signIn, signUp, signInWithGoogle } = useAuth();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function routePostAuth() {
    try {
      const envs = await apiClient.environments.list();
      if (!envs || envs.length === 0) {
        window.location.assign("/onboarding");
        return;
      }
      window.location.assign("/dashboard");
    } catch {
      window.location.assign("/onboarding");
    }
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (user || (isLocalDevelopment && !params.has("preview"))) {
      void routePostAuth();
    }
  }, [isLocalDevelopment, user]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setMessage("");
    try {
      if (mode === "login") {
        await signIn(email, password);
        await routePostAuth();
      } else {
        const result = await signUp(email, password);
        setMessage(
          result.confirmationRequired
            ? "Check your email to confirm your account, then sign in."
            : "Account created. Opening your environment…",
        );
        if (!result.confirmationRequired) {
          await routePostAuth();
        }
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to authenticate.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="auth-shell bg-background">
      <section className="auth-card">
        <Link href="/" className="mb-6 flex items-center justify-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-md border border-border bg-secondary">
            <Shield className="h-4 w-4" />
          </span>
          <span className="text-sm font-semibold text-foreground">PayGuardian</span>
        </Link>

        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-base">
              {mode === "login" ? "Welcome back" : "Create your account"}
            </CardTitle>
            <CardDescription>
              Sign in to manage environments, agents, budgets, and payment activity.
            </CardDescription>
            <div className="flex justify-center pt-1">
              <Badge variant="success">Passkey preferred</Badge>
            </div>
          </CardHeader>

          <CardContent>
            {!isConfigured ? (
              <p className="note">
                Supabase Auth is not configured for this browser. In local development, the
                dashboard uses the configured local user identity.
              </p>
            ) : (
              <div className="grid gap-4">
                <Button
                  type="button"
                  variant="outline"
                  disabled={submitting || isLoading}
                  onClick={async () => {
                    setSubmitting(true);
                    setMessage("");
                    try {
                      await signInWithGoogle();
                    } catch (error) {
                      setMessage(
                        error instanceof Error ? error.message : "Unable to sign in with Google."
                      );
                      setSubmitting(false);
                    }
                  }}
                  className="w-full flex items-center justify-center gap-2.5 h-9 border-border bg-secondary/50 hover:bg-secondary text-xs font-medium text-foreground transition-colors"
                >
                  <GoogleIcon className="h-4 w-4 shrink-0" />
                  <span>Continue with Google</span>
                </Button>

                <div className="relative flex items-center justify-center">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t border-border" />
                  </div>
                  <span className="relative bg-card px-2 text-[10px] uppercase font-mono text-muted-foreground">
                    or continue with email
                  </span>
                </div>

                <form onSubmit={submit} className="grid gap-4">
                <label className="grid gap-1.5 text-xs font-medium text-foreground">
                  Email
                  <Input
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                  />
                </label>
                <label className="grid gap-1.5 text-xs font-medium text-foreground">
                  Password
                  <Input
                    type="password"
                    autoComplete={mode === "login" ? "current-password" : "new-password"}
                    minLength={6}
                    required
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                  />
                </label>
                <Button type="submit" disabled={submitting || isLoading} className="w-full">
                  {submitting ? "Working…" : mode === "login" ? "Sign in" : "Sign up"}
                </Button>
              </form>
              </div>
            )}

            {message && (
              <p className="note mt-4" role="status">
                {message}
              </p>
            )}

            {isConfigured && (
              <button
                type="button"
                onClick={() => {
                  setMode(mode === "login" ? "signup" : "login");
                  setMessage("");
                }}
                className="mt-4 w-full text-center text-xs text-link underline-offset-4 transition-colors hover:text-link/80 hover:underline"
              >
                {mode === "login" ? "Need an account? Sign up" : "Already registered? Sign in"}
              </button>
            )}
          </CardContent>
        </Card>

        <p className="mt-6 text-center text-[11px] text-muted-foreground">
          <Link href="/" className="text-link underline-offset-4 hover:text-link/80 hover:underline">
            ← Back to home
          </Link>
        </p>
      </section>
    </main>
  );
}
