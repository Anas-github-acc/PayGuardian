import { cookies } from "next/headers";
import { DashboardClient } from "./dashboard-client";
import type { Environment } from "../lib/workspace-store";

export const dynamic = "force-dynamic";

/**
 * Server Component for /dashboard
 *
 * Implements Step 2 of cookie persistence:
 * Reads active environment cookies from request headers, parses the JSON payload,
 * and passes the initial environment down to the Client Component.
 *
 * This completely eliminates the hydration mismatch and loading skeleton flash.
 */
export default async function DashboardPage() {
  const cookieStore = await cookies();
  const activeEnvId = cookieStore.get("payguardian_active_env_id")?.value ?? null;
  const rawActiveEnv = cookieStore.get("payguardian_active_env")?.value ?? null;

  let initialEnvironment: Environment | null = null;
  if (rawActiveEnv) {
    try {
      initialEnvironment = JSON.parse(decodeURIComponent(rawActiveEnv));
    } catch {
      try {
        initialEnvironment = JSON.parse(rawActiveEnv);
      } catch {
        // malformed cookie fallback
        initialEnvironment = null;
      }
    }
  }

  return (
    <DashboardClient initialEnvironmentId={activeEnvId} initialEnvironment={initialEnvironment} />
  );
}
