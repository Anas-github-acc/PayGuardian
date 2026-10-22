import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let browserClient: SupabaseClient | null | undefined;

export function createSupabaseBrowserClient(): SupabaseClient | null {
  if (browserClient !== undefined) return browserClient;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  browserClient =
    url && anonKey
      ? createClient(url, anonKey, {
          auth: { autoRefreshToken: true, persistSession: true, detectSessionInUrl: true },
        })
      : null;
  return browserClient;
}

export function isLocalDevelopmentAuthEnabled(): boolean {
  return process.env.NODE_ENV !== "production" && !createSupabaseBrowserClient();
}
