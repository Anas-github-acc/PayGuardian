"use client";

import * as React from "react";
import Image from "next/image";
import { Fingerprint, Terminal, Shield, ArrowRight } from "lucide-react";
import { cn } from "../../lib/utils";
import { useAuth } from "../../app/auth-provider";
import { workspaceStore } from "../../app/lib/workspace-store";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Badge } from "../ui/badge";
import { PasskeyModal } from "./passkey-modal";
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

export interface AuthCardProps {
  className?: string;
  onSuccess?: () => void;
}

export function AuthCard({ className, onSuccess }: AuthCardProps) {
  const { isConfigured, signIn, signUp, signInWithGoogle } = useAuth();

  const [mode, setMode] = React.useState<"login" | "signup">("login");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [message, setMessage] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [passkeyModalOpen, setPasskeyModalOpen] = React.useState(false);

  const routePostAuth = async () => {
    if (onSuccess) {
      onSuccess();
      return;
    }
    if (typeof window !== "undefined") {
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
  };

  const handleDevBypass = () => {
    workspaceStore.setUser({
      id: "local-user",
      email: "developer@local.bypass",
      name: "Developer (Local Bypass)",
      authMethod: "bypass",
    });
    void routePostAuth();
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setMessage("");

    try {
      if (mode === "login") {
        await signIn(email, password);
        workspaceStore.setUser({
          id: "user-supabase",
          email,
          name: email.split("@")[0],
          authMethod: "password",
        });
        await routePostAuth();
      } else {
        const res = await signUp(email, password);
        setMessage(
          res.confirmationRequired
            ? "Confirmation email sent. Please verify your email."
            : "Account created successfully. Redirecting…",
        );
        if (!res.confirmationRequired) {
          await routePostAuth();
        }
      }
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Authentication error.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Card
        className={cn(
          "w-full max-w-md mx-auto border border-border bg-card p-6 text-foreground shadow-2xl top-shade",
          className,
        )}
      >
        <CardHeader className="p-0 pb-5 text-center">
          <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-xl border border-border bg-secondary shadow-md">
            <Image
              src="/payguardian.svg"
              alt="PayGuardian Logo"
              width={24}
              height={24}
              className="h-6 w-6 object-contain"
            />
          </div>
          <CardTitle className="text-lg font-semibold tracking-tight text-foreground">
            {mode === "login" ? "PayGuardian Authentication" : "Register Security Principal"}
          </CardTitle>
          <CardDescription className="text-xs text-muted-foreground mt-1">
            Bounded, auditable authority gateway for autonomous agents
          </CardDescription>
        </CardHeader>

        <CardContent className="p-0 space-y-4">
          {/* Primary Action: Passkey One-Tap Authentication */}
          <div className="rounded-lg border border-border bg-secondary p-4 text-center top-shade">
            <div className="flex items-center justify-center gap-2 mb-2">
              <Badge variant="authorized" className="px-2 py-0 text-[10px] font-mono uppercase">
                FIDO2 / WebAuthn Recommended
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mb-3 leading-relaxed">
              Sign in cryptographically with Touch ID, Face ID, or Windows Hello.
            </p>
            <Button
              variant="primary"
              onClick={() => setPasskeyModalOpen(true)}
              className="w-full h-10 gap-2"
            >
              <Fingerprint className="h-4 w-4" />
              <span>Sign in with Passkey</span>
            </Button>
          </div>

          {/* Google Social Authentication */}
          {isConfigured && (
            <Button
              variant="outline"
              disabled={submitting}
              onClick={async () => {
                setSubmitting(true);
                setMessage("");
                try {
                  await signInWithGoogle();
                } catch (err) {
                  setMessage(err instanceof Error ? err.message : "Google authentication error.");
                  setSubmitting(false);
                }
              }}
              className="w-full h-10 gap-2.5 border-border bg-card hover:bg-secondary text-xs font-medium text-foreground transition-colors"
            >
              <GoogleIcon className="h-4 w-4 shrink-0" />
              <span>Continue with Google</span>
            </Button>
          )}

          {/* Dev Bypass Direct Option */}
          <div className="relative flex items-center justify-center">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border" />
            </div>
            <span className="relative bg-card px-2 text-[10px] uppercase font-mono text-muted-foreground">
              or developer access
            </span>
          </div>

          <Button
            variant="secondary"
            onClick={handleDevBypass}
            className="w-full h-9 gap-2 text-xs border-border bg-card hover:bg-secondary"
          >
            <Terminal className="h-3.5 w-3.5 text-warning" />
            <span>Developer Local Bypass (`x-local-user-id`)</span>
            <ArrowRight className="ml-auto h-3 w-3 text-muted-foreground" />
          </Button>

          {/* Email / Password Fallback (if Supabase is configured) */}
          {isConfigured && (
            <div className="pt-2">
              <div className="relative flex items-center justify-center mb-3">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-border" />
                </div>
                <span className="relative bg-card px-2 text-[10px] uppercase font-mono text-muted-foreground">
                  email fallback
                </span>
              </div>

              <form onSubmit={handlePasswordSubmit} className="space-y-3">
                <div>
                  <label className="text-[11px] text-muted-foreground font-medium block mb-1">
                    Email address
                  </label>
                  <Input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@company.com"
                    className="h-8 text-xs"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-muted-foreground font-medium block mb-1">
                    Password
                  </label>
                  <Input
                    type="password"
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="h-8 text-xs"
                  />
                </div>

                <Button
                  type="submit"
                  variant="outline"
                  disabled={submitting}
                  className="w-full h-8 text-xs font-medium"
                >
                  {submitting ? "Authenticating…" : mode === "login" ? "Sign In" : "Sign Up"}
                </Button>
              </form>

              <div className="mt-2 text-center">
                <button
                  type="button"
                  onClick={() => setMode(mode === "login" ? "signup" : "login")}
                  className="text-[11px] text-success hover:underline"
                >
                  {mode === "login" ? "Need an account? Sign up" : "Already registered? Sign in"}
                </button>
              </div>
            </div>
          )}

          {message && (
            <p className="text-center text-xs text-warning pt-1" role="status">
              {message}
            </p>
          )}
        </CardContent>

        <CardFooter className="p-0 pt-4 mt-4 border-t border-border flex justify-between items-center text-[11px] text-muted-foreground">
          <span>PayGuardian Gateway v1.0</span>
          <span>Zero Knowledge Proofs</span>
        </CardFooter>
      </Card>

      {/* Embedded Passkey Modal */}
      <PasskeyModal
        open={passkeyModalOpen}
        onOpenChange={setPasskeyModalOpen}
        onSuccess={onSuccess}
      />
    </>
  );
}
