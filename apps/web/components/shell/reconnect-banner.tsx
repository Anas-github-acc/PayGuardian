"use client";

import * as React from "react";
import { AlertTriangle, RefreshCw, X } from "lucide-react";
import { cn } from "../../lib/utils";
import { useWorkspaceStore, workspaceStore } from "../../app/lib/workspace-store";
import { Button } from "../ui/button";

export function ReconnectBanner() {
  const { connectionStatus, reconnectBannerVisible } = useWorkspaceStore();
  const [isRetrying, setIsRetrying] = React.useState(false);

  // If connection is healthy and banner is not explicitly forced, hide it
  if (connectionStatus === "connected" && !reconnectBannerVisible) {
    return null;
  }

  const handleRetry = async () => {
    setIsRetrying(true);
    try {
      await workspaceStore.retryConnection();
    } finally {
      setIsRetrying(false);
    }
  };

  const handleDismiss = () => {
    workspaceStore.setReconnectBannerVisible(false);
  };

  const isOffline = connectionStatus === "offline";

  return (
    <aside
      aria-label="Gateway connection status"
      className={cn(
        "relative z-50 flex items-center justify-between border-b px-4 py-2 text-xs transition-all duration-200",
        isOffline
          ? "border-destructive/30 bg-destructive/40 text-destructive"
          : "border-warning/30 bg-warning/40 text-warning"
      )}
    >
      <div className="flex items-center gap-2.5 overflow-hidden">
        <AlertTriangle
          className={cn(
            "h-4 w-4 shrink-0",
            isOffline ? "text-destructive" : "text-warning"
          )}
        />
        <div className="flex flex-wrap items-center gap-1.5 leading-snug">
          <span className="font-semibold tracking-tight text-foreground">
            {isOffline ? "Gateway Connection Lost." : "Live Updates Paused."}
          </span>
          <span className="text-muted-foreground">
            {isOffline
              ? "Operating in local offline cache. Changes will not sync until reconnected."
              : "Reconnecting to real-time event stream. Data on screen may be stale."}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0 ml-4">
        <Button
          size="sm"
          variant="secondary"
          onClick={() => void handleRetry()}
          disabled={isRetrying || connectionStatus === "reconnecting"}
          className="h-7 px-2.5 text-[11px] font-medium border-border bg-black/40 hover:bg-black/60"
        >
          <RefreshCw
            className={cn(
              "mr-1.5 h-3 w-3",
              (isRetrying || connectionStatus === "reconnecting") && "animate-spin"
            )}
          />
          {isRetrying || connectionStatus === "reconnecting"
            ? "Reconnecting…"
            : "Retry Connection"}
        </Button>

        <button
          type="button"
          onClick={handleDismiss}
          className="rounded p-1 text-muted-foreground hover:bg-white/[0.08] hover:text-foreground transition-colors"
          aria-label="Dismiss banner"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </aside>
  );
}
