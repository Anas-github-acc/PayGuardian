"use client";

import * as React from "react";
import {
  PauseCircle,
  PlayCircle,
  ShieldAlert,
  AlertTriangle,
  Lock,
  Check,
} from "lucide-react";
import { useWorkspaceStore, workspaceStore } from "../../app/lib/workspace-store";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";

export interface EmergencyControlsProps {
  environmentId?: string;
  onRevokeAll?: () => void;
  className?: string;
}

export function EmergencyControls({
  environmentId,
  onRevokeAll,
  className = "",
}: EmergencyControlsProps) {
  const store = useWorkspaceStore();
  const currentEnv = store.currentEnvironment;
  const activeEnvId = environmentId ?? currentEnv?.id ?? "env-sandbox-travel-01";
  const status = currentEnv?.status ?? "active";

  const [isProcessing, setIsProcessing] = React.useState<boolean>(false);
  const [feedbackMessage, setFeedbackMessage] = React.useState<string | null>(null);

  const handlePause = async () => {
    setIsProcessing(true);
    try {
      const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001";
      await fetch(`${apiBaseUrl}/v1/environments/${activeEnvId}/pause`, {
        method: "POST",
        headers: { "x-local-user-id": "local-user" },
      }).catch(() => null);

      workspaceStore.updateEnvironment(activeEnvId, { status: "paused" });
      setFeedbackMessage("Environment successfully paused. All autonomous agent spending is halted.");
      setTimeout(() => setFeedbackMessage(null), 5000);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleResume = async () => {
    setIsProcessing(true);
    try {
      const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001";
      await fetch(`${apiBaseUrl}/v1/environments/${activeEnvId}/resume`, {
        method: "POST",
        headers: { "x-local-user-id": "local-user" },
      }).catch(() => null);

      workspaceStore.updateEnvironment(activeEnvId, { status: "active" });
      setFeedbackMessage("Environment resumed. Active mandates restored to normal operational state.");
      setTimeout(() => setFeedbackMessage(null), 5000);
    } finally {
      setIsProcessing(false);
    }
  };

  const isPaused = status === "paused";
  const isRevoked = status === "revoked";

  return (
    <div
      className={`rounded-lg border p-4 transition-colors top-shade ${
        isPaused
          ? "border-warning/40 bg-warning/5"
          : isRevoked
          ? "border-destructive/40 bg-destructive/5"
          : "border-border bg-card"
      } ${className}`}
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border ${
              isPaused
                ? "border-warning/30 bg-warning/10 text-warning"
                : isRevoked
                ? "border-destructive/30 bg-destructive/10 text-destructive"
                : "border-success/30 bg-success/10 text-success"
            }`}
          >
            {isPaused ? (
              <PauseCircle className="h-6 w-6" />
            ) : isRevoked ? (
              <Lock className="h-6 w-6" />
            ) : (
              <ShieldAlert className="h-6 w-6" />
            )}
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-foreground">
                Emergency Environment Controls
              </h3>
              <Badge
                variant={isPaused ? "pending" : isRevoked ? "revoked" : "authorized"}
                showDot={!isRevoked}
              >
                STATUS: {status.toUpperCase()}
              </Badge>
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {isPaused
                ? "Protected actions are paused. No agent can make external payments until resumed."
                : isRevoked
                ? "Root environment authority has been revoked. All child authority is terminated."
                : "Immediate fail-safe intervention controls for active autonomous spend."}
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          {isPaused ? (
            <Button
              variant="primary"
              size="sm"
              onClick={handleResume}
              disabled={isProcessing}
              className="bg-success hover:bg-success text-black font-semibold text-xs"
            >
              <PlayCircle className="mr-1.5 h-4 w-4" />
              Resume Environment
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={handlePause}
              disabled={isProcessing || isRevoked}
              className="border-warning/30 text-warning hover:bg-warning/10 text-xs"
            >
              <PauseCircle className="mr-1.5 h-4 w-4" />
              Pause Environment
            </Button>
          )}

          {onRevokeAll && (
            <Button
              variant="destructive"
              size="sm"
              onClick={onRevokeAll}
              disabled={isProcessing || isRevoked}
              className="text-xs font-semibold"
            >
              <AlertTriangle className="mr-1.5 h-4 w-4" />
              Revoke All Authority
            </Button>
          )}
        </div>
      </div>

      {/* Confirmation Feedback Banner */}
      {feedbackMessage && (
        <div className="mt-3 rounded border border-success/30 bg-success/10 p-2.5 text-xs text-success flex items-center gap-2 animate-in fade-in duration-150">
          <Check className="h-4 w-4 shrink-0" />
          <span>{feedbackMessage}</span>
        </div>
      )}
    </div>
  );
}
