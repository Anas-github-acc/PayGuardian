"use client";

import { useEffect, useState, useCallback } from "react";
import { apiClient } from "../client";
import { mapSessionsToItems } from "../mappers/sessions";
import type { SessionItem } from "../types";
import type { SessionDto } from "@payguardian/contracts";

export interface UseSessionsResult {
  sessions: SessionItem[];
  rawSessions: SessionDto[];
  isLoading: boolean;
  error: Error | null;
  createSession: (data: {
    name?: string;
    title?: string;
    purpose?: string;
    agentId?: string | null;
    context?: Record<string, unknown>;
  }) => Promise<SessionDto>;
  updateSession: (
    sessionId: string,
    data: {
      name?: string;
      status?: "active" | "paused" | "completed" | "cancelled";
      context?: Record<string, unknown>;
    },
  ) => Promise<SessionDto>;
  refetch: () => Promise<void>;
}

export function useSessions(environmentId?: string | null): UseSessionsResult {
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [rawSessions, setRawSessions] = useState<SessionDto[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(Boolean(environmentId));
  const [error, setError] = useState<Error | null>(null);

  const fetchSessions = useCallback(async () => {
    if (!environmentId) {
      setSessions([]);
      setRawSessions([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const fetched = await apiClient.sessions.list(environmentId);
      setRawSessions(fetched);
      setSessions(mapSessionsToItems(fetched));
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setIsLoading(false);
    }
  }, [environmentId]);

  useEffect(() => {
    void fetchSessions();
  }, [fetchSessions]);

  const createSession = async (data: {
    name?: string;
    title?: string;
    purpose?: string;
    agentId?: string | null;
    context?: Record<string, unknown>;
  }): Promise<SessionDto> => {
    if (!environmentId) throw new Error("No active environment.");
    const created = await apiClient.sessions.create(environmentId, data);
    await fetchSessions();
    return created;
  };

  const updateSession = async (
    sessionId: string,
    data: {
      name?: string;
      status?: "active" | "paused" | "completed" | "cancelled";
      context?: Record<string, unknown>;
    },
  ): Promise<SessionDto> => {
    if (!environmentId) throw new Error("No active environment.");
    const updated = await apiClient.sessions.update(environmentId, sessionId, data);
    await fetchSessions();
    return updated;
  };

  return {
    sessions,
    rawSessions,
    isLoading,
    error,
    createSession,
    updateSession,
    refetch: fetchSessions,
  };
}
