import type { SupabaseClient } from "@supabase/supabase-js";
import { loadRuntimeConfig, type RuntimeConfig } from "@payguardian/config";
import type { Principal, Registry } from "./phase1.js";

export type PrincipalResolver = (
  authorization: string | undefined,
  localUserId: string | undefined,
) => Promise<Principal | null>;

export function createPrincipalResolver(
  client: SupabaseClient | null,
  config: RuntimeConfig = loadRuntimeConfig(),
  registry?: Registry,
): PrincipalResolver {
  const localAuthEnabled = config.localDevAuthEnabled;

  return async (authorization, localUserId) => {
    if (localUserId && !localAuthEnabled) return null;
    if (localAuthEnabled && localUserId) {
      const isSupabase = (process.env.DATABASE_MODE ?? "memory") === "supabase";
      const resolvedUserId =
        isSupabase && localUserId === "local-user"
          ? (process.env.LOCAL_DEV_USER_ID ?? "aab80db4-b43b-403d-96b1-992d7cade517")
          : localUserId;
      return { userId: resolvedUserId, kind: "user" };
    }
    if (!authorization?.startsWith("Bearer ")) return null;
    const token = authorization.slice("Bearer ".length).trim();
    if (!token) return null;

    if (token.startsWith("pg_") && registry) {
      const verified = await registry.verifyAgentCredential(token);
      if (!verified) return null;
      return { userId: verified.agent.ownerUserId, agentId: verified.agent.id, kind: "agent" };
    }

    if (!client) return null;
    const { data, error } = await client.auth.getUser(token);
    if (error || !data.user) return null;
    return { userId: data.user.id, kind: "user" };
  };
}
