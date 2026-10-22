"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useAuth } from "../auth-provider";

export default function LoginPage() {
  const { isConfigured, isLoading, isLocalDevelopment, user, signIn, signUp } = useAuth();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (user || isLocalDevelopment) window.location.assign("/");
  }, [isLocalDevelopment, user]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setMessage("");
    try {
      if (mode === "login") {
        await signIn(email, password);
        window.location.assign("/");
      } else {
        const result = await signUp(email, password);
        setMessage(
          result.confirmationRequired
            ? "Check your email to confirm your account, then sign in."
            : "Account created. Opening your dashboard…",
        );
        if (!result.confirmationRequired) window.location.assign("/");
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to authenticate.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="auth-shell">
      <section className="card auth-card" aria-labelledby="auth-title">
        <p className="eyebrow">PayGuardian · Secure access</p>
        <h1 id="auth-title">{mode === "login" ? "Welcome back" : "Create your account"}</h1>
        <p className="lede">
          Sign in to manage environments, agents, budgets, and payment activity.
        </p>
        {!isConfigured ? (
          <p className="note">
            Supabase Auth is not configured for this browser. In local development, the dashboard
            uses the configured local user identity.
          </p>
        ) : null}
        {isConfigured ? (
          <form className="form" onSubmit={submit}>
            <label>
              Email
              <input
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </label>
            <label>
              Password
              <input
                type="password"
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                minLength={6}
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </label>
            <button type="submit" disabled={submitting || isLoading}>
              {submitting ? "Working…" : mode === "login" ? "Sign in" : "Sign up"}
            </button>
          </form>
        ) : null}
        {message ? (
          <p className="note" role="status">
            {message}
          </p>
        ) : null}
        {isConfigured ? (
          <div className="action-row">
            <button type="button" onClick={() => setMode(mode === "login" ? "signup" : "login")}>
              {mode === "login" ? "Need an account? Sign up" : "Already registered? Sign in"}
            </button>
          </div>
        ) : null}
      </section>
    </main>
  );
}
