"use client";

import * as React from "react";
import {
  ShieldCheck,
  Link2,
  Box,
  ChevronRight,
  Search,
} from "lucide-react";
import { formatMinorUnits, calculateAvailableMinor } from "../../app/lib/currency";
import { useWorkspaceStore, workspaceStore } from "../../app/lib/workspace-store";
import type { AgentNodeData } from "./types";
import { Button } from "../ui/button";
import { Badge as UIBadge, type BadgeProps as UIBadgeProps } from "../ui/badge";

export interface BadgeProps extends Omit<UIBadgeProps, "variant"> {
  variant?: UIBadgeProps["variant"] | "warning";
}

function Badge({ variant, className, children, ...props }: BadgeProps) {
  if (variant === "warning") {
    return (
      <UIBadge
        variant="pending"
        className={`border-warning/40 bg-warning/15 text-warning font-mono text-[9px] font-bold uppercase tracking-wider ${className ?? ""}`}
        {...props}
      >
        {children}
      </UIBadge>
    );
  }
  return (
    <UIBadge variant={variant} className={className} {...props}>
      {children}
    </UIBadge>
  );
}

export interface AgentNetworkListViewProps {
  className?: string;
  nodes?: AgentNodeData[];
  currency?: string;
  onSelectNode?: (nodeId: string) => void;
  onToggleViewMode?: () => void;
  /** Hide the header "Switch to 3D Canvas" button when a card header hosts it instead. */
  hideViewToggle?: boolean;
}

