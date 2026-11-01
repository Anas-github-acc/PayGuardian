"use client";

import * as React from "react";
import {
  Fingerprint,
  Terminal,
  Shield,
  KeyRound,
  ArrowRight,
  CheckCircle,
} from "lucide-react";
import { cn } from "../../lib/utils";
import { useAuth } from "../../app/auth-provider";
import { useWorkspaceStore, workspaceStore } from "../../app/lib/workspace-store";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Badge } from "../ui/badge";
import { PasskeyModal } from "./passkey-modal";

export interface AuthCardProps {
  className?: string;
  onSuccess?: () => void;
}

export function AuthCard({ className, onSuccess }: AuthCardProps) {
  const { isConfigured, isLocalDevelopment, signIn, signUp } = useAuth();
  const { user } = useWorkspaceStore();

  const [mode, setMode] = React.useState<"login" | "signup">("login");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [message, setMessage] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [passkeyModalOpen, setPasskeyModalOpen] = React.useState(false);

  const handleDevBypass = () => {
    workspaceStore.setUser({
      id: "local-user",
      email: "developer@local.bypass",
      name: "Developer (Local Bypass)",
      authMethod: "bypass",
    });
    if (onSuccess) {
      onSuccess();
    } else if (typeof window !== "undefined") {
      window.location.assign("/dashboard");
    }
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
        if (onSuccess) {
          onSuccess();
        } else if (typeof window !== "undefined") {
          window.location.assign("/dashboard");
        }
      } else {
        const res = await signUp(email, password);
        setMessage(
          res.confirmationRequired
            ? "Confirmation email sent. Please verify your email."
            : "Account created successfully. Redirecting…"
        );
        if (!res.confirmationRequired) {
          if (onSuccess) {
            onSuccess();
          } else if (typeof window !== "undefined") {
            window.location.assign("/dashboard");
          }
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
          className
        )}
      >
        <CardHeader className="p-0 pb-5 text-center">
          <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-xl border border-success/30 bg-success/10 text-success shadow-[0_0_14px_oklch(var(--success-solid)/0.25)]">
            <Shield className="h-5 w-5" />
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
