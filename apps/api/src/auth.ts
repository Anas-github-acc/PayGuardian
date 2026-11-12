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
    if (authorization?.startsWith("Bearer ")) {
      const token = authorization.slice("Bearer ".length).trim();
      if (token) {
        if (token.startsWith("pg_") && registry) {
          const verified = await registry.verifyAgentCredential(token);
          if (verified) {
            return {
              userId: verified.agent.ownerUserId,
              agentId: verified.agent.id,
              kind: "agent",
            };
          }
        } else if (client) {
          const { data, error } = await client.auth.getUser(token);
          if (!error && data.user) {
            return { userId: data.user.id, kind: "user" };
          }
        }
      }
    }

    if (localAuthEnabled && localUserId) {
      const isSupabase = (process.env.DATABASE_MODE ?? "memory") === "supabase";
      const resolvedUserId =
        isSupabase && localUserId === "local-user"
          ? (process.env.LOCAL_DEV_USER_ID ?? "aab80db4-b43b-403d-96b1-992d7cade517")
          : localUserId;
      return { userId: resolvedUserId, kind: "user" };
    }

    return null;
  };
}
