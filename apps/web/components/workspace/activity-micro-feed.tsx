"use client";

import * as React from "react";
import {
  Activity,
  Radio,
  ExternalLink,
  ShieldX,
  CheckCircle2,
  Clock,
} from "lucide-react";
import { formatMinorUnits } from "../../app/lib/currency";
import { workspaceStore } from "../../app/lib/workspace-store";
import { INITIAL_ACTIVITIES, type ActivityFeedItem } from "./workspace-defaults";
import { Button } from "../ui/button";

export interface ActivityMicroFeedProps {
  className?: string;
  activities?: ActivityFeedItem[];
  currency?: string;
  onSelectTrace?: (traceId: string) => void;
}

export function ActivityMicroFeed({
  className = "",
  activities = INITIAL_ACTIVITIES,
  currency = "USD",
  onSelectTrace,
}: ActivityMicroFeedProps) {
  const [items] = React.useState<ActivityFeedItem[]>(activities);

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
        <span className="text-[11px] text-muted-foreground">Last {items.length} events</span>
      </div>

      {/* Process-status rows */}
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
    </section>
  );
}
