"use client";

import * as React from "react";
import { ZoomIn, ZoomOut, AlertTriangle, Layers, Maximize2, Minimize2 } from "lucide-react";
import { useWorkspaceStore } from "../../app/lib/workspace-store";
import type { AgentNodeData, AgentEdgeData } from "../../app/lib/workspace-store";
import { useDashboardNavigation } from "../../app/lib/navigation";
import { AgentNetworkCanvas, AgentNetworkListView } from "../canvas";
import { PipelineSvg, PipelineTicker, PipelineStats } from "./orchestrator-pipeline";
import { Button } from "../ui/button";

export interface DelegationTopologyProps {
  className?: string;
  selectedNodeId?: string | null;
  onSelectNode?: (nodeId: string) => void;
  nodes?: AgentNodeData[];
  edges?: AgentEdgeData[];
  currency?: string;
  totalLimitMinor?: number;
  spentMinor?: number;
  reservedMinor?: number;
  isLoading?: boolean;
  error?: Error | null;
  onRetry?: () => void;
}

export function DelegationTopology({
  className = "",
  selectedNodeId,
  onSelectNode,
  nodes,
  edges,
  currency: propCurrency,
  totalLimitMinor,
  spentMinor,
  reservedMinor,
  isLoading = false,
  error = null,
  onRetry,
}: DelegationTopologyProps) {
  const store = useWorkspaceStore();
  const env = store.currentEnvironment;
  const currency = propCurrency ?? env?.currency ?? "USD";
  const { navigateTab } = useDashboardNavigation();
  const activeId = selectedNodeId ?? store.selectedNodeId ?? "orchestrator-root";

  const effectiveNodes = nodes ?? store.graphNodes;
  const effectiveEdges = edges ?? store.graphEdges;
  const totalNodes = effectiveNodes.length;
  const activeNodes = effectiveNodes.filter((n) => n.status === "active").length;

  const [viewMode, setViewMode] = React.useState<"pipeline" | "3d" | "list">("pipeline");
  const [zoomScale, setZoomScale] = React.useState<number>(1);
  const [isFullscreen, setIsFullscreen] = React.useState(false);
  const sectionRef = React.useRef<HTMLElement>(null);

  const handleToggleFullscreen = () => {
    if (!isFullscreen) {
      if (sectionRef.current?.requestFullscreen) {
        sectionRef.current.requestFullscreen().catch(() => {
          setIsFullscreen(true);
        });
      } else {
        setIsFullscreen(true);
      }
    } else {
      if (document.fullscreenElement && document.exitFullscreen) {
        document.exitFullscreen().catch(() => {
          setIsFullscreen(false);
        });
      } else {
        setIsFullscreen(false);
      }
    }
  };

  React.useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, []);

  const handleZoom = (delta: number) => {
    setZoomScale((prev) => Math.min(1.4, Math.max(0.7, Math.round((prev + delta) * 10) / 10)));
  };

  const handleResetZoom = () => {
    setZoomScale(1);
  };

  return (
    <section
      ref={sectionRef}
      aria-label="Delegation Topology"
      className={
        isFullscreen
          ? "fixed inset-0 z-50 flex flex-col bg-zinc-950 w-screen h-screen rounded-none border-0 overflow-hidden"
          : `relative flex flex-col rounded-xl border border-zinc-800 bg-zinc-950 overflow-hidden shadow-sm ${className}`
      }
    >
      {/* ─── Main Box Header ─── */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 border-b border-zinc-800/80 bg-zinc-950 shrink-0">
        <div className="flex items-center gap-2.5">
          <span className="w-2 h-2 rounded-full bg-blue-500 inline-block animate-pulse" />
          <h2 className="text-base font-semibold tracking-tight text-white">Delegation topology</h2>
          <div className="flex items-center gap-1.5 text-xs font-mono">
            <span className="rounded-md border border-zinc-800 bg-zinc-900/80 px-2 py-0.5 text-zinc-400">
              {totalNodes} {totalNodes === 1 ? "node" : "nodes"}
            </span>
            <span className="rounded-md border border-blue-900/60 bg-blue-950/40 px-2 py-0.5 text-blue-400">
              {activeNodes} active
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
      <div className="flex items-center justify-between px-5 py-2.5 text-xs text-zinc-400 border-b border-zinc-900 bg-zinc-950/50 shrink-0">
        <span className="font-medium text-zinc-300">
          {viewMode === "pipeline"
            ? "Orchestrator Pipeline"
            : viewMode === "3d"
              ? "3D Network View"
              : "Agent Authority List"}
        </span>

        {(viewMode === "pipeline" || viewMode === "3d") && (
          <div className="flex items-center gap-3">
            {viewMode === "pipeline" && (
              <>
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
                <span className="text-zinc-700">·</span>
              </>
            )}

            {/* Fullscreen Button for both Pipeline and 3D */}
            <button
              type="button"
              onClick={handleToggleFullscreen}
              title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
              aria-label={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
              className="flex items-center gap-1.5 rounded px-2 py-1 text-xs text-zinc-400 hover:bg-zinc-800 hover:text-white transition-colors font-medium"
            >
              {isFullscreen ? (
                <>
                  <Minimize2 className="h-3.5 w-3.5 text-blue-400" />
                  <span>Exit Fullscreen</span>
                </>
              ) : (
                <>
                  <Maximize2 className="h-3.5 w-3.5 text-zinc-400 hover:text-white" />
                  <span>Fullscreen</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>

      {/* ─── Main Graph Content Area (dynamically expands in fullscreen) ─── */}
      <div
        className={
          isFullscreen
            ? "relative flex-1 w-full overflow-hidden bg-zinc-950 flex flex-col"
            : "relative h-[520px] w-full overflow-hidden bg-zinc-950"
        }
      >
        {isLoading && effectiveNodes.length === 0 ? (
          <div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-zinc-950 p-6 text-center">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-700 border-t-blue-500" />
            <p className="text-xs text-zinc-400">Loading delegation topology...</p>
          </div>
        ) : !isLoading && error && effectiveNodes.length === 0 ? (
          <div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-zinc-950 p-6 text-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-950/40 text-red-400 border border-red-900/60">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium text-white">Failed to load agent topology</p>
              <p className="text-xs text-zinc-400 max-w-sm">
                {error.message ||
                  "An unexpected error occurred while communicating with the backend gateway."}
              </p>
            </div>
            {onRetry && (
              <Button
                variant="outline"
                size="sm"
                onClick={onRetry}
                className="mt-2 h-8 border-zinc-800 bg-zinc-900 text-xs text-zinc-200 hover:bg-zinc-800"
              >
                Retry Connection
              </Button>
            )}
          </div>
        ) : !isLoading && !error && effectiveNodes.length === 0 ? (
          <div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-zinc-950 p-6 text-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-900 text-zinc-400 border border-zinc-800">
              <Layers className="h-5 w-5" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium text-white">No child agents attached</p>
              <p className="text-xs text-zinc-400 max-w-sm">
                Provision a specialist agent from the Library to begin constructing the delegation
                pipeline.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigateTab("agents")}
              className="mt-2 h-8 border-zinc-800 bg-zinc-900 text-xs text-zinc-200 hover:bg-zinc-800"
            >
              Open Agent Library
            </Button>
          </div>
        ) : (
          <>
            {viewMode === "pipeline" && (
              <div
                className="h-full w-full flex items-center justify-center px-2 sm:px-4 py-3 transition-transform duration-200 ease-out overflow-auto"
                style={{ transform: `scale(${zoomScale})`, transformOrigin: "center center" }}
              >
                <PipelineSvg
                  selectedNodeId={activeId}
                  onSelectNode={onSelectNode}
                  nodes={effectiveNodes}
                  edges={effectiveEdges}
                  currency={currency}
                  className="w-full max-w-5xl"
                />
              </div>
            )}

            {viewMode === "3d" && (
              <div className="h-full w-full bg-zinc-950">
                <AgentNetworkCanvas
                  nodes={effectiveNodes}
                  edges={effectiveEdges}
                  currency={currency}
                  onSelectNode={onSelectNode}
                  hideFilterControls
                  hideViewToggle
                />
              </div>
            )}

            {viewMode === "list" && (
              <div className="h-full w-full overflow-y-auto bg-zinc-950">
                <AgentNetworkListView
                  nodes={effectiveNodes}
                  currency={currency}
                  onSelectNode={onSelectNode}
                  onToggleViewMode={() => setViewMode("pipeline")}
                  hideViewToggle
                />
              </div>
            )}
          </>
        )}
      </div>

      {/* ─── Main Box Footer: Live Ticker & Operational Stats ─── */}
      <PipelineTicker nodes={effectiveNodes} currency={currency} />
      <PipelineStats
        nodes={effectiveNodes}
        currency={currency}
        totalLimitMinor={totalLimitMinor}
        spentMinor={spentMinor}
        reservedMinor={reservedMinor}
      />
    </section>
  );
}
