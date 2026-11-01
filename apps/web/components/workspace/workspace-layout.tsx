"use client";

import * as React from "react";
import { Bookmark, MessageSquare, ChevronDown } from "lucide-react";
import { useWorkspaceStore, workspaceStore } from "../../app/lib/workspace-store";
import { useDashboardNavigation } from "../../app/lib/navigation";
import { KpiStrip } from "./kpi-strip";
import { DelegationTopology } from "./delegation-topology";
import { AgentInspector } from "./agent-inspector";
import { RecentActivityPanel } from "./recent-activity-panel";
import { MemoryVaultContent } from "./sessions-memory";
import { NodeDetailDrawer } from "../canvas";
import { DEFAULT_GRAPH_NODES, DEFAULT_GRAPH_EDGES } from "./workspace-defaults";
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
  onOpenApprovals,
}: WorkspaceLayoutProps) {
  const store = useWorkspaceStore();
  const { navigateTab } = useDashboardNavigation();

  const [selectedNodeId, setSelectedNodeId] = React.useState<string>("orchestrator-root");
  const [isDrawerOpen, setIsDrawerOpen] = React.useState(false);
  const [isMemoryOpen, setIsMemoryOpen] = React.useState(false);

  // Initialize store graph defaults if empty on first load
  React.useEffect(() => {
    if (store.graphNodes.length === 0) {
      workspaceStore.setGraphData(DEFAULT_GRAPH_NODES, DEFAULT_GRAPH_EDGES);
    }
  }, [store.graphNodes.length]);

  const handleSelectNode = (nodeId: string) => {
    setSelectedNodeId(nodeId);
    workspaceStore.setSelectedNodeId(nodeId);
  };

  const handleOpenDetailedDrawer = () => {
    setIsDrawerOpen(true);
  };

  const handleCloseDrawer = () => {
    setIsDrawerOpen(false);
  };

  const handleRevokeNode = (nodeId: string) => {
    // Mark node as revoked in store
    const updatedNodes = store.graphNodes.map((n) =>
      n.id === nodeId ? { ...n, status: "revoked" as const, isFunded: false } : n
    );
    workspaceStore.setGraphData(updatedNodes, store.graphEdges);

    // Yield verified block message to the Assistant stream
    const nowIso = new Date().toISOString();
    workspaceStore.addChatMessage({
      type: "agent_says",
      id: `ag-rev-${Date.now()}`,
      sender: "Security Policy Enforcement",
      timestamp: nowIso,
      text: `Authority for agent ${nodeId} has been revoked by operator. Remaining allocated funds reclaimed.`,
    });
  };

  const env = store.currentEnvironment;
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
        <KpiStrip />

        {/* 3. Delegation Topology Container */}
        <DelegationTopology
          selectedNodeId={selectedNodeId}
          onSelectNode={handleSelectNode}
        />

        {/* 4. Bottom 50/50 Split: Agent Inspector & Recent Activity */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Left: Agent Inspector */}
          <AgentInspector
            selectedNodeId={selectedNodeId}
            onRevoke={handleRevokeNode}
            onViewTrace={onViewTrace}
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
        isOpen={isDrawerOpen}
        onClose={handleCloseDrawer}
        onRevoke={handleRevokeNode}
        onDirectChat={() => workspaceStore.setActiveNavTab("assistant")}
      />
    </div>
  );
}
