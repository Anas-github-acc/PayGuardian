"use client";

import * as React from "react";
import {
  ExternalLink,
  ChevronRight,
  ShieldAlert,
  ArrowRight,
} from "lucide-react";
import { workspaceStore } from "../../app/lib/workspace-store";
import { useDashboardNavigation } from "../../app/lib/navigation";
import { INITIAL_ACTIVITIES, type ActivityFeedItem } from "./workspace-defaults";

export interface RecentActivityPanelProps {
  className?: string;
  activities?: ActivityFeedItem[];
  onSelectTrace?: (traceId: string) => void;
  onViewAll?: () => void;
}

export function RecentActivityPanel({
  className = "",
  activities = INITIAL_ACTIVITIES,
  onSelectTrace,
  onViewAll,
}: RecentActivityPanelProps) {
  const { navigateTab } = useDashboardNavigation();
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
          onClick={onViewAll ?? (() => {
            navigateTab("tables", "activity");
          })}
          className="text-xs text-zinc-400 hover:text-white transition-colors flex items-center gap-1"
        >
          <span>View all</span>
          <ChevronRight className="h-3 w-3" />
        </button>
      </div>

      {/* Activity Items List */}
      <div className="mt-4 flex-1 space-y-3">
        {/* Item 1: Paid $245 Flight */}
        <button
          type="button"
          onClick={() => handleItemClick("trace-pay-9019")}
          className="group flex w-full items-center justify-between rounded-lg border border-zinc-800/80 bg-zinc-900/40 p-3.5 text-left transition-all hover:border-zinc-700 hover:bg-zinc-900/70"
        >
          <div className="flex items-center gap-3">
            <span className="inline-flex shrink-0 items-center rounded-md border border-blue-900/50 bg-blue-950/40 px-2.5 py-1 text-xs font-semibold text-blue-400 font-mono">
              Paid
            </span>
            <div>
              <div className="text-sm font-semibold text-white tracking-tight tabular-nums">
                $245 Flight
              </div>
              <p className="text-[11px] text-zinc-400">
                IndiGo Flight 6E-204 · via PayPal rail · 13:58:45
              </p>
            </div>
          </div>
          <ChevronRight className="h-4 w-4 text-zinc-600 transition-transform group-hover:translate-x-0.5 group-hover:text-zinc-400" />
        </button>

        {/* Item 2: Blocked $5,000 Hotel */}
        <button
          type="button"
          onClick={() => handleItemClick("trace-rej-7712")}
          className="group flex w-full items-center justify-between rounded-lg border border-zinc-800/80 bg-zinc-900/40 p-3.5 text-left transition-all hover:border-zinc-700 hover:bg-zinc-900/70"
        >
          <div className="flex items-center gap-3">
            <span className="inline-flex shrink-0 items-center rounded-md border border-red-900/60 bg-red-950/50 px-2.5 py-1 text-xs font-semibold text-red-400 font-mono">
              Blocked
            </span>
            <div>
              <div className="text-sm font-semibold text-white tracking-tight tabular-nums">
                $5,000 Hotel
              </div>
              <p className="text-[11px] text-zinc-400">
                Grand Hyatt Goa · Exceeded $4,000 sub-mandate limit · 13:12:05
              </p>
            </div>
          </div>
          <ChevronRight className="h-4 w-4 text-zinc-600 transition-transform group-hover:translate-x-0.5 group-hover:text-zinc-400" />
        </button>

        {/* Item 3: Reserved $1,000 Hotel */}
        <button
          type="button"
          onClick={() => handleItemClick("trace-pay-9018")}
          className="group flex w-full items-center justify-between rounded-lg border border-zinc-800/80 bg-zinc-900/40 p-3.5 text-left transition-all hover:border-zinc-700 hover:bg-zinc-900/70"
        >
          <div className="flex items-center gap-3">
            <span className="inline-flex shrink-0 items-center rounded-md border border-orange-900/60 bg-orange-950/50 px-2.5 py-1 text-xs font-semibold text-orange-400 font-mono">
              Reserved
            </span>
            <div>
              <div className="text-sm font-semibold text-white tracking-tight tabular-nums">
                $1,000 Hotel
              </div>
              <p className="text-[11px] text-zinc-400">
                Grand Hyatt Goa room hold · Escrow authorization · 14:02:18
              </p>
            </div>
          </div>
          <ChevronRight className="h-4 w-4 text-zinc-600 transition-transform group-hover:translate-x-0.5 group-hover:text-zinc-400" />
        </button>
      </div>
    </section>
  );
}
