"use client";

import * as React from "react";
import {
  ShieldCheck,
  Link2,
  MessageSquare,
  Trash2,
  AlertTriangle,
} from "lucide-react";
import { formatMinorUnits, calculateAvailableMinor } from "../../app/lib/currency";
import { useWorkspaceStore, workspaceStore } from "../../app/lib/workspace-store";
import type { AgentNodeData } from "./types";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from "../ui/sheet";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";

export interface NodeDetailDrawerProps {
  nodeId: string | null;
  node?: AgentNodeData;
  isOpen: boolean;
  onClose: () => void;
  currency?: string;
  onRevoke?: (nodeId: string) => void;
  onDirectChat?: (nodeId: string) => void;
  onProposeAllocation?: (nodeId: string) => void;
  onDetach?: (nodeId: string) => void;
}

export function NodeDetailDrawer({
  nodeId,
  node: propNode,
  isOpen,
  onClose,
  currency: propCurrency,
  onRevoke,
  onDirectChat,
  onProposeAllocation: _onProposeAllocation,
  onDetach,
}: NodeDetailDrawerProps) {
  const store = useWorkspaceStore();
  const env = store.currentEnvironment;
  const currency = propCurrency ?? env?.currency ?? "USD";
  const [activeTab, setActiveTab] = React.useState<"overview" | "authority" | "activity">("overview");
  const [showRevokeConfirm, setShowRevokeConfirm] = React.useState(false);

  // Find node by id in store graphNodes
  const node = propNode ?? store.graphNodes.find((n) => n.id === nodeId);

  if (!node && !nodeId) return null;

  // Fallback defaults if node isn't found in current state
  const targetNode: AgentNodeData = node ?? {
    id: nodeId ?? "unknown-agent",
    name: "Agent Details",
    role: "subagent",
    status: "unfunded",
    allocatedMinor: 0,
    spentMinor: 0,
    reservedMinor: 0,
    position: [0, 0, 0],
    isFunded: false,
  };

  const availableMinor = calculateAvailableMinor(
    targetNode.allocatedMinor,
    targetNode.spentMinor,
    targetNode.reservedMinor
  );

  const spentPercent =
    targetNode.allocatedMinor > 0
      ? Math.min(100, Math.round((targetNode.spentMinor / targetNode.allocatedMinor) * 100))
      : 0;

  const reservedPercent =
    targetNode.allocatedMinor > 0
      ? Math.min(100 - spentPercent, Math.round((targetNode.reservedMinor / targetNode.allocatedMinor) * 100))
      : 0;

  const availablePercent = Math.max(0, 100 - spentPercent - reservedPercent);

  const handleDirectChat = () => {
    workspaceStore.setSelectedAgentId(targetNode.id);
    onDirectChat?.(targetNode.id);
    onClose();
  };

  const handleRevokeConfirm = () => {
    onRevoke?.(targetNode.id);
    setShowRevokeConfirm(false);
    onClose();
  };

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-md bg-card border-l border-border">
        {/* Header */}
        <SheetHeader className="pb-3 border-b border-border">
          <div className="flex items-center gap-2">
            {targetNode.isFunded ? (
              <Badge variant="authorized" showDot>
                <ShieldCheck className="h-3 w-3 mr-1" />
                Active Authority
              </Badge>
            ) : (
              <Badge variant="unfunded">
                <Link2 className="h-3 w-3 mr-1" />
                Unfunded Attachment
              </Badge>
            )}
            <span className="font-mono text-[11px] text-muted-foreground">{targetNode.id}</span>
          </div>

          <SheetTitle className="text-lg font-bold text-foreground mt-1.5 flex items-center justify-between">
            <span>{targetNode.name}</span>
          </SheetTitle>

          <SheetDescription className="text-xs text-muted-foreground">
            Role: <strong className="text-foreground">{targetNode.role}</strong> · Mandate:{" "}
            <span className="font-mono text-muted-foreground">man-{targetNode.id}</span>
          </SheetDescription>
        </SheetHeader>

        {/* Tab Selection */}
        <div className="flex items-center gap-1 border-b border-border pt-2 pb-1 text-xs">
          <button
            type="button"
            onClick={() => setActiveTab("overview")}
            className={`px-3 py-1.5 font-medium rounded transition-colors ${
              activeTab === "overview"
                ? "bg-secondary text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Overview
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("authority")}
            className={`px-3 py-1.5 font-medium rounded transition-colors ${
              activeTab === "authority"
                ? "bg-secondary text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Authority & Budget
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("activity")}
            className={`px-3 py-1.5 font-medium rounded transition-colors ${
              activeTab === "activity"
                ? "bg-secondary text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Recent Activity
          </button>
        </div>

        {/* Tab Body */}
        <div className="flex-1 overflow-y-auto py-4 space-y-4 text-xs">
          {activeTab === "overview" && (
            <div className="space-y-4">
              {/* Quick Status Card */}
              <div className="rounded-lg border border-border bg-secondary p-3.5 space-y-2.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Status</span>
                  <span className="font-medium text-foreground capitalize">{targetNode.status}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Source</span>
                  <span className="font-medium text-foreground">Platform Core Agent</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Max Delegation Depth</span>
                  <span className="font-mono text-foreground">Level 2</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Allowed Rails</span>
                  <span className="font-medium text-success">PayPal, Simulation</span>
                </div>
              </div>

              {/* Purpose / Mandate scope */}
              <div className="rounded-lg border border-border bg-secondary p-3.5">
                <span className="text-[10px] uppercase font-mono text-muted-foreground block mb-1">
                  Mandate Scope & Instructions
                </span>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Autonomous task executor authorized to initiate vendor reservations and payments within prescribed minor-unit limits. Single payments exceeding $500.00 require human signature.
                </p>
              </div>
            </div>
          )}

          {activeTab === "authority" && (
            <div className="space-y-4">
              {/* Segmented Budget Strip */}
              <div className="rounded-lg border border-border bg-secondary p-3.5 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-foreground">Budget Allocation</span>
                  <span className="font-mono font-semibold text-sm text-success tabular-nums">
                    {targetNode.isFunded
                      ? formatMinorUnits(targetNode.allocatedMinor, currency)
                      : `${formatMinorUnits(0, currency)} (Unfunded)`}
                  </span>
                </div>

                {/* Progress bar */}
                {targetNode.isFunded && (
                  <div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-muted flex">
                      <div
                        style={{ width: `${spentPercent}%` }}
                        className="bg-muted-foreground transition-all"
                        title={`Spent: ${spentPercent}%`}
                      />
                      <div
                        style={{ width: `${reservedPercent}%` }}
                        className="bg-warning transition-all"
                        title={`Reserved: ${reservedPercent}%`}
                      />
                      <div
                        style={{ width: `${availablePercent}%` }}
                        className="bg-success transition-all"
                        title={`Available: ${availablePercent}%`}
                      />
                    </div>

                    <div className="mt-2.5 grid grid-cols-3 gap-2 text-center text-[10px] font-mono">
                      <div>
                        <span className="text-muted-foreground block">Spent</span>
                        <span className="text-foreground font-medium tabular-nums">
                          {formatMinorUnits(targetNode.spentMinor, currency)}
                        </span>
                      </div>
                      <div>
                        <span className="text-warning block">Reserved</span>
                        <span className="text-foreground font-medium tabular-nums">
                          {formatMinorUnits(targetNode.reservedMinor, currency)}
                        </span>
                      </div>
                      <div>
                        <span className="text-success block">Available</span>
                        <span className="text-foreground font-medium tabular-nums">
                          {formatMinorUnits(availableMinor, currency)}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Guardrails table */}
              <div className="rounded-lg border border-border bg-secondary p-3.5 space-y-2">
                <span className="text-[10px] uppercase font-mono text-muted-foreground block">
                  Enforced Guardrails
                </span>
                <div className="flex items-center justify-between text-xs py-1 border-b border-border">
                  <span className="text-muted-foreground">Autonomous Threshold</span>
                  <span className="font-mono text-foreground">$500.00</span>
                </div>
                <div className="flex items-center justify-between text-xs py-1 border-b border-border">
                  <span className="text-muted-foreground">Sub-Delegation Permitted</span>
                  <span className="font-medium text-success">Yes (Depth ≤ 2)</span>
                </div>
                <div className="flex items-center justify-between text-xs py-1">
                  <span className="text-muted-foreground">Strict Minor-Unit Math</span>
                  <span className="font-mono text-success">100% Exact Integer</span>
                </div>
              </div>
            </div>
          )}

          {activeTab === "activity" && (
            <div className="space-y-2">
              <div className="rounded-lg border border-border bg-secondary p-3">
                <div className="flex items-center justify-between text-[11px] text-muted-foreground mb-1 font-mono">
                  <span>14:02:18 UTC</span>
                  <span className="text-success">Success</span>
                </div>
                <div className="text-xs font-medium text-foreground">
                  Reserved $1,000.00 at Grand Hyatt Goa
                </div>
                <div className="text-[10px] text-muted-foreground font-mono mt-0.5">
                  Txn ID: txn_pp_982194820 · Rail: PayPal
                </div>
              </div>

              <div className="rounded-lg border border-border bg-secondary p-3">
                <div className="flex items-center justify-between text-[11px] text-muted-foreground mb-1 font-mono">
                  <span>12:45:00 UTC</span>
                  <span className="text-success">Success</span>
                </div>
                <div className="text-xs font-medium text-foreground">
                  Completed payment $245.00 for IndiGo Flight 6E-204
                </div>
                <div className="text-[10px] text-muted-foreground font-mono mt-0.5">
                  Txn ID: txn_pp_109283102 · Rail: PayPal
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Revoke Confirmation Warning Banner */}
        {showRevokeConfirm && (
          <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 mb-3 text-xs">
            <div className="flex items-center gap-1.5 text-destructive font-semibold">
              <AlertTriangle className="h-4 w-4" />
              Confirm Subtree Authority Revocation
            </div>
            <p className="mt-1 text-[11px] text-foreground leading-relaxed">
              Revoking authority will immediately desaturate this agent and all attached child subagents. All unspent allocated funds ({formatMinorUnits(availableMinor, currency)}) will be returned to parent.
            </p>
            <div className="mt-2.5 flex items-center justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowRevokeConfirm(false)}
                className="h-7 px-2.5 text-xs"
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleRevokeConfirm}
                className="h-7 px-3 text-xs bg-destructive text-foreground hover:bg-destructive/90"
              >
                Confirm Revoke
              </Button>
            </div>
          </div>
        )}

        {/* Footer Actions */}
        <SheetFooter className="gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleDirectChat}
            className="flex-1 h-9 text-xs flex items-center justify-center gap-1.5"
          >
            <MessageSquare className="h-3.5 w-3.5 text-success" />
            Direct Chat
          </Button>

          {targetNode.isFunded ? (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setShowRevokeConfirm(true)}
              className="h-9 px-3 text-xs"
            >
              <Trash2 className="h-3.5 w-3.5 mr-1" />
              Revoke
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onDetach?.(targetNode.id)}
              className="h-9 px-3 text-xs text-muted-foreground hover:text-destructive"
            >
              Detach
            </Button>
          )}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
