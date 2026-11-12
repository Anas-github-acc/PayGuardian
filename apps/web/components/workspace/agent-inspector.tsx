"use client";

import * as React from "react";
import { ShieldCheck, Wallet, Clock, Tag } from "lucide-react";
import { formatMinorUnits, calculateAvailableMinor } from "../../app/lib/currency";
import { useWorkspaceStore } from "../../app/lib/workspace-store";
import type { AgentNodeData } from "../../app/lib/workspace-store";
import type { AgentDto, MandateDto, LedgerAccountDto } from "@payguardian/contracts";

export interface AgentInspectorProps {
  className?: string;
  selectedNodeId?: string | null;
  onRevoke?: (nodeId: string) => void;
  onViewTrace?: (traceId?: string) => void;
  nodes?: AgentNodeData[];
  agents?: AgentDto[];
  mandates?: MandateDto[];
  ledgerAccounts?: LedgerAccountDto[];
  currency?: string;
}

export function AgentInspector({
  className = "",
  selectedNodeId,
  onRevoke,
  onViewTrace: _onViewTrace,
  nodes: propNodes,
  agents,
  mandates,
  ledgerAccounts,
  currency: propCurrency,
}: AgentInspectorProps) {
  const store = useWorkspaceStore();
  const env = store.currentEnvironment;
  const effectiveNodes = propNodes ?? store.graphNodes;

  const activeId = selectedNodeId ?? store.selectedNodeId ?? "orchestrator-root";
  const [showConfirmRevoke, setShowConfirmRevoke] = React.useState(false);

  // Find node data
  const node = effectiveNodes.find((n) => n.id === activeId);
  const agent = agents?.find((a) => a.id === activeId);

  // Prefer active mandate first, then highest version
  const mandate = React.useMemo(() => {
    if (!mandates) return undefined;
    const agentMandates = mandates.filter((m) => m.holderAgentId === activeId);
    if (agentMandates.length === 0) return undefined;
    const sorted = [...agentMandates].sort((a, b) => {
      if (a.state === "active" && b.state !== "active") return -1;
      if (b.state === "active" && a.state !== "active") return 1;
      return (b.version ?? 0) - (a.version ?? 0);
    });
    return sorted[0];
  }, [mandates, activeId]);

  const account = React.useMemo(() => {
    if (!mandate || !ledgerAccounts) return undefined;
    return ledgerAccounts.find((a) => a.mandateId === mandate.id);
  }, [mandate, ledgerAccounts]);

  const currency = propCurrency ?? mandate?.currency ?? env?.currency ?? "USD";

  const nodeName =
    node?.name ?? agent?.name ?? (activeId ? `Agent (${activeId.slice(0, 8)})` : "Selected Agent");

  const isRoot = node?.role === "orchestrator" || activeId === "orchestrator-root";
  const isUnfunded = node?.status === "unfunded" || (node?.allocatedMinor === 0 && !node?.isFunded);

  const allocatedMinor =
    node?.allocatedMinor ??
    mandate?.budgetLimitMinor ??
    (isRoot ? (env?.budgetLimitMinor ?? 0) : 0);
  const spentMinor =
    account?.capturedMinor ??
    node?.spentMinor ??
    mandate?.spentMinor ??
    (isRoot ? (env?.spentMinor ?? 0) : 0);
  const reservedMinor =
    account?.reservedMinor ??
    node?.reservedMinor ??
    mandate?.reservedMinor ??
    (isRoot ? (env?.reservedMinor ?? 0) : 0);
  const subDelegatedMinor = node?.subDelegatedMinor ?? mandate?.allocatedMinor ?? 0;

  const availableMinor =
    node?.availableMinor !== undefined
      ? node.availableMinor
      : calculateAvailableMinor(allocatedMinor, spentMinor + subDelegatedMinor, reservedMinor);

  // Formatted Expiry Date
  const expiresAtStr = mandate?.expiresAt ?? env?.expiresAt;
  const formattedExpiry = React.useMemo(() => {
    if (!expiresAtStr) return "Dec 31, 2026";
    try {
      const d = new Date(expiresAtStr);
      return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    } catch {
      return "Dec 31, 2026";
    }
  }, [expiresAtStr]);

  // Capabilities / Permitted Actions
  const capabilitiesList = React.useMemo<string[]>(() => {
    const rawCaps = (agent as unknown as { capabilities?: string[] })?.capabilities;
    if (rawCaps && rawCaps.length > 0) {
      return rawCaps;
    }
    if (mandate?.permittedActions && mandate.permittedActions.length > 0) {
      return mandate.permittedActions;
    }
    return isRoot ? ["* (All actions)"] : ["General specialist actions"];
  }, [agent, mandate, isRoot]);

  const handleRevokeClick = () => {
    if (!showConfirmRevoke) {
      setShowConfirmRevoke(true);
      return;
    }
    onRevoke?.(activeId);
    setShowConfirmRevoke(false);
  };

  return (
    <section
      aria-label="Agent inspector"
      className={`flex flex-col rounded-xl border border-zinc-800 bg-zinc-950 p-5 shadow-sm sm:p-6 ${className}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-zinc-900 pb-3">
        <div>
          <h2 className="text-base font-semibold tracking-tight text-white">Agent inspector</h2>
          <p className="mt-0.5 text-xs text-zinc-400">
            Inspecting: <span className="font-medium text-zinc-300">{nodeName}</span>
          </p>
        </div>
        <div className="flex items-center gap-1.5 font-mono text-[11px]">
          {node?.status === "revoked" ? (
            <span className="rounded border border-red-900/60 bg-red-950/40 px-2 py-0.5 text-red-400">
              revoked
            </span>
          ) : isUnfunded ? (
            <span className="rounded border border-orange-900/60 bg-orange-950/40 px-2 py-0.5 text-orange-400">
              unfunded
            </span>
          ) : (
            <span className="rounded border border-blue-900/60 bg-blue-950/40 px-2 py-0.5 text-blue-400">
              active
            </span>
          )}
        </div>
      </div>

      {/* Inspector Sections */}
      <div className="mt-4 flex-1 space-y-3">
        {/* 1. Permissions & Capabilities */}
        <div className="rounded-lg border border-zinc-800/80 bg-zinc-900/40 p-3.5 transition-colors hover:border-zinc-700">
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="h-4 w-4 text-zinc-400" />
            <h3 className="text-xs font-semibold text-zinc-200">Permissions</h3>
          </div>
          <div className="mt-2.5 space-y-1.5 text-xs text-zinc-400 pl-6.5">
            <div className="flex items-center justify-between">
              <span>Payment rail:</span>
              <span className="font-mono text-zinc-300">
                {env?.allowedRails?.join(", ") || "PayPal Sandbox"}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span>Delegation depth:</span>
              <span className="font-mono text-zinc-300">
                {mandate
                  ? mandate.canDelegate
                    ? `Max depth ≤ ${mandate.maxDelegationDepth}`
                    : "Leaf agent (depth 0)"
                  : `Max depth ≤ ${env?.maxDelegationDepth ?? 2}`}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span>Cryptographic sign-off:</span>
              <span className="text-blue-400">
                {mandate
                  ? `Mandate v${mandate.version ?? 1} signed (${mandate.state})`
                  : "Verified Mandate"}
              </span>
            </div>
            <div className="pt-1.5 border-t border-zinc-800/60">
              <div className="flex items-center gap-1.5 mb-1.5 text-[11px] text-zinc-400">
                <Tag className="h-3 w-3 text-zinc-500" />
                <span>Capabilities & Actions:</span>
              </div>
              <div className="flex flex-wrap gap-1">
                {capabilitiesList.map((cap) => (
                  <span
                    key={cap}
                    className="inline-block rounded bg-zinc-800/80 px-2 py-0.5 text-[10px] font-mono text-zinc-300 border border-zinc-700/50"
                  >
                    {cap}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* 2. Budget limits */}
        <div className="rounded-lg border border-zinc-800/80 bg-zinc-900/40 p-3.5 transition-colors hover:border-zinc-700">
          <div className="flex items-center gap-2.5">
            <Wallet className="h-4 w-4 text-zinc-400" />
            <h3 className="text-xs font-semibold text-zinc-200">Budget limits</h3>
          </div>
          <div className="mt-2.5 space-y-1.5 text-xs text-zinc-400 pl-6.5">
            <div className="flex items-center justify-between">
              <span>Authority allocation:</span>
              <span className="font-medium text-white tabular-nums">
                {formatMinorUnits(allocatedMinor, currency)}
              </span>
            </div>
            {subDelegatedMinor > 0 && (
              <div className="flex items-center justify-between text-zinc-400">
                <span>Sub-delegated to children:</span>
                <span className="font-medium text-zinc-300 tabular-nums">
                  {formatMinorUnits(subDelegatedMinor, currency)}
                </span>
              </div>
            )}
            <div className="flex items-center justify-between">
              <span>Autonomous threshold:</span>
              <span className="font-medium text-zinc-300 tabular-nums">
                {formatMinorUnits(env?.approvalThresholdMinor ?? 50000, currency)} / txn
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span>Spent:</span>
              <span className="font-medium text-zinc-400 tabular-nums">
                {formatMinorUnits(spentMinor, currency)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span>Remaining available:</span>
              <span className="font-medium text-white tabular-nums">
                {formatMinorUnits(availableMinor, currency)}
              </span>
            </div>
          </div>
        </div>

        {/* 3. Expiry & revocation */}
        <div className="rounded-lg border border-zinc-800/80 bg-zinc-900/40 p-3.5 transition-colors hover:border-zinc-700">
          <div className="flex items-center gap-2.5">
            <Clock className="h-4 w-4 text-zinc-400" />
            <h3 className="text-xs font-semibold text-zinc-200">Expiry & revocation</h3>
          </div>
          <div className="mt-2.5 space-y-2 text-xs text-zinc-400 pl-6.5">
            <div className="flex items-center justify-between">
              <span>Valid through:</span>
              <span className="font-mono text-zinc-300">{formattedExpiry}</span>
            </div>
            <div className="flex items-center justify-between pt-1">
              <span>Kill-switch status:</span>
              <span className="text-zinc-300">
                {node?.status === "revoked" ? "Revoked" : "Armed & ready"}
              </span>
            </div>

            {/* Revocation Action */}
            <div className="pt-2">
              {isRoot ? (
                <div className="text-[11px] text-zinc-400 italic">
                  Root orchestrator cannot be revoked directly. Manage environment in Settings.
                </div>
              ) : node?.status === "revoked" ? (
                <div className="rounded-md border border-red-950 bg-red-950/20 px-3 py-1.5 text-xs text-red-400 font-medium">
                  Authority has been revoked
                </div>
              ) : showConfirmRevoke ? (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleRevokeClick}
                    className="flex-1 rounded-md border border-red-800 bg-red-950/60 px-3 py-1.5 text-xs font-medium text-red-300 hover:bg-red-900/70 transition-colors"
                  >
                    Confirm immediate revoke
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowConfirmRevoke(false)}
                    className="rounded-md border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-400 hover:text-white transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleRevokeClick}
                  className="w-full rounded-md border border-red-900/40 bg-zinc-900/80 px-3 py-1.5 text-left text-xs font-medium text-red-400 hover:border-red-800 hover:bg-red-950/30 transition-colors"
                >
                  Revoke agent authority
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
