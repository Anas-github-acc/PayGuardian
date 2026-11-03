"use client";

import * as React from "react";
import {
  ChevronRight,
  AlertTriangle,
  RotateCcw,
  Clock,
} from "lucide-react";
import { formatMinorUnits } from "../../app/lib/currency";
import { useWorkspaceStore, workspaceStore } from "../../app/lib/workspace-store";
import { useDashboardNavigation } from "../../app/lib/navigation";
import { useActivityFeed } from "../../lib/api/hooks/use-activity-feed";
import type { ActivityFeedItem } from "../../lib/api/types";
import { Button } from "../ui/button";

export interface RecentActivityPanelProps {
  className?: string;
  activities?: ActivityFeedItem[];
  isLoading?: boolean;
  error?: Error | null;
  onRetry?: () => void;
  onSelectTrace?: (traceId: string) => void;
  onViewAll?: () => void;
}

export function RecentActivityPanel({
  className = "",
  activities: propActivities,
  isLoading: propIsLoading,
  error: propError,
  onRetry: propOnRetry,
  onSelectTrace,
  onViewAll,
}: RecentActivityPanelProps) {
  const { navigateTab } = useDashboardNavigation();
  const store = useWorkspaceStore();
  const currentEnv = store.currentEnvironment;

  const hookResult = useActivityFeed(
    propActivities ? null : currentEnv?.id,
    { pollingIntervalMs: 3000 },
  );

  const activities = propActivities ?? hookResult.activities;
  const isLoading = propIsLoading ?? (propActivities ? false : hookResult.isLoading);
  const error = propError ?? (propActivities ? null : hookResult.error);
  const handleRetry = propOnRetry ?? hookResult.refetch;

  const handleItemClick = (traceId?: string) => {
    if (traceId) {
      workspaceStore.setSelectedTraceId(traceId);
      onSelectTrace?.(traceId);
    }
  };

  return (
    <section
      aria-label="Recent activity"
      className={`flex flex-col rounded-xl border border-zinc-800 bg-zinc-950 p-5 shadow-sm sm:p-6 ${className}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-zinc-900 pb-3">
        <div>
          <h2 className="text-base font-semibold tracking-tight text-white">
            Recent activity
          </h2>
          <p className="mt-0.5 text-xs text-zinc-400">
            Real-time audit log of delegated transactions
          </p>
        </div>
        <button
          type="button"
          onClick={
            onViewAll ??
            (() => {
              navigateTab("tables", "activity");
            })
          }
          className="text-xs text-zinc-400 hover:text-white transition-colors flex items-center gap-1"
        >
          <span>View all</span>
          <ChevronRight className="h-3 w-3" />
        </button>
      </div>

      {/* Loading Skeleton */}
      {isLoading && activities.length === 0 && (
        <div className="mt-4 flex-1 space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="flex w-full items-center justify-between rounded-lg border border-zinc-800/80 bg-zinc-900/40 p-3.5 animate-pulse"
            >
              <div className="flex items-center gap-3">
                <div className="h-6 w-12 rounded bg-zinc-800/60" />
                <div className="space-y-1.5">
                  <div className="h-3.5 w-28 rounded bg-zinc-800/60" />
                  <div className="h-2.5 w-40 rounded bg-zinc-800/40" />
                </div>
              </div>
              <div className="h-4 w-4 rounded bg-zinc-800/40" />
            </div>
          ))}
        </div>
      )}

      {/* Error State */}
      {!isLoading && error && activities.length === 0 && (
        <div className="mt-4 flex-1 flex flex-col items-center justify-center p-6 text-center border border-dashed border-zinc-800 rounded-lg">
          <AlertTriangle className="h-6 w-6 text-amber-500 mb-2" />
          <p className="text-xs font-medium text-zinc-300">Failed to load recent activity</p>
          <p className="text-[11px] text-zinc-500 mt-0.5">{error.message}</p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void handleRetry()}
            className="mt-3 h-7 text-xs border-zinc-800 hover:bg-zinc-800 text-zinc-300"
          >
            <RotateCcw className="h-3 w-3 mr-1.5" />
            Retry
          </Button>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && !error && activities.length === 0 && (
        <div className="mt-4 flex-1 flex flex-col items-center justify-center p-6 text-center text-zinc-500 border border-dashed border-zinc-850 rounded-lg">
          <Clock className="h-6 w-6 mb-2 opacity-40 text-zinc-400" />
          <p className="text-xs">
            No activity recorded yet for this environment. As agents initiate transactions and
            reservations, audit receipts will appear here in real time.
          </p>
        </div>
      )}

      {/* Live Activity Items List */}
      {activities.length > 0 && (
        <div className="mt-4 flex-1 space-y-3">
          {activities.slice(0, 5).map((item) => {
            const isDenied = item.outcome === "denied";
            const isPending = item.outcome === "pending";

            const badgeText = isDenied ? "Blocked" : isPending ? "Reserved" : "Paid";
            const badgeClasses = isDenied
              ? "border-red-900/60 bg-red-950/50 text-red-400"
              : isPending
              ? "border-orange-900/60 bg-orange-950/50 text-orange-400"
              : "border-blue-900/50 bg-blue-950/40 text-blue-400";

            const amountText =
              item.amountMinor !== undefined && item.amountMinor > 0
                ? formatMinorUnits(item.amountMinor, item.currency ?? "USD")
                : null;

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleItemClick(item.traceId)}
                className="group flex w-full items-center justify-between rounded-lg border border-zinc-800/80 bg-zinc-900/40 p-3.5 text-left transition-all hover:border-zinc-700 hover:bg-zinc-900/70"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span
                    className={`inline-flex shrink-0 items-center rounded-md border px-2.5 py-1 text-xs font-semibold font-mono ${badgeClasses}`}
                  >
                    {badgeText}
                  </span>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-white tracking-tight tabular-nums truncate">
                      {amountText ? `${amountText} — ${item.action}` : item.action}
                    </div>
                    <p className="text-[11px] text-zinc-400 truncate">
                      {item.actorName} · {item.timestamp}
                      {item.reasonCode ? ` · ${item.reasonCode}` : ""}
                    </p>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-zinc-600 transition-transform group-hover:translate-x-0.5 group-hover:text-zinc-400 shrink-0 ml-2" />
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}
