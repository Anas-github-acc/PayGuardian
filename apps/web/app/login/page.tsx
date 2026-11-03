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

export default function LoginPage() {
  const { isConfigured, isLoading, isLocalDevelopment, user, signIn, signUp } = useAuth();
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
