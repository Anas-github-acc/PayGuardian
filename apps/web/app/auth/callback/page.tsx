"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "../../lib/supabase-browser";
import { apiClient } from "../../../lib/api/client";

function GoogleIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" {...props}>
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}

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
          <GoogleIcon className="h-5 w-5" />
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
