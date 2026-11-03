"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { apiClient } from "../client";
import { mapAuditEventsToFeed } from "../mappers/activity-feed";
import type { ActivityFeedItem } from "../types";
import type { AuditEventDto } from "@payguardian/contracts";

export interface UseActivityFeedOptions {
  pollingIntervalMs?: number;
  limit?: number;
}

export interface UseActivityFeedResult {
  activities: ActivityFeedItem[];
  rawEvents: AuditEventDto[];
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

export function useActivityFeed(
  environmentId?: string | null,
  options: UseActivityFeedOptions = {},
): UseActivityFeedResult {
  const { pollingIntervalMs = 3000, limit = 50 } = options;

  const [activities, setActivities] = useState<ActivityFeedItem[]>([]);
  const [rawEvents, setRawEvents] = useState<AuditEventDto[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(Boolean(environmentId));
  const [error, setError] = useState<Error | null>(null);

  const lastCursorRef = useRef<string | undefined>(undefined);

  const fetchActivities = useCallback(
    async (resetCursor = false) => {
      if (!environmentId) {
        setActivities([]);
        setRawEvents([]);
        setIsLoading(false);
        return;
      }

      if (resetCursor) {
        lastCursorRef.current = undefined;
      }

      try {
        const isInitial = !lastCursorRef.current;
        if (isInitial) {
          setIsLoading(true);
        }

        const events = await apiClient.activity.list(environmentId, {
          limit,
          since: lastCursorRef.current,
        });

        if (events.length > 0) {
          // Track the latest ISO timestamp as cursor
          const latestCreatedAt = events.reduce((latest, ev) => {
            return new Date(ev.createdAt).getTime() > new Date(latest).getTime()
              ? ev.createdAt
              : latest;
          }, events[events.length - 1].createdAt);
          lastCursorRef.current = latestCreatedAt;

          const mapped = mapAuditEventsToFeed(events);

          if (isInitial || resetCursor) {
            // Newest first for activity feed display
            const sortedRaw = [...events].sort(
              (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
            );
            const sortedMapped = [...mapped].sort((a, b) => {
              const aTime = a.timestamp || "";
              const bTime = b.timestamp || "";
              return bTime.localeCompare(aTime);
            });
            setRawEvents(sortedRaw.slice(0, limit));
            setActivities(sortedMapped.slice(0, limit));
          } else {
            // Incremental poll: prepend new items, deduplicate by id
            setRawEvents((prev) => {
              const existingIds = new Set(prev.map((e) => e.id));
              const fresh = events.filter((e) => !existingIds.has(e.id));
              return [...fresh, ...prev].slice(0, limit);
            });
            setActivities((prev) => {
              const existingIds = new Set(prev.map((a) => a.id));
              const fresh = mapped.filter((a) => !existingIds.has(a.id));
              return [...fresh, ...prev].slice(0, limit);
            });
          }
        }
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err : new Error(String(err)));
      } finally {
        setIsLoading(false);
      }
    },
    [environmentId, limit],
  );

  const refetch = useCallback(async () => {
    await fetchActivities(true);
  }, [fetchActivities]);

  useEffect(() => {
    setIsLoading(Boolean(environmentId));
    void fetchActivities(true);

    if (pollingIntervalMs && pollingIntervalMs > 0 && environmentId) {
      const timer = setInterval(() => {
        void fetchActivities(false);
      }, pollingIntervalMs);
      return () => clearInterval(timer);
    }
  }, [fetchActivities, environmentId, pollingIntervalMs]);

  return {
    activities,
    rawEvents,
    isLoading,
    error,
    refetch,
  };
}
