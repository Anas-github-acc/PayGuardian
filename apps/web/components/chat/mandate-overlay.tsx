"use client";

import * as React from "react";
import { X, Shield, RefreshCw } from "lucide-react";
import { useWorkspaceStore } from "../../app/lib/workspace-store";
import { formatMinorUnits } from "../../app/lib/currency";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001";

interface MandateItem {
  id: string;
  holderAgentId: string;
  parentMandateId: string | null;
  budgetLimitMinor: number;
  allocatedMinor: number;
  spentMinor: number;
  reservedMinor: number;
  currency: string;
  state: string;
  permittedActions: string[];
  maxDelegationDepth: number;
  createdAt: string;
}

export function MandateOverlay({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const store = useWorkspaceStore();
  const currentEnv = store.currentEnvironment;
  const currentEnvId = currentEnv?.id;

  const [mandates, setMandates] = React.useState<MandateItem[]>([]);
  const [loading, setLoading] = React.useState(false);

  const fetchMandates = React.useCallback(async () => {
    if (!currentEnvId) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/v1/environments/${currentEnvId}/mandates`, {
        headers: { "x-local-user-id": "local-user" },
      });
      if (res.ok) {
        const data = await res.json();
        setMandates(data.mandates || []);
      }
    } catch (err) {
      console.warn("Could not load mandates:", err);
    } finally {
      setLoading(false);
    }
  }, [currentEnvId]);

  React.useEffect(() => {
    if (open) {
      fetchMandates();
    }
  }, [open, fetchMandates]);

  if (!open) return null;

  const rootMandate = mandates.find((m) => !m.parentMandateId) ?? mandates[0];
  const childMandates = mandates.filter((m) => m.id !== rootMandate?.id);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-150">
      <div
        className="relative flex w-full max-w-2xl flex-col rounded-xl border border-zinc-800 bg-zinc-950 text-zinc-200 shadow-2xl overflow-hidden max-h-[85vh]"
        role="dialog"
        aria-modal="true"
      >
        {/* Top Header */}
        <div className="flex h-14 shrink-0 items-center justify-between border-b border-zinc-900 px-5">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-zinc-300" />
            <h3 className="text-sm font-semibold text-white">Environment Mandates</h3>
            <span className="text-xs text-zinc-500 font-mono">
              ({currentEnv?.currency ?? "INR"})
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={fetchMandates}
              disabled={loading}
              title="Refresh mandates"
              className="p-1 text-zinc-400 hover:text-white transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            </button>
            <button
              type="button"
              onClick={onClose}
              title="Close overlay"
              className="p-1 text-zinc-400 hover:text-white transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {loading && mandates.length === 0 ? (
            <div className="py-12 text-center text-xs text-zinc-500 font-mono">
              Loading mandate details…
            </div>
          ) : rootMandate ? (
            <>
              {/* Root Mandate Summary */}
              <div className="space-y-3">
                <div className="text-xs font-medium uppercase tracking-wider text-zinc-400">
                  Root Mandate
                </div>
                <div className="rounded-lg border border-zinc-850 bg-zinc-900/40 p-4 space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-zinc-400">Mandate ID</span>
                    <span className="font-mono text-zinc-300 text-[11px] truncate max-w-[320px]">
                      {rootMandate.id}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs">
                    <span className="text-zinc-400">Total Authority Limit</span>
                    <span className="font-semibold text-white">
                      {formatMinorUnits(rootMandate.budgetLimitMinor, rootMandate.currency)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs">
                    <span className="text-zinc-400">Spent / Captured</span>
                    <span className="font-mono text-zinc-300">
                      {formatMinorUnits(rootMandate.spentMinor, rootMandate.currency)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs">
                    <span className="text-zinc-400">Reserved for Subagents</span>
                    <span className="font-mono text-zinc-300">
                      {formatMinorUnits(rootMandate.reservedMinor, rootMandate.currency)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs">
                    <span className="text-zinc-400">Status</span>
                    <span className="text-[11px] font-mono uppercase text-zinc-300">
                      {rootMandate.state}
                    </span>
                  </div>
                </div>
              </div>

              {/* Specialist Subagent Child Mandates */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-medium uppercase tracking-wider text-zinc-400">
                    Child Delegations ({childMandates.length})
                  </div>
                </div>

                {childMandates.length === 0 ? (
                  <div className="rounded-lg border border-zinc-900 bg-zinc-900/20 p-4 text-center text-xs text-zinc-500">
                    No active child mandates. All funds remain in the orchestrator reserve.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {childMandates.map((m) => (
                      <div
                        key={m.id}
                        className="flex items-center justify-between rounded-lg border border-zinc-850 bg-zinc-900/30 p-3 text-xs"
                      >
                        <div>
                          <div className="font-medium text-white capitalize">
                            {m.holderAgentId.replace("agent-", "")}
                          </div>
                          <div className="text-[11px] font-mono text-zinc-500">
                            Limit: {formatMinorUnits(m.budgetLimitMinor, m.currency)} · Spent:{" "}
                            {formatMinorUnits(m.spentMinor, m.currency)}
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] font-mono uppercase text-zinc-400">
                            {m.state}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="py-10 text-center text-xs text-zinc-500">
              No mandate found for this environment.
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end border-t border-zinc-900 px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-4 py-1.5 text-xs font-medium text-zinc-300 hover:bg-zinc-900 hover:text-white transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
