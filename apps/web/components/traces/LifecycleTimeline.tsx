"use client";

import * as React from "react";
import {
  Check,
  Clock,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  FileCode,
  Zap,
} from "lucide-react";
import { Badge } from "../ui/badge";
import type { TraceLifecycleStage } from "./types";

export interface LifecycleTimelineProps {
  stages: TraceLifecycleStage[];
  className?: string;
}

export function LifecycleTimeline({ stages, className = "" }: LifecycleTimelineProps) {
  const [expandedIndex, setExpandedIndex] = React.useState<number | null>(null);

  const toggleExpand = (idx: number) => {
    setExpandedIndex((current) => (current === idx ? null : idx));
  };

  return (
    <div className={`space-y-3 ${className}`}>
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground font-mono">
          5-Stage Gateway Execution & Settlement Timeline
        </h4>
        <span className="text-[11px] text-muted-foreground font-mono">
          Cryptographic Execution Latency
        </span>
      </div>

      <div className="relative pl-6 space-y-4">
        {/* Timeline Line */}
        <div className="absolute left-[23px] top-3 bottom-3 w-[2px] bg-white/[0.08]" />

        {stages.map((stage, idx) => {
          const isCompleted = stage.status === "completed";
          const isFailed = stage.status === "failed";
          const isActive = stage.status === "active";
          const isSkipped = stage.status === "skipped";
          const isExpanded = expandedIndex === idx;

          return (
            <div key={stage.key} className="relative">
              {/* Timeline Indicator */}
              <div
                className={`absolute -left-6 top-3 flex h-4 w-4 -translate-x-[7px] items-center justify-center rounded-full border text-[9px] font-bold ${
                  isCompleted
                    ? "border-success bg-success text-black"
                    : isFailed
                    ? "border-destructive bg-destructive text-foreground"
                    : isActive
                    ? "border-warning bg-warning/20 text-warning animate-pulse"
                    : "border-border bg-secondary text-muted-foreground"
                }`}
              >
                {isCompleted ? (
                  <Check className="h-2.5 w-2.5 stroke-[3]" />
                ) : isFailed ? (
                  <AlertCircle className="h-2.5 w-2.5" />
                ) : (
                  idx + 1
                )}
              </div>

              {/* Stage Card */}
              <div
                className={`rounded-lg border bg-card p-3.5 text-foreground top-shade transition-colors ${
                  isFailed
                    ? "border-destructive/40 bg-destructive/5"
                    : isActive
                    ? "border-warning/30"
                    : "border-border hover:border-border"
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-foreground">{stage.name}</span>
                    {isCompleted && (
                      <Badge variant="authorized" className="text-[10px] py-0 px-1.5">
                        Completed
                      </Badge>
                    )}
                    {isFailed && (
                      <Badge variant="rejected" className="text-[10px] py-0 px-1.5">
                        Gateway Denied
                      </Badge>
                    )}
                    {isActive && (
                      <Badge variant="pending" className="text-[10px] py-0 px-1.5">
                        In Progress
                      </Badge>
                    )}
                    {isSkipped && (
                      <Badge variant="revoked" className="text-[10px] py-0 px-1.5">
                        Skipped
                      </Badge>
                    )}
                  </div>

                  <div className="flex items-center gap-2 font-mono text-[11px] text-muted-foreground">
                    {stage.latencyMs > 0 && (
                      <span className="flex items-center gap-1 text-success">
                        <Zap className="h-3 w-3" />
                        +{stage.latencyMs}ms
                      </span>
                    )}
                    <span>{stage.timestamp}</span>
                  </div>
                </div>

                <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                  {stage.description}
                </p>

                {/* Technical details toggle */}
                {stage.details && Object.keys(stage.details).length > 0 && (
                  <div className="mt-2 pt-2 border-t border-border">
                    <button
                      type="button"
                      onClick={() => toggleExpand(idx)}
                      className="inline-flex items-center gap-1 text-[11px] font-mono text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <FileCode className="h-3 w-3" />
                      <span>{isExpanded ? "Hide Execution Payload" : "View Execution Payload"}</span>
                      {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                    </button>

                    {isExpanded && (
                      <pre className="mt-2 rounded bg-card p-2.5 font-mono text-[11px] text-muted-foreground overflow-x-auto border border-border">
                        {JSON.stringify(stage.details, null, 2)}
                      </pre>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
