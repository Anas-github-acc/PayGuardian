import type { SupabaseClient } from "@supabase/supabase-js";
import { loadRuntimeConfig, type RuntimeConfig } from "@payguardian/config";
import type { Principal } from "./phase1.js";

export type PrincipalResolver = (
  authorization: string | undefined,
  localUserId: string | undefined,
) => Promise<Principal | null>;

export function createPrincipalResolver(
  client: SupabaseClient | null,
  config: RuntimeConfig = loadRuntimeConfig(),
): PrincipalResolver {
  const localAuthEnabled = config.localDevAuthEnabled;

  return async (authorization, localUserId) => {
    if (localUserId && !localAuthEnabled) return null;
    if (localAuthEnabled && localUserId) return { userId: localUserId, kind: "user" };
    if (!client || !authorization?.startsWith("Bearer ")) return null;
    const token = authorization.slice("Bearer ".length).trim();
    if (!token) return null;
    const { data, error } = await client.auth.getUser(token);
    if (error || !data.user) return null;
    return { userId: data.user.id, kind: "user" };
  };
}
