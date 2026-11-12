"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Shield } from "lucide-react";
import { createSupabaseBrowserClient } from "../../lib/supabase-browser";
import { apiClient } from "../../../lib/api/client";

export default function AuthCallbackPage() {
  const router = useRouter();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    if (!supabase) {
      router.replace("/login");
      return;
    }
    const client = supabase;

    const code = new URLSearchParams(window.location.search).get("code");

    async function handleAuth() {
      try {
        if (code) {
          const { error } = await client.auth.exchangeCodeForSession(code);
          if (error) {
            console.error("Exchange code for session failed:", error);
          }
        }

        const { data, error: sessionErr } = await client.auth.getSession();
        if (sessionErr || !data.session) {
          setErrorMsg(sessionErr?.message || "Failed to establish session.");
          setTimeout(() => router.replace("/login"), 2500);
          return;
        }

        // Check if user has an environment or needs onboarding
        try {
          const envs = await apiClient.environments.list();
          if (!envs || envs.length === 0) {
            router.replace("/onboarding");
            return;
          }
          router.replace("/dashboard");
        } catch {
          router.replace("/onboarding");
        }
      } catch (err) {
        console.error("Auth callback error:", err);
        setErrorMsg(err instanceof Error ? err.message : "Authentication error.");
        setTimeout(() => router.replace("/login"), 2500);
      }
    }

    void handleAuth();
  }, [router]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4 text-foreground">
      <div className="flex flex-col items-center gap-3 text-center">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-secondary shadow-sm">
          <Shield className="h-5 w-5 text-primary" />
        </span>
        <h2 className="text-sm font-semibold tracking-tight">Authenticating with Google…</h2>
        <p className="text-xs text-muted-foreground">
          {errorMsg ? (
            <span className="text-destructive">{errorMsg} Redirecting to login…</span>
          ) : (
            "Establishing cryptographic session with PayGuardian…"
          )}
        </p>
      </div>
    </div>
  );
}
