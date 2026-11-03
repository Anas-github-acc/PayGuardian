"use client";

import * as React from "react";
import { cn } from "../../lib/utils";
import { useWorkspaceStore, workspaceStore } from "../../app/lib/workspace-store";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";
import { Activity, RefreshCw } from "lucide-react";

export interface StatusPillProps {
  className?: string;
  showLatency?: boolean;
}

export function StatusPill({ className, showLatency = true }: StatusPillProps) {
  const { connectionStatus, latencyMs } = useWorkspaceStore();

  const statusConfig = {
    connected: {
      dotColor: "bg-success shadow-[0_0_8px_oklch(0.751_0.209_154.1)]",
      pingColor: "bg-success/40",
      textColor: "text-success",
      label: "Gateway Live",
      description: "Cryptographic state channel synchronized",
    },
    reconnecting: {
      dotColor: "bg-warning shadow-[0_0_8px_oklch(0.777_0.16_76.1)]",
      pingColor: "bg-warning/40",
      textColor: "text-warning",
      label: "Reconnecting",
      description: "Retrying gateway connection in background",
    },
    offline: {
      dotColor: "bg-destructive shadow-[0_0_8px_oklch(0.704_0.193_21.6)]",
      pingColor: "bg-destructive/40",
      textColor: "text-destructive",
      label: "Offline",
      description: "Disconnected from gateway. Showing cached state.",
    },
  }[connectionStatus];

  const handleManualRetry = (e: React.MouseEvent) => {
    e.stopPropagation();
    void workspaceStore.retryConnection();
  };

  return (
    <Tooltip>
      <TooltipTrigger
        className={cn("outline-none focus:outline-none", className)}
      >
        <div
          className={cn(
            "group inline-flex items-center gap-2 rounded-full border border-border bg-card px-2.5 py-1 text-xs transition-all duration-150 hover:border-border hover:bg-secondary select-none",
            connectionStatus === "reconnecting" && "border-warning/20 bg-warning/[0.03]",
            connectionStatus === "offline" && "border-destructive/20 bg-destructive/[0.03]"
          )}
          onClick={handleManualRetry}
          role="status"
          aria-label={`Gateway status: ${statusConfig.label}`}
        >
          {/* Glowing Micro-Dot with Subtle Ping Animation */}
          <div className="relative flex h-2 w-2 items-center justify-center">
            {connectionStatus !== "offline" && (
              <span
                className={cn(
                  "absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 duration-1000",
                  statusConfig.pingColor
                )}
              />
            )}
            <span
              className={cn(
                "relative inline-flex h-1.5 w-1.5 rounded-full transition-colors",
                statusConfig.dotColor
              )}
            />
          </div>

          {/* Status Label */}
          <span className="hidden font-mono text-[11px] font-medium tracking-tight text-muted-foreground sm:inline-block">
            {statusConfig.label}
          </span>

          {/* Latency Display */}
          {showLatency && connectionStatus === "connected" && latencyMs !== null && (
            <span className="font-mono text-[10px] text-muted-foreground tabular-nums">
              {latencyMs}ms
            </span>
          )}

          {/* Reconnect Spin Icon on Reconnecting */}
          {connectionStatus === "reconnecting" && (
            <RefreshCw className="h-3 w-3 animate-spin text-warning" />
          )}
        </div>
      </TooltipTrigger>

      <TooltipContent side="bottom" className="w-64 p-3 text-left">
        <div className="flex items-center justify-between pb-1.5 border-b border-border">
          <div className="flex items-center gap-1.5">
            <Activity className="h-3.5 w-3.5 text-success" />
            <span className="font-semibold text-xs text-foreground">Gateway Telemetry</span>
          </div>
          <span className={cn("text-[10px] font-mono uppercase font-bold", statusConfig.textColor)}>
            {connectionStatus}
          </span>
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground leading-relaxed">
          {statusConfig.description}
        </p>
        <div className="mt-2.5 flex items-center justify-between pt-1.5 border-t border-border text-[10px] text-muted-foreground">
          <span>Protocol: WebSocket + SSE</span>
          <span className="tabular-nums">{latencyMs ? `${latencyMs}ms ping` : "No ping"}</span>
        </div>
        <div className="mt-2 text-center text-[10px] text-success hover:underline cursor-pointer">
          Click to re-ping gateway
        </div>
      </TooltipContent>
    </Tooltip>
  );
}
