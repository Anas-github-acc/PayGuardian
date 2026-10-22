"use client";

import type { Session, User } from "@supabase/supabase-js";
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { createSupabaseBrowserClient, isLocalDevelopmentAuthEnabled } from "./lib/supabase-browser";

type AuthContextValue = {
  isLoading: boolean;
  isConfigured: boolean;
  isLocalDevelopment: boolean;
  session: Session | null;
  user: User | null;
  signIn(email: string, password: string): Promise<void>;
  signUp(email: string, password: string): Promise<{ confirmationRequired: boolean }>;
  signOut(): Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: Readonly<{ children: ReactNode }>) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const isLocalDevelopment = isLocalDevelopmentAuthEnabled();
  const [isLoading, setIsLoading] = useState(Boolean(supabase));
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    if (!supabase) {
      setIsLoading(false);
      return;
    }

    let mounted = true;
    void supabase.auth
      .getSession()
      .then(
        ({
          data,
          error,
        }: {
          data: { session: Session | null };
          error: { message: string } | null;
        }) => {
          if (!mounted) return;
          if (error) console.error("Unable to restore Supabase session.", error);
          setSession(data.session);
          setIsLoading(false);
        },
      );

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event: string, nextSession: Session | null) => {
      setSession(nextSession);
      setIsLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [supabase]);

  const value = useMemo<AuthContextValue>(
    () => ({
      isLoading,
      isConfigured: Boolean(supabase),
      isLocalDevelopment,
      session,
      user: session?.user ?? null,
      async signIn(email, password) {
        if (!supabase) throw new Error("Supabase Auth is not configured.");
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      },
      async signUp(email, password) {
        if (!supabase) throw new Error("Supabase Auth is not configured.");
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        return { confirmationRequired: !data.session };
      },
      async signOut() {
        if (!supabase) return;
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
      },
    }),
    [isLoading, isLocalDevelopment, session, supabase],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider.");
  return context;
}

export function AuthBoundary({ children }: Readonly<{ children: ReactNode }>) {
  const { isLoading, isLocalDevelopment, user } = useAuth();

  useEffect(() => {
    if (!isLoading && !isLocalDevelopment && !user) {
      window.location.assign("/login");
    }
  }, [isLoading, isLocalDevelopment, user]);

  if (isLoading)
    return (
      <main className="shell">
        <p className="muted">Restoring your session…</p>
      </main>
    );
  if (!isLocalDevelopment && !user) return null;
  return children;
}
