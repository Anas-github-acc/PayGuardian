"use client";

import * as React from "react";
import { ZoomIn, ZoomOut } from "lucide-react";
import { useWorkspaceStore } from "../../app/lib/workspace-store";
import { AgentNetworkCanvas, AgentNetworkListView } from "../canvas";
import { PipelineSvg, PipelineTicker, PipelineStats } from "./orchestrator-pipeline";

export interface DelegationTopologyProps {
  className?: string;
  selectedNodeId?: string | null;
  onSelectNode?: (nodeId: string) => void;
}

export function DelegationTopology({
  className = "",
  selectedNodeId,
  onSelectNode,
}: DelegationTopologyProps) {
  const store = useWorkspaceStore();
  const activeId = selectedNodeId ?? store.selectedNodeId ?? "orchestrator-root";

  const [viewMode, setViewMode] = React.useState<"pipeline" | "3d" | "list">("pipeline");
  const [zoomScale, setZoomScale] = React.useState<number>(1);

  const handleZoom = (delta: number) => {
    setZoomScale((prev) => Math.min(1.4, Math.max(0.7, Math.round((prev + delta) * 10) / 10)));
  };

  const handleResetZoom = () => {
    setZoomScale(1);
  };

  return (
    <section
      aria-label="Delegation Topology"
      className={`relative flex flex-col rounded-xl border border-zinc-800 bg-zinc-950 overflow-hidden shadow-sm ${className}`}
    >
      {/* ─── Main Box Header ─── */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 border-b border-zinc-800/80 bg-zinc-950">
        <div className="flex items-center gap-2.5">
          <span className="w-2 h-2 rounded-full bg-blue-500 inline-block animate-pulse" />
          <h2 className="text-base font-semibold tracking-tight text-white">
            Delegation topology
          </h2>
          <div className="flex items-center gap-1.5 text-xs font-mono">
            <span className="rounded-md border border-zinc-800 bg-zinc-900/80 px-2 py-0.5 text-zinc-400">
              5 nodes
            </span>
            <span className="rounded-md border border-blue-900/60 bg-blue-950/40 px-2 py-0.5 text-blue-400">
              2 active
            </span>
          </div>
        </div>

        {/* View Switcher Controls */}
        <div className="flex items-center gap-1 text-xs">
          <button
            type="button"
            onClick={() => setViewMode("pipeline")}
            className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
              viewMode === "pipeline"
                ? "bg-zinc-800 text-white border border-zinc-700"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            Pipeline
          </button>
          <button
            type="button"
            onClick={() => setViewMode("3d")}
            className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
              viewMode === "3d"
                ? "bg-zinc-800 text-white border border-zinc-700"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            3D Canvas
          </button>
          <button
            type="button"
            onClick={() => setViewMode("list")}
            className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
              viewMode === "list"
                ? "bg-zinc-800 text-white border border-zinc-700"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            List
          </button>
        </div>
      </div>

      {/* ─── Subheader Toolbar ─── */}
      <div className="flex items-center justify-between px-5 py-2.5 text-xs text-zinc-400 border-b border-zinc-900 bg-zinc-950/50">
        <span className="font-medium text-zinc-300">
          {viewMode === "pipeline"
            ? "Orchestrator Pipeline"
            : viewMode === "3d"
            ? "3D Network View"
            : "Agent Authority List"}
        </span>

        {viewMode === "pipeline" && (
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => handleZoom(-0.1)}
                title="Zoom Out"
                aria-label="Zoom Out"
                className="rounded p-1 hover:bg-zinc-800 hover:text-white transition-colors"
              >
                <ZoomOut className="h-3.5 w-3.5" />
              </button>
              <span className="font-mono text-[11px] w-10 text-center text-zinc-400">
                {Math.round(zoomScale * 100)}%
              </span>
              <button
                type="button"
                onClick={() => handleZoom(0.1)}
                title="Zoom In"
                aria-label="Zoom In"
                className="rounded p-1 hover:bg-zinc-800 hover:text-white transition-colors"
              >
                <ZoomIn className="h-3.5 w-3.5" />
              </button>
            </div>
            <span className="text-zinc-700">·</span>
            <button
              type="button"
              onClick={handleResetZoom}
              className="hover:text-zinc-200 transition-colors"
            >
              Auto layout
            </button>
            <span className="text-zinc-700">·</span>
            <button
              type="button"
              onClick={() => setViewMode("list")}
              className="hover:text-zinc-200 transition-colors"
            >
              List
            </button>
          </div>
        )}
      </div>

      {/* ─── Main Graph Content Area (fixed height for all 3 views) ─── */}
      <div className="relative h-[520px] w-full overflow-hidden bg-zinc-950">
        {viewMode === "pipeline" && (
          <div
            className="h-full w-full flex items-center justify-center px-2 sm:px-4 py-3 transition-transform duration-200 ease-out"
            style={{ transform: `scale(${zoomScale})`, transformOrigin: "center center" }}
          >
            <PipelineSvg
              selectedNodeId={activeId}
              onSelectNode={onSelectNode}
              className="w-full max-w-5xl"
            />
          </div>
        )}

        {viewMode === "3d" && (
          <div className="h-full w-full bg-zinc-950">
            <AgentNetworkCanvas
              onSelectNode={onSelectNode}
              hideFilterControls
              hideViewToggle
            />
          </div>
        )}

        {viewMode === "list" && (
          <div className="h-full w-full overflow-y-auto bg-zinc-950">
            <AgentNetworkListView
              onSelectNode={onSelectNode}
              onToggleViewMode={() => setViewMode("pipeline")}
              hideViewToggle
            />
          </div>
        )}
      </div>

      {/* ─── Main Box Footer: Live Ticker & Operational Stats ─── */}
      <PipelineTicker />
      <PipelineStats />
    </section>
  );
}
