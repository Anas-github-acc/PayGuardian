"use client";

import * as React from "react";
import {
  Activity,
  Radio,
  ExternalLink,
  ShieldX,
  CheckCircle2,
  Clock,
  AlertTriangle,
  RotateCcw,
} from "lucide-react";
import { formatMinorUnits } from "../../app/lib/currency";
import { useWorkspaceStore, workspaceStore } from "../../app/lib/workspace-store";
import { useActivityFeed } from "../../lib/api/hooks/use-activity-feed";
import type { ActivityFeedItem } from "../../lib/api/types";
import { Button } from "../ui/button";

export interface ActivityMicroFeedProps {
  className?: string;
  activities?: ActivityFeedItem[];
  currency?: string;
  isLoading?: boolean;
  error?: Error | null;
  onRetry?: () => void;
  onSelectTrace?: (traceId: string) => void;
}

export function ActivityMicroFeed({
  className = "",
  activities: propActivities,
  currency = "USD",
  isLoading: propIsLoading,
  error: propError,
  onRetry: propOnRetry,
  onSelectTrace,
}: ActivityMicroFeedProps) {
  const store = useWorkspaceStore();
  const currentEnv = store.currentEnvironment;

  const hookResult = useActivityFeed(
    propActivities ? null : currentEnv?.id,
    { pollingIntervalMs: 3000 },
  );

  const items = propActivities ?? hookResult.activities;
  const isLoading = propIsLoading ?? (propActivities ? false : hookResult.isLoading);
  const error = propError ?? (propActivities ? null : hookResult.error);
  const handleRetry = propOnRetry ?? hookResult.refetch;

  const handleSelectTrace = (item: ActivityFeedItem) => {
    if (item.traceId) {
      workspaceStore.setSelectedTraceId(item.traceId);
      onSelectTrace?.(item.traceId);
    }
  };

  return (
    <section
      aria-label="Live activity"
      className={`rounded-lg border border-border bg-card text-foreground top-shade ${className}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border bg-secondary text-success">
            <Activity className="h-4 w-4" />
          </span>
          <div>
            <h3 className="text-sm font-semibold tracking-tight text-foreground">
              Live activity
            </h3>
            <p className="flex items-center gap-1 text-[11px] font-mono text-success">
              <Radio className="h-2.5 w-2.5 animate-pulse" />
              Streaming
            </p>
          </div>
        </div>
        <span className="text-[11px] text-muted-foreground">
          {isLoading ? "Syncing..." : `Last ${items.length} events`}
        </span>
      </div>

      {/* Loading Skeleton */}
      {isLoading && items.length === 0 && (
        <div className="divide-y divide-border p-4 space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-3 animate-pulse pt-2 first:pt-0">
              <div className="h-8 w-8 rounded-md bg-zinc-800/60 shrink-0" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3 w-1/3 rounded bg-zinc-800/60" />
                <div className="h-2.5 w-1/2 rounded bg-zinc-800/40" />
              </div>
              <div className="h-3 w-12 rounded bg-zinc-800/50" />
            </div>
          ))}
        </div>
      )}

      {/* Error State */}
      {!isLoading && error && items.length === 0 && (
        <div className="flex flex-col items-center justify-center p-6 text-center">
          <AlertTriangle className="h-6 w-6 text-amber-500 mb-2" />
          <p className="text-xs font-medium text-foreground">Failed to load activity stream</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">{error.message}</p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void handleRetry()}
            className="mt-3 h-7 text-xs border-zinc-800 hover:bg-zinc-800"
          >
            <RotateCcw className="h-3 w-3 mr-1.5" />
            Retry
          </Button>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && !error && items.length === 0 && (
        <div className="flex flex-col items-center justify-center p-6 text-center text-muted-foreground">
          <Clock className="h-6 w-6 mb-2 opacity-40" />
          <p className="text-xs">No activity recorded yet in this environment.</p>
        </div>
      )}

      {/* Process-status rows */}
      {items.length > 0 && (
        <div className="divide-y divide-border">
          {items.map((item) => {
            const isDenied = item.outcome === "denied";
            const isPending = item.outcome === "pending";

            return (
              <div
                key={item.id}
                className={`flex items-center gap-3 px-4 py-3 transition-colors ${
                  isDenied ? "bg-destructive/10" : ""
                }`}
              >
                {/* Status icon tile */}
                <span
                  aria-hidden
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md border ${
                    isDenied
                      ? "border-destructive/30 bg-destructive/10 text-destructive"
                      : isPending
                      ? "border-warning/30 bg-warning/10 text-warning"
                      : "border-success/30 bg-success/10 text-success"
                  }`}
                >
                  {isDenied ? (
                    <ShieldX className="h-4 w-4" />
                  ) : isPending ? (
                    <Clock className="h-4 w-4" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4" />
                  )}
                </span>

                {/* Title + subtitle */}
                <button
                  type="button"
                  onClick={() => handleSelectTrace(item)}
                  className="min-w-0 flex-1 text-left focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <span className="block truncate text-xs font-semibold text-foreground">
                    {item.action}
                  </span>
                  <span className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <span className="truncate">{item.actorName}</span>
                    <span aria-hidden>·</span>
                    <span className="font-mono">{item.timestamp}</span>
                    {item.reasonCode && (
                      <>
                        <span aria-hidden>·</span>
                        <span className="font-mono text-destructive">{item.reasonCode}</span>
                      </>
                    )}
                    {item.isSimulation && (
                      <span className="rounded border border-warning/30 bg-warning/10 px-1 py-px font-mono text-[9px] font-medium text-warning">
                        SIM
                      </span>
                    )}
                  </span>
                </button>

                {/* Amount */}
                {item.amountMinor !== undefined && item.amountMinor > 0 && (
                  <span
                    className={`shrink-0 font-mono text-xs font-medium tabular-nums ${
                      isDenied ? "text-destructive" : "text-foreground"
                    }`}
                  >
                    {formatMinorUnits(item.amountMinor, item.currency ?? currency)}
                  </span>
                )}

                {/* Trailing trace action */}
                {item.traceId && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleSelectTrace(item)}
                    aria-label={`Open trace for ${item.action}`}
                    className="h-7 w-7 shrink-0 p-0"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
