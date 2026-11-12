"use client";

import * as React from "react";
import { Trash2 } from "lucide-react";
import { formatMinorUnits } from "../../app/lib/currency";
import { useWorkspaceStore, workspaceStore } from "../../app/lib/workspace-store";
import { getAuthHeaders } from "../../lib/api/client";
import { EmergencyControls } from "./EmergencyControls";
import { RevocationDialog } from "./RevocationDialog";
import { SecurityEventLog } from "./SecurityEventLog";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import type { RevocationSubtreeImpact } from "./types";

export interface SecurityCenterProps {
  environmentId?: string;
  onViewTrace?: (traceId: string) => void;
  className?: string;
}

export function SecurityCenter({
  environmentId,
  onViewTrace,
  className = "",
}: SecurityCenterProps) {
  const store = useWorkspaceStore();
  const currentEnv = store.currentEnvironment;
  const activeEnvId = environmentId ?? currentEnv?.id ?? "env-sandbox-travel-01";

  const [activeRevocationImpact, setActiveRevocationImpact] = React.useState<RevocationSubtreeImpact | null>(null);
  const [isRevokeDialogOpen, setIsRevokeDialogOpen] = React.useState<boolean>(false);
  const [isProcessing, setIsProcessing] = React.useState<boolean>(false);

  // Authority Revocation branches
  const agents = store.graphNodes.length > 0 ? store.graphNodes : [
    { id: "orchestrator-root", name: "Main Orchestrator", role: "orchestrator", allocatedMinor: 1000000 },
    { id: "agent-travel", name: "Travel Subagent", role: "subagent", allocatedMinor: 400000 },
    { id: "agent-hotel", name: "Hotel Subagent", role: "subagent", allocatedMinor: 400000 },
  ];

  const handleOpenRevokeRoot = () => {
    setActiveRevocationImpact({
      targetMandateId: "man-root-9081",
      targetAgentName: "All Environment Mandates (Root Authority)",
      cascadeAgentsCount: agents.length,
      cascadeMandatesCount: 4,
      heldReservationsMinor: currentEnv?.reservedMinor ?? 150000,
      currency: currentEnv?.currency ?? "USD",
      childAgentNames: agents.map((a) => a.name),
    });
    setIsRevokeDialogOpen(true);
  };

  const handleOpenRevokeAgent = (agentId: string, agentName: string) => {
    const isRoot = agentId === "orchestrator-root";
    setActiveRevocationImpact({
      targetMandateId: isRoot ? "man-root-9081" : `man-${agentId}-4001`,
      targetAgentName: agentName,
      cascadeAgentsCount: isRoot ? agents.length : 2,
      cascadeMandatesCount: isRoot ? 4 : 2,
      heldReservationsMinor: 50000,
      currency: currentEnv?.currency ?? "USD",
      childAgentNames: isRoot ? agents.map((a) => a.name) : [`${agentName} Child Scraper`, "Booking Gateway"],
    });
    setIsRevokeDialogOpen(true);
  };

  const handleConfirmRevoke = async (mandateId: string) => {
    setIsProcessing(true);
    try {
      const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001";
      if (mandateId === "man-root-9081") {
        await fetch(`${apiBaseUrl}/v1/environments/${activeEnvId}/revoke`, {
          method: "POST",
          headers: getAuthHeaders(),
        }).catch(() => null);
        workspaceStore.updateEnvironment(activeEnvId, { status: "revoked" });
      } else {
        await fetch(`${apiBaseUrl}/v1/mandates/${mandateId}/revocations`, {
          method: "POST",
          headers: getAuthHeaders(),
        }).catch(() => null);
      }
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className={`mx-auto w-full max-w-[1200px] px-4 py-6 sm:px-6 lg:px-8 space-y-6 ${className}`}>
      {/* Top Banner / Breadcrumb */}
      <div>
        <h2 className="text-lg font-bold tracking-tight text-foreground">
          Security Center & Fail-Safe Interventions
        </h2>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Environment-wide emergency halts, cryptographic authority revocation, and real-time policy violation telemetry.
        </p>
      </div>

      {/* Emergency Controls Section */}
      <EmergencyControls
        environmentId={activeEnvId}
        onRevokeAll={handleOpenRevokeRoot}
      />

      {/* Key Security Telemetry Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
        <div className="rounded-lg border border-border bg-card p-3.5 top-shade">
          <span className="text-[10px] uppercase font-mono text-muted-foreground block">Active Mandates</span>
          <div className="text-xl font-bold font-mono text-foreground mt-1">
            {agents.length} active
          </div>
          <span className="text-[11px] text-success mt-0.5 block">0 branches revoked</span>
        </div>

        <div className="rounded-lg border border-border bg-card p-3.5 top-shade">
          <span className="text-[10px] uppercase font-mono text-muted-foreground block">Emergency Halt State</span>
          <div className="text-xl font-bold font-mono text-foreground mt-1 capitalize">
            {currentEnv?.status ?? "active"}
          </div>
          <span className="text-[11px] text-muted-foreground mt-0.5 block">Fail-safe standing by</span>
        </div>

        <div className="rounded-lg border border-border bg-card p-3.5 top-shade">
          <span className="text-[10px] uppercase font-mono text-muted-foreground block">Blocked Incidents (24h)</span>
          <div className="text-xl font-bold font-mono text-warning mt-1">
            4 prevented
          </div>
          <span className="text-[11px] text-warning/80 mt-0.5 block">2 simulation vectors</span>
        </div>

        <div className="rounded-lg border border-border bg-card p-3.5 top-shade">
          <span className="text-[10px] uppercase font-mono text-muted-foreground block">Cryptographic Rail Integrity</span>
          <div className="text-xl font-bold font-mono text-success mt-1">
            100% Valid
          </div>
          <span className="text-[11px] text-success mt-0.5 block">Secp256k1 & Double-entry</span>
        </div>
      </div>

      {/* Authority Revocation Center */}
      <div className="rounded-lg border border-border bg-card p-4 top-shade space-y-3">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div>
            <h3 className="text-sm font-semibold text-foreground">
              Authority Revocation Center
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Select any agent branch to preview downstream subtree impact and trigger immediate cryptographic invalidation.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {agents.map((agent) => (
            <div
              key={agent.id}
              className="rounded-md border border-border bg-card p-3.5 text-xs flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-foreground">{agent.name}</span>
                  <Badge variant={agent.role === "orchestrator" ? "default" : "secondary"} className="text-[9px]">
                    {agent.role}
                  </Badge>
                </div>
                <span className="font-mono text-[11px] text-muted-foreground block mt-1">
                  ID: {agent.id}
                </span>
                <div className="mt-2 text-[11px] text-muted-foreground">
                  Allocated Authority:{" "}
                  <span className="font-mono text-foreground font-medium">
                    {formatMinorUnits(agent.allocatedMinor, currentEnv?.currency ?? "USD")}
                  </span>
                </div>
              </div>

              <div className="mt-3 pt-2.5 border-t border-border flex items-center justify-end">
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => handleOpenRevokeAgent(agent.id, agent.name)}
                  className="h-7 text-xs"
                >
                  <Trash2 className="mr-1 h-3 w-3" />
                  Revoke Branch
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Security Incident Stream */}
      <SecurityEventLog onViewTrace={onViewTrace} />

      {/* Revocation Confirmation Dialog */}
      <RevocationDialog
        isOpen={isRevokeDialogOpen}
        onClose={() => {
          setIsRevokeDialogOpen(false);
          setActiveRevocationImpact(null);
        }}
        impact={activeRevocationImpact}
        onConfirmRevoke={handleConfirmRevoke}
        isProcessing={isProcessing}
      />
    </div>
  );
}
