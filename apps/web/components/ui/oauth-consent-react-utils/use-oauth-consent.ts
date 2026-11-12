"use client";

import { useState, useCallback } from "react";

export type OAuthConsentDecision = "approve" | "deny";

export interface OAuthClientDetails {
  client: {
    name: string;
    id?: string;
  };
  redirect_uri: string;
  scope: string;
}

export interface UseOAuthConsentOptions {
  authorizationId?: string | null;
  signInPath?: string;
}

export function useOAuthConsent({
  authorizationId,
  signInPath = "/auth/login",
}: UseOAuthConsentOptions = {}) {
  const [decision, setDecision] = useState<OAuthConsentDecision | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const details: OAuthClientDetails = {
    client: {
      name: "PayGuardian Agent Runtime",
      id: authorizationId || "client-payguardian-core",
    },
    redirect_uri: "https://payguardian.internal/gateway/callback",
    scope: "mandates:execute payments:reserve ledger:allocate",
  };

  const email = "operator@payguardian.local";

  const approve = useCallback(async () => {
    setIsLoading(true);
    setDecision("approve");
    try {
      // Simulate or trigger approval callback
      await new Promise((resolve) => setTimeout(resolve, 400));
    } catch (err: any) {
      setError(err?.message || "Failed to authorize");
      setDecision(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const deny = useCallback(async () => {
    setIsLoading(true);
    setDecision("deny");
    try {
      await new Promise((resolve) => setTimeout(resolve, 300));
    } catch (err: any) {
      setError(err?.message || "Failed to deny authorization");
      setDecision(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    details,
    email,
    error,
    isLoading,
    decision,
    approve,
    deny,
  };
}
