"use client";

import * as React from "react";
import { Bookmark, MessageSquare } from "lucide-react";
import { useWorkspaceStore, workspaceStore } from "../../app/lib/workspace-store";
import { useDashboardNavigation } from "../../app/lib/navigation";
import { KpiStrip } from "./kpi-strip";
import { DelegationTopology } from "./delegation-topology";
import { AgentInspector } from "./agent-inspector";
import { RecentActivityPanel } from "./recent-activity-panel";
import { MemoryVaultContent } from "./sessions-memory";
import { NodeDetailDrawer } from "../canvas";
import { useWorkspaceGraph } from "../../lib/api/hooks/use-workspace-graph";
import { Button } from "../ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "../ui/sheet";

export interface WorkspaceLayoutProps {
  className?: string;
  onViewTrace?: (traceId?: string) => void;
  onOpenApprovals?: () => void;
}

export function WorkspaceLayout({
  className = "",
  onViewTrace,
  onOpenApprovals: _onOpenApprovals,
}: WorkspaceLayoutProps) {
  const store = useWorkspaceStore();
  const { navigateTab } = useDashboardNavigation();
  const env = store.currentEnvironment;

  const {
    nodes,
    edges,
    agents,
    mandates,
    ledgerAccounts,
    isLoading: isGraphLoading,
    error: graphError,
    refetch: refetchGraph,
    revokeAgent,
  } = useWorkspaceGraph(env?.id, { pollingIntervalMs: 8000 });

  const rootAgentNode = nodes.find((n) => n.role === "orchestrator") || nodes[0];
  const [selectedNodeId, setSelectedNodeId] = React.useState<string>("orchestrator-root");
  const effectiveSelectedNodeId =
    nodes.some((n) => n.id === selectedNodeId) ? selectedNodeId : rootAgentNode?.id ?? "orchestrator-root";

  const dynamicSpentMinor =
    ledgerAccounts.length > 0
      ? ledgerAccounts.reduce((sum, a) => sum + (a.capturedMinor || 0), 0)
      : mandates.reduce((sum, m) => sum + (m.spentMinor || 0), 0) || env?.spentMinor || 0;

  const dynamicReservedMinor =
    ledgerAccounts.length > 0
      ? ledgerAccounts.reduce((sum, a) => sum + (a.reservedMinor || 0), 0)
      : mandates.reduce((sum, m) => sum + (m.reservedMinor || 0), 0) || env?.reservedMinor || 0;

  const totalLimitMinor =
    env?.budgetLimitMinor ?? (mandates.find((m) => !m.parentMandateId)?.budgetLimitMinor ?? 0);
  const currency = env?.currency ?? "USD";
  const [isDrawerOpen, setIsDrawerOpen] = React.useState(false);
  const [isMemoryOpen, setIsMemoryOpen] = React.useState(false);

  // Sync live nodes and edges to workspaceStore when received from backend
  React.useEffect(() => {
    if (nodes.length > 0) {
      workspaceStore.setGraphData(nodes, edges);
    }
  }, [nodes, edges]);

  const handleSelectNode = (nodeId: string) => {
    setSelectedNodeId(nodeId);
    workspaceStore.setSelectedNodeId(nodeId);
  };

  const handleCloseDrawer = () => {
    setIsDrawerOpen(false);
  };

  // Strictly NO optimistic updates: UI updates ONLY upon confirmed server response
  const handleRevokeNode = async (nodeId: string) => {
    try {
      await revokeAgent(nodeId);

      // Yield verified block message to the Assistant stream upon confirmation
      const nowIso = new Date().toISOString();
      workspaceStore.addChatMessage({
        type: "agent_says",
        id: `ag-rev-${Date.now()}`,
        sender: "Security Policy Enforcement",
        timestamp: nowIso,
        text: `Authority for agent ${nodeId} has been revoked by operator. Remaining allocated funds reclaimed.`,
      });
    } catch (err) {
      console.error("Agent revocation failed:", err);
    }
  };

  const workspaceTitle = env?.name ?? "Conference Logistics";

  return (
    <div className={`flex-1 overflow-y-auto bg-black text-white ${className}`}>
      <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 space-y-6">
        {/* 1. Header Row matching screenshot */}
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-semibold tracking-tight text-white">
              Workspace
            </h1>
            <span className="text-zinc-600 font-normal">/</span>
            <span className="text-lg font-semibold tracking-tight text-zinc-300">
              Agent Delegation
            </span>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 rounded-md border border-zinc-800 bg-zinc-950 px-3 py-1.5 text-xs font-medium text-zinc-300">
              <span>{workspaceTitle}</span>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsMemoryOpen(true)}
              className="h-8 border-zinc-800 bg-zinc-900/80 text-xs text-zinc-300 hover:bg-zinc-800 hover:text-white"
            >
              <Bookmark className="mr-1.5 h-3.5 w-3.5 text-zinc-400" />
              Memory
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigateTab("assistant")}
              className="h-8 border-zinc-800 bg-zinc-900/80 text-xs text-zinc-300 hover:bg-zinc-800 hover:text-white"
            >
              <MessageSquare className="mr-1.5 h-3.5 w-3.5 text-zinc-400" />
              Assistant
            </Button>
          </div>
        </header>

        {/* 2. KPI Metrics Strip */}
        <KpiStrip
          totalLimitMinor={totalLimitMinor}
          spentMinor={dynamicSpentMinor}
          reservedMinor={dynamicReservedMinor}
          currency={currency}
          rootAgentCount={nodes.filter((n) => n.role === "orchestrator").length || 1}
        />

        {/* 3. Delegation Topology Container */}
        <DelegationTopology
          selectedNodeId={effectiveSelectedNodeId}
          onSelectNode={handleSelectNode}
          nodes={nodes}
          edges={edges}
          currency={currency}
          totalLimitMinor={totalLimitMinor}
          spentMinor={dynamicSpentMinor}
          reservedMinor={dynamicReservedMinor}
          isLoading={isGraphLoading}
          error={graphError}
          onRetry={refetchGraph}
        />

        {/* 4. Bottom 50/50 Split: Agent Inspector & Recent Activity */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Left: Agent Inspector */}
          <AgentInspector
            selectedNodeId={effectiveSelectedNodeId}
            onRevoke={handleRevokeNode}
            onViewTrace={onViewTrace}
            nodes={nodes}
            agents={agents}
            mandates={mandates}
            ledgerAccounts={ledgerAccounts}
            currency={currency}
          />

          {/* Right: Recent Activity */}
          <RecentActivityPanel
            onSelectTrace={(traceId) => onViewTrace?.(traceId)}
          />
        </div>
      </div>

      {/* Memory vault sheet */}
      <Sheet open={isMemoryOpen} onOpenChange={setIsMemoryOpen}>
        <SheetContent side="right" className="bg-zinc-950 border-zinc-800 text-white">
          <SheetHeader>
            <SheetTitle className="text-white">Memory vault</SheetTitle>
            <SheetDescription className="text-zinc-400">
              Stored context across environment, session, and agents.
            </SheetDescription>
          </SheetHeader>
          <MemoryVaultContent singleColumn showHeading={false} />
        </SheetContent>
      </Sheet>

      {/* Node Detail Drawer */}
      <NodeDetailDrawer
        nodeId={selectedNodeId}
        node={nodes.find((n) => n.id === selectedNodeId)}
        currency={currency}
        isOpen={isDrawerOpen}
        onClose={handleCloseDrawer}
        onRevoke={handleRevokeNode}
        onDirectChat={() => workspaceStore.setActiveNavTab("assistant")}
      />
    </div>
  );
}