export function AgentNetworkListView({
  className = "",
  nodes: propNodes,
  currency = "USD",
  onSelectNode,
  onToggleViewMode,
  hideViewToggle = false,
}: AgentNetworkListViewProps) {
  const store = useWorkspaceStore();
  const [focusedIndex, setFocusedIndex] = React.useState<number>(0);
  const [searchQuery, setSearchQuery] = React.useState<string>("");
  const tableRef = React.useRef<HTMLDivElement>(null);

  const rawNodes = propNodes ?? (store.graphNodes.length > 0 ? store.graphNodes : []);

  const nodes = React.useMemo(() => {
    if (!searchQuery.trim()) return rawNodes;
    const q = searchQuery.toLowerCase();
    return rawNodes.filter(
      (n) => n.name.toLowerCase().includes(q) || n.role.toLowerCase().includes(q)
    );
  }, [rawNodes, searchQuery]);

  // Handle Keyboard Navigation (ArrowUp, ArrowDown, Enter, Space)
  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (nodes.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setFocusedIndex((prev) => (prev + 1 < nodes.length ? prev + 1 : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setFocusedIndex((prev) => (prev - 1 >= 0 ? prev - 1 : nodes.length - 1));
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      const selected = nodes[focusedIndex];
      if (selected) {
        workspaceStore.setSelectedNodeId(selected.id);
        onSelectNode?.(selected.id);
      }
    }
  };

  const handleRowClick = (nodeId: string, index: number) => {
    setFocusedIndex(index);
    workspaceStore.setSelectedNodeId(nodeId);
    onSelectNode?.(nodeId);
  };

  return (
    <div
      ref={tableRef}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      role="region"
      aria-label="Accessible Agent Network Table"
      className={`flex flex-col h-full bg-zinc-950 text-zinc-200 overflow-hidden focus:outline-none ${className}`}
    >
      {/* Top Header & Search */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 border-b border-zinc-800/80 bg-zinc-950">
        <div className="flex items-center gap-2">
          <div className="text-xs font-semibold tracking-tight text-white">
            Agent Network Directory (Accessible Keyboard View)
          </div>
          <span className="rounded-md border border-zinc-800 bg-zinc-900 px-2 py-0.5 text-[10px] font-mono text-zinc-400">
            {nodes.length} Agents
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Search box */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-500" />
            <input
              type="text"
              placeholder="Search by agent name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-7 w-48 rounded border border-zinc-800 bg-zinc-900/80 pl-8 pr-2.5 text-xs text-zinc-200 placeholder-zinc-500 focus:border-blue-500 focus:outline-none"
            />
          </div>

          {!hideViewToggle && (
            <Button
              variant="outline"
              size="sm"
              onClick={onToggleViewMode}
              className="h-7 px-2.5 text-xs text-zinc-300 border-zinc-800 bg-zinc-900 hover:bg-zinc-800 hover:text-white"
            >
              <Box className="h-3 w-3 mr-1.5 text-blue-400" />
              Switch to 3D Canvas
            </Button>
          )}
        </div>
      </div>

      {/* Keyboard instructions banner */}
      <div className="px-3.5 py-1.5 bg-zinc-900/40 border-b border-zinc-800/60 flex items-center justify-between text-[11px] text-zinc-400">
        <span>
          Use <strong className="text-zinc-300 font-mono">↑ / ↓</strong> to navigate rows, <strong className="text-zinc-300 font-mono">Enter</strong> to inspect node details drawer
        </span>
        <span className="font-mono text-[10px] text-zinc-500">1:1 Accessible Equivalent</span>
      </div>

      {/* Table Container */}
      <div className="flex-1 overflow-auto bg-zinc-950">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-zinc-800/80 bg-zinc-900/50 text-[11px] text-zinc-400">
              <th className="py-2.5 px-3.5 font-medium">Agent Name & Role</th>
              <th className="py-2.5 px-3 font-medium">Status</th>
              <th className="py-2.5 px-3 font-medium">Authority Mode</th>
              <th className="py-2.5 px-3 font-medium text-right font-mono">Allocated</th>
              <th className="py-2.5 px-3 font-medium text-right font-mono">Spent</th>
              <th className="py-2.5 px-3 font-medium text-right font-mono">Available</th>
              <th className="py-2.5 px-3 font-medium text-center">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/50 bg-zinc-950">
            {nodes.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-8 text-center text-xs text-zinc-500">
                  {rawNodes.length === 0
                    ? "No agent nodes found in this environment."
                    : "No agents found matching search criteria."}
                </td>
              </tr>
            ) : (
              nodes.map((node, idx) => {
                const isFocused = idx === focusedIndex;
                const isSelected = store.selectedNodeId === node.id;
                const availableMinor = calculateAvailableMinor(
                  node.allocatedMinor,
                  node.spentMinor,
                  node.reservedMinor
                );

                return (
                  <tr
                    key={node.id}
                    onClick={() => handleRowClick(node.id, idx)}
                    className={`cursor-pointer transition-colors ${
                      isSelected
                        ? "bg-blue-950/30 text-white"
                        : isFocused
                        ? "bg-zinc-900 text-white"
                        : "hover:bg-zinc-900/50 text-zinc-300"
                    }`}
                  >
                    {/* Name & Role */}
                    <td className="py-2.5 px-3.5">
                      <div className="flex items-center gap-2">
                        <div
                          className={`flex h-6 w-6 items-center justify-center rounded border ${
                            node.isFunded
                              ? "bg-blue-950/40 border-blue-900/50 text-blue-400"
                              : "bg-zinc-900 border-zinc-800 text-zinc-500"
                          }`}
                        >
                          <span className="text-[10px] font-bold">
                            {node.name.slice(0, 2).toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-zinc-100">{node.name}</span>
                            {node.isSimulation && (
                              <Badge variant="warning">[SIMULATION]</Badge>
                            )}
                          </div>
                          <div className="text-[10px] text-zinc-500 font-mono">
                            {node.id} · {node.role}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Status Pill */}
                    <td className="py-2.5 px-3">
                      <Badge
                        variant={
                          node.status === "active"
                            ? "active"
                            : node.status === "revoked"
                            ? "revoked"
                            : node.status === "paused"
                            ? "pending"
                            : "unfunded"
                        }
                        showDot
                      >
                        {node.status}
                      </Badge>
                    </td>

                    {/* Authority Mode: Solid vs Dashed */}
                    <td className="py-2.5 px-3">
                      {node.isFunded ? (
                        <span className="inline-flex items-center gap-1.5 rounded bg-blue-950/40 px-2 py-0.5 text-[11px] font-medium text-blue-400 border border-blue-900/50">
                          <ShieldCheck className="h-3 w-3" />
                          Funded (Solid)
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 rounded bg-zinc-900/40 px-2 py-0.5 text-[11px] font-medium text-zinc-400 border border-dashed border-zinc-800">
                          <Link2 className="h-3 w-3" />
                          Unfunded (Dashed)
                        </span>
                      )}
                    </td>

                    {/* Allocated */}
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums text-zinc-200">
                      {node.isFunded ? formatMinorUnits(node.allocatedMinor, currency) : "—"}
                    </td>

                    {/* Spent */}
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums text-zinc-400">
                      {node.isFunded ? formatMinorUnits(node.spentMinor, currency) : "—"}
                    </td>

                    {/* Available */}
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums text-blue-400 font-medium">
                      {node.isFunded ? formatMinorUnits(availableMinor, currency) : "—"}
                    </td>

                    {/* Inspect Link */}
                    <td className="py-2.5 px-3 text-center">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRowClick(node.id, idx);
                        }}
                        className="h-6 w-6 p-0 text-zinc-500 hover:text-zinc-200"
                      >
                        <ChevronRight className="h-3.5 w-3.5" />
                      </Button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
