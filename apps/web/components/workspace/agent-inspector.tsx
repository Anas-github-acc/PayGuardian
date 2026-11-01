"use client";

import * as React from "react";
import {
  ShieldCheck,
  Wallet,
  Clock,
  AlertTriangle,
  RotateCcw,
  Ban,
  ExternalLink,
  ChevronRight,
  Info,
} from "lucide-react";
import { formatMinorUnits, calculateAvailableMinor } from "../../app/lib/currency";
import { useWorkspaceStore, workspaceStore } from "../../app/lib/workspace-store";
import { Button } from "../ui/button";

export interface AgentInspectorProps {
  className?: string;
  selectedNodeId?: string | null;
  onRevoke?: (nodeId: string) => void;
  onViewTrace?: (traceId?: string) => void;
}

export function AgentInspector({
  className = "",
  selectedNodeId,
  onRevoke,
  onViewTrace,
}: AgentInspectorProps) {
  const store = useWorkspaceStore();
  const env = store.currentEnvironment;
  const currency = env?.currency ?? "USD";

  const activeId = selectedNodeId ?? store.selectedNodeId ?? "orchestrator-root";
  const [showConfirmRevoke, setShowConfirmRevoke] = React.useState(false);

  // Find node data
  const node = store.graphNodes.find((n) => n.id === activeId);

  const nodeName =
    node?.name ??
    (activeId === "orchestrator-root"
      ? "Main Orchestrator"
      : activeId === "agent-travel"
      ? "Travel Agent"
      : activeId === "agent-hotel"
      ? "Hotel Agent"
      : activeId === "agent-flights-unfunded"
      ? "Flight Scraper"
      : activeId === "agent-booking-gw"
      ? "Booking Gateway"
      : "Selected Agent");

  const isRoot = activeId === "orchestrator-root" || node?.role === "orchestrator";
  const isUnfunded = node?.status === "unfunded" || activeId === "agent-flights-unfunded";

  const allocatedMinor =
    node?.allocatedMinor ??
    (isRoot ? env?.budgetLimitMinor ?? 1000000 : isUnfunded ? 0 : 400000);
  const spentMinor = node?.spentMinor ?? (isRoot ? env?.spentMinor ?? 245000 : 0);
  const reservedMinor = node?.reservedMinor ?? (isRoot ? env?.reservedMinor ?? 150000 : 0);
  const availableMinor = calculateAvailableMinor(allocatedMinor, spentMinor, reservedMinor);

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
          <h2 className="text-base font-semibold tracking-tight text-white">
            Agent inspector
          </h2>
          <p className="mt-0.5 text-xs text-zinc-400">
            Inspecting: <span className="font-medium text-zinc-300">{nodeName}</span>
          </p>
        </div>
        <div className="flex items-center gap-1.5 font-mono text-[11px]">
          {isUnfunded ? (
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

      {/* Inspector Accordion / Sections matching the exact screenshot */}
      <div className="mt-4 flex-1 space-y-3">
        {/* 1. Permissions */}
        <div className="rounded-lg border border-zinc-800/80 bg-zinc-900/40 p-3.5 transition-colors hover:border-zinc-700">
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="h-4 w-4 text-zinc-400" />
            <h3 className="text-xs font-semibold text-zinc-200">Permissions</h3>
          </div>
          <div className="mt-2.5 space-y-1.5 text-xs text-zinc-400 pl-6.5">
            <div className="flex items-center justify-between">
              <span>Payment rail:</span>
              <span className="font-mono text-zinc-300">PayPal Sandbox</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Delegation depth:</span>
              <span className="font-mono text-zinc-300">Max depth ≤ 2</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Cryptographic sign-off:</span>
              <span className="text-blue-400">Mandate verified</span>
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
            <div className="flex items-center justify-between">
              <span>Autonomous threshold:</span>
              <span className="font-medium text-zinc-300 tabular-nums">
                $500.00 / txn
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
              <span className="font-mono text-zinc-300">Dec 31, 2026</span>
            </div>
            <div className="flex items-center justify-between pt-1">
              <span>Kill-switch status:</span>
              <span className="text-zinc-300">Armed & ready</span>
            </div>

            {/* Red Revocation Action */}
            <div className="pt-2">
              {showConfirmRevoke ? (
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
