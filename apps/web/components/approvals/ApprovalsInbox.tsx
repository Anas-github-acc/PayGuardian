"use client";

import * as React from "react";
import { Inbox, RefreshCw, CheckCircle2, Search } from "lucide-react";
import { useWorkspaceStore, workspaceStore } from "../../app/lib/workspace-store";
import { useDashboardNavigation } from "../../app/lib/navigation";
import { ApprovalCard } from "./ApprovalCard";
import { ApprovalDetailDrawer } from "./ApprovalDetailDrawer";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Badge } from "../ui/badge";
import { DEFAULT_APPROVALS, type ApprovalFilter, type ApprovalItem } from "./types";

export interface ApprovalsInboxProps {
  environmentId?: string;
  onViewTrace?: (traceId: string) => void;
  onAmendLimit?: (mandateId: string) => void;
  className?: string;
}

export function ApprovalsInbox({
  environmentId,
  onViewTrace,
  onAmendLimit,
  className = "",
}: ApprovalsInboxProps) {
  const store = useWorkspaceStore();
  const { navigateTab } = useDashboardNavigation();
  const activeEnvId = environmentId ?? store.currentEnvironmentId ?? "env-sandbox-travel-01";

  const [approvals, setApprovals] = React.useState<ApprovalItem[]>(DEFAULT_APPROVALS);
  const [filter, setFilter] = React.useState<ApprovalFilter>("pending");
  const [searchQuery, setSearchQuery] = React.useState<string>("");
  const [selectedApproval, setSelectedApproval] = React.useState<ApprovalItem | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = React.useState<boolean>(false);
  const [processingId, setProcessingId] = React.useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = React.useState<boolean>(false);

  // Fetch approvals from API if available, or fall back to resilient store
  const fetchApprovals = React.useCallback(async () => {
    setIsRefreshing(true);
    try {
      const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001";
      const res = await fetch(`${apiBaseUrl}/v1/environments/${activeEnvId}/approvals`, {
        headers: { "x-local-user-id": "local-user" },
      });
      if (res.ok) {
        const data = (await res.json()) as { approvals: Array<Record<string, unknown>> };
        if (data.approvals && data.approvals.length > 0) {
          // Map backend items to rich frontend model, merging with defaults
          const mapped: ApprovalItem[] = data.approvals.map((raw) => {
            const existing = DEFAULT_APPROVALS.find((d) => d.id === raw.id);
            const amountMinor = typeof raw.amountMinor === "number" ? raw.amountMinor : 0;
            const currency = typeof raw.currency === "string" ? raw.currency : "USD";
            const status = (raw.status as ApprovalItem["status"]) || "pending";
            return {
              id: String(raw.id),
              environmentId: String(raw.environmentId || activeEnvId),
              mandateId: String(raw.mandateId || "man-default"),
              agentId: String(raw.agentId || "agent-default"),
              agentName: existing?.agentName || String(raw.agentId || "Subagent"),
              agentRole: existing?.agentRole || "subagent",
              action: String(raw.action || "action.execute"),
              purpose: existing?.purpose || `Payment authorization for ${raw.action}`,
              recipient: existing?.recipient || "Authorized Merchant",
              merchantCategory: existing?.merchantCategory || "General Commercial",
              amountMinor,
              currency,
              requestHash: String(raw.requestHash || "0x0000000000000000"),
              status,
              reasonForSignOff:
                existing?.reasonForSignOff ||
                "Amount exceeds single-action autonomous limit",
              remainingBudgetAfterPaymentMinor:
                existing?.remainingBudgetAfterPaymentMinor ?? 200000,
              parentMandateLimitMinor: existing?.parentMandateLimitMinor ?? 400000,
              isHardLimitExceeded: existing?.isHardLimitExceeded ?? false,
              expiresAt: existing?.expiresAt || new Date(Date.now() + 3600000).toISOString(),
              createdAt: String(raw.createdAt || new Date().toISOString()),
              approvedBy: (raw.approvedBy as string) || null,
              approvedAt: (raw.approvedAt as string) || null,
              rejectionReason: (raw.rejectionReason as string) || null,
              ancestorChain: existing?.ancestorChain || [
                { id: "user-root", name: "You (Operator)", role: "Root Authority" },
                { id: "orchestrator-root", name: "Main Orchestrator", role: "Overseer" },
              ],
              agentSays: existing?.agentSays,
              parameters: existing?.parameters,
            };
          });

          // Prepend any mock items not in backend to preserve rich demo state
          const missing = DEFAULT_APPROVALS.filter((d) => !mapped.some((m) => m.id === d.id));
          setApprovals([...mapped, ...missing]);
        }
      }
    } catch {
      // Fallback kept
    } finally {
      setIsRefreshing(false);
    }
  }, [activeEnvId]);

  React.useEffect(() => {
    void fetchApprovals();
  }, [fetchApprovals]);

  // Handle Approve action
  const handleApprove = async (id: string) => {
    setProcessingId(id);
    try {
      const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001";
      await fetch(`${apiBaseUrl}/v1/environments/${activeEnvId}/approvals/${id}/approve`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-local-user-id": "local-user",
        },
      }).catch(() => null);

      // Optimistic update in state
      setApprovals((prev) =>
        prev.map((appr) =>
          appr.id === id
            ? {
                ...appr,
                status: "approved",
                approvedBy: store.user?.email || "Operator",
                approvedAt: new Date().toISOString(),
              }
            : appr
        )
      );

      // Decrement pending count in currentEnvironment in store
      if (store.currentEnvironment) {
        const nextPending = Math.max(0, store.currentEnvironment.pendingApprovalsCount - 1);
        workspaceStore.updateEnvironment(store.currentEnvironment.id, {
          pendingApprovalsCount: nextPending,
        });
      }
    } finally {
      setProcessingId(null);
    }
  };

  // Handle Reject action
  const handleReject = async (id: string, reason?: string) => {
    setProcessingId(id);
    try {
      const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001";
      await fetch(`${apiBaseUrl}/v1/environments/${activeEnvId}/approvals/${id}/reject`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-local-user-id": "local-user",
        },
        body: JSON.stringify({ reason: reason || "Declined by operator" }),
      }).catch(() => null);

      // Optimistic update in state
      setApprovals((prev) =>
        prev.map((appr) =>
          appr.id === id
            ? {
                ...appr,
                status: "rejected",
                rejectionReason: reason || "Declined by operator",
              }
            : appr
        )
      );

      // Decrement pending count in currentEnvironment in store
      if (store.currentEnvironment) {
        const nextPending = Math.max(0, store.currentEnvironment.pendingApprovalsCount - 1);
        workspaceStore.updateEnvironment(store.currentEnvironment.id, {
          pendingApprovalsCount: nextPending,
        });
      }
    } finally {
      setProcessingId(null);
    }
  };

  const handleOpenDetails = (approval: ApprovalItem) => {
    setSelectedApproval(approval);
    setIsDrawerOpen(true);
  };

  const handleViewTrace = (traceId: string) => {
    workspaceStore.setSelectedTraceId(traceId);
    if (onViewTrace) {
      onViewTrace(traceId);
    } else {
      // Switch to traces tab if no direct modal handler
      navigateTab("traces");
    }
  };

  // Counts
  const pendingCount = approvals.filter((a) => a.status === "pending").length;
  const approvedCount = approvals.filter((a) => a.status === "approved").length;
  const rejectedCount = approvals.filter((a) => a.status === "rejected").length;

  // Average operator response time across decided requests (fallback: fixture)
  const avgResponseLabel = React.useMemo(() => {
    const decided = approvals.filter(
      (a) => a.status === "approved" && a.approvedAt && !Number.isNaN(new Date(a.createdAt).getTime())
    );
    if (decided.length === 0) return "1m 48s";
    const totalMs = decided.reduce((sum, a) => {
      const created = new Date(a.createdAt).getTime();
      const decidedAt = new Date(a.approvedAt!).getTime();
      return sum + Math.max(0, decidedAt - created);
    }, 0);
    const avgSecs = Math.round(totalMs / decided.length / 1000);
    return avgSecs >= 60 ? `${Math.floor(avgSecs / 60)}m ${avgSecs % 60}s` : `${avgSecs}s`;
  }, [approvals]);

  // Filtered & Searched items
  const filteredApprovals = React.useMemo(() => {
    return approvals.filter((appr) => {
      // Status filter
      if (filter !== "all" && appr.status !== filter) return false;

      // Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = appr.agentName.toLowerCase().includes(q);
        const matchesRecipient = appr.recipient.toLowerCase().includes(q);
        const matchesPurpose = appr.purpose.toLowerCase().includes(q);
        const matchesAction = appr.action.toLowerCase().includes(q);
        const matchesHash = appr.requestHash.toLowerCase().includes(q);
        return matchesName || matchesRecipient || matchesPurpose || matchesAction || matchesHash;
      }
      return true;
    });
  }, [approvals, filter, searchQuery]);

  return (
    <div className={`flex-1 overflow-y-auto bg-black text-white ${className}`}>
      <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 space-y-6">
        {/* Page header */}
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-semibold tracking-tight text-white">
              Approvals
            </h1>
            <span className="text-zinc-600 font-normal">/</span>
            <span className="text-lg font-semibold tracking-tight text-zinc-300">
              Human Sign-off Queue
            </span>
            {pendingCount > 0 && (
              <span className="ml-2 rounded-md border border-amber-900/60 bg-amber-950/40 px-2 py-0.5 text-xs font-mono text-amber-400">
                {pendingCount} pending
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => void fetchApprovals()}
              disabled={isRefreshing}
              aria-label="Refresh approvals"
              className="h-8 border-zinc-800 bg-zinc-900/80 text-xs text-zinc-300 hover:bg-zinc-800 hover:text-white"
            >
              <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        </header>

        {/* Summary stat card */}
        <section
          aria-label="Approvals summary"
          className="rounded-xl border border-zinc-800 bg-zinc-950 overflow-hidden shadow-sm"
        >
          {/* Header row: icon tile + title */}
          <div className="flex items-center justify-between gap-3 border-b border-zinc-800/80 bg-zinc-950 px-5 py-3.5">
            <div className="flex min-w-0 items-center gap-2.5">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-amber-900/50 bg-amber-950/40 text-amber-400">
                <Inbox className="h-3.5 w-3.5" />
              </span>
              <h3 className="truncate text-sm font-semibold tracking-tight text-white">
                Queue overview
              </h3>
            </div>
            <span className="text-xs font-mono text-zinc-500">
              Environment: {activeEnvId}
            </span>
          </div>

          <div className="p-5">
            {/* Big value + suffix */}
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-semibold tabular-nums text-white font-mono">
                {pendingCount}
              </span>
              <span className="text-xs text-zinc-400">awaiting your cryptographic sign-off</span>
            </div>

            {/* Delta chip + context */}
            <div className="mt-2.5 flex flex-wrap items-center gap-2">
              <span
                className={`rounded-md border px-2 py-0.5 text-[11px] font-mono ${
                  pendingCount > 0
                    ? "border-amber-900/60 bg-amber-950/40 text-amber-400"
                    : "border-blue-900/60 bg-blue-950/40 text-blue-400"
                }`}
              >
                {pendingCount > 0 ? "needs attention" : "all clear"}
              </span>
              <span className="text-xs text-zinc-500">
                across {approvals.length} request{approvals.length === 1 ? "" : "s"} in this environment
              </span>
            </div>

            {/* Key/value rows */}
            <dl className="mt-4 overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900/40 divide-y divide-zinc-800/60">
              <div className="flex items-center justify-between px-3.5 py-2.5 text-xs">
                <dt className="text-zinc-400">Awaiting sign-off</dt>
                <dd
                  className={`font-mono font-medium tabular-nums ${
                    pendingCount > 0 ? "text-amber-400" : "text-white"
                  }`}
                >
                  {pendingCount}
                </dd>
              </div>
              <div className="flex items-center justify-between px-3.5 py-2.5 text-xs">
                <dt className="text-zinc-400">Approved today</dt>
                <dd className="font-mono font-medium tabular-nums text-blue-400">{approvedCount}</dd>
              </div>
              <div className="flex items-center justify-between px-3.5 py-2.5 text-xs">
                <dt className="text-zinc-400">Denied today</dt>
                <dd className="font-mono font-medium tabular-nums text-red-400">{rejectedCount}</dd>
              </div>
              <div className="flex items-center justify-between px-3.5 py-2.5 text-xs">
                <dt className="text-zinc-400">Avg response time</dt>
                <dd className="font-mono font-medium tabular-nums text-zinc-300">{avgResponseLabel}</dd>
              </div>
            </dl>
          </div>
        </section>

        {/* Filter Tabs & Quick Search */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* Filter Pills */}
          <div className="flex w-max items-center gap-1 rounded-lg border border-zinc-800 bg-zinc-900/80 p-1 text-xs select-none">
            <button
              type="button"
              onClick={() => setFilter("pending")}
              className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-medium transition-all ${
                filter === "pending"
                  ? "bg-zinc-800 text-white border border-zinc-700 shadow-sm"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              <span>Pending</span>
              {pendingCount > 0 && (
                <span className="rounded-full bg-amber-950 px-1.5 py-[0.05rem] font-mono text-[10px] text-amber-400 border border-amber-900/50">
                  {pendingCount}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setFilter("approved")}
              className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-medium transition-all ${
                filter === "approved"
                  ? "bg-zinc-800 text-white border border-zinc-700 shadow-sm"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              <span>Approved</span>
              <span className="font-mono text-[10px] text-zinc-500">({approvedCount})</span>
            </button>

            <button
              type="button"
              onClick={() => setFilter("rejected")}
              className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-medium transition-all ${
                filter === "rejected"
                  ? "bg-zinc-800 text-white border border-zinc-700 shadow-sm"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              <span>Rejected</span>
              <span className="font-mono text-[10px] text-zinc-500">({rejectedCount})</span>
            </button>

            <button
              type="button"
              onClick={() => setFilter("all")}
              className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-medium transition-all ${
                filter === "all"
                  ? "bg-zinc-800 text-white border border-zinc-700 shadow-sm"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              <span>All</span>
              <span className="font-mono text-[10px] text-zinc-500">({approvals.length})</span>
            </button>
          </div>

          {/* Quick Search */}
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-zinc-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search approvals..."
              className="h-8 w-full rounded-lg border border-zinc-800 bg-zinc-900/80 pl-8 pr-2.5 text-xs text-zinc-200 placeholder:text-zinc-500 focus:border-zinc-700 focus:outline-none"
            />
          </div>
        </div>

        {/* Process-status rows */}
        {filteredApprovals.length === 0 ? (
          <div className="rounded-xl border border-zinc-800 border-dashed bg-zinc-950 p-8 text-center">
            <CheckCircle2 className="mx-auto h-8 w-8 text-blue-400/60 mb-2" />
            <h3 className="text-sm font-semibold text-white">No approvals found</h3>
            <p className="mt-1 text-xs text-zinc-400">
              {filter === "pending"
                ? "All clear. There are no pending requests waiting for your cryptographic sign-off."
                : "No approval items matched your current filter or search criteria."}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredApprovals.map((approval) => (
              <ApprovalCard
                key={approval.id}
                approval={approval}
                onApprove={handleApprove}
                onReject={handleReject}
                onViewTrace={handleViewTrace}
                onOpenDetails={handleOpenDetails}
                onAmendLimit={onAmendLimit}
                isProcessing={processingId === approval.id}
              />
            ))}
          </div>
        )}
      </div>

      {/* Detail Drawer */}
      <ApprovalDetailDrawer
        approval={selectedApproval}
        isOpen={isDrawerOpen}
        onClose={() => {
          setIsDrawerOpen(false);
          setSelectedApproval(null);
        }}
        onApprove={handleApprove}
        onReject={handleReject}
        onViewTrace={handleViewTrace}
        isProcessing={processingId === selectedApproval?.id}
      />
    </div>
  );
}
