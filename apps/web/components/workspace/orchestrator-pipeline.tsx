"use client";

import * as React from "react";
import { useMemo } from "react";
import { motion } from "framer-motion";
import { useWorkspaceStore, workspaceStore } from "../../app/lib/workspace-store";
import type { AgentNodeData, AgentEdgeData } from "../../app/lib/workspace-store";
import { formatMinorUnits, calculateAvailableMinor } from "../../app/lib/currency";

export function AnimatedDot({
  path,
  duration,
  delay,
  size,
  opacity,
  color = "#0052FF",
}: {
  path: string;
  duration: number;
  delay: number;
  size: number;
  opacity: number;
  color?: string;
}) {
  return (
    <circle r={size} fill={color} opacity={opacity}>
      <animateMotion
        dur={`${duration}s`}
        repeatCount="indefinite"
        begin={`${delay}s`}
        path={path}
      />
    </circle>
  );
}

export function PulsingDot({
  cx,
  cy,
  color,
  duration,
  delay = 0,
}: {
  cx: number;
  cy: number;
  color: string;
  duration: number;
  delay?: number;
}) {
  return (
    <motion.circle
      cx={cx}
      cy={cy}
      r={2.8}
      fill={color}
      animate={{ opacity: [0.15, 1, 0.15] }}
      transition={{
        duration,
        delay,
        repeat: Infinity,
        ease: "easeInOut",
      }}
    />
  );
}

export function StatusIndicator({
  cx,
  cy,
  color,
  pulsing = false,
  duration = 1.9,
  delay = 0,
}: {
  cx: number;
  cy: number;
  color: string;
  pulsing?: boolean;
  duration?: number;
  delay?: number;
}) {
  if (pulsing) {
    return (
      <motion.circle
        cx={cx}
        cy={cy}
        r={3}
        fill={color}
        animate={{ opacity: [0.3, 1, 0.3] }}
        transition={{
          duration,
          delay,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />
    );
  }
  return <circle cx={cx} cy={cy} r={3} fill={color} opacity={0.95} />;
}

export interface PipelineSvgProps {
  className?: string;
  onSelectNode?: (nodeId: string) => void;
  selectedNodeId?: string | null;
  nodes?: AgentNodeData[];
  edges?: AgentEdgeData[];
  currency?: string;
}

export function PipelineSvg({
  className = "",
  onSelectNode,
  selectedNodeId,
  nodes: propNodes,
  edges: propEdges,
  currency: propCurrency,
}: PipelineSvgProps) {
  const store = useWorkspaceStore();
  const env = store.currentEnvironment;
  const currency = propCurrency ?? env?.currency ?? "USD";
  const activeId = selectedNodeId ?? store.selectedNodeId ?? "orchestrator-root";

  const effectiveNodes = propNodes ?? store.graphNodes;
  const effectiveEdges = propEdges ?? store.graphEdges;

  // STRICT REQUIREMENT: Only current active agents should be displayed
  const activeNodes = useMemo(
    () => effectiveNodes.filter((n) => n.status === "active"),
    [effectiveNodes]
  );

  const rootNode = useMemo(
    () => activeNodes.find((n) => n.role === "orchestrator" || n.id === "orchestrator-root") || activeNodes[0],
    [activeNodes]
  );

  const activeChildren = useMemo(
    () => activeNodes.filter((n) => n.id !== (rootNode?.id ?? "orchestrator-root")),
    [activeNodes, rootNode]
  );

  const activeEdges = useMemo(() => {
    const activeIds = new Set(activeNodes.map((n) => n.id));
    return effectiveEdges.filter((e) => activeIds.has(e.source) && activeIds.has(e.target));
  }, [effectiveEdges, activeNodes]);

  const handleNodeClick = (nodeId: string) => {
    workspaceStore.setSelectedNodeId(nodeId);
    onSelectNode?.(nodeId);
  };

  // Build Dynamic Tree Topology
  const rootId = rootNode?.id ?? "orchestrator-root";

  const getParentId = React.useCallback(
    (child: AgentNodeData): string => {
      const edge = activeEdges.find((e) => e.target === child.id);
      if (edge) return edge.source;
      if (child.parentAgentId && activeNodes.some((n) => n.id === child.parentAgentId)) {
        return child.parentAgentId;
      }
      return rootId;
    },
    [activeEdges, activeNodes, rootId]
  );

  const { tier1Agents, tier2ByParent } = useMemo(() => {
    const t1: AgentNodeData[] = [];
    const t2 = new Map<string, AgentNodeData[]>();

    // 1. Identify direct children of root (or fallback)
    for (const c of activeChildren) {
      const pId = getParentId(c);
      if (pId === rootId) {
        t1.push(c);
      }
    }

    // 2. Identify Tier 2 sub-children of Tier 1 agents
    for (const c of activeChildren) {
      const pId = getParentId(c);
      if (pId !== rootId) {
        if (t1.some((parent) => parent.id === pId)) {
          const list = t2.get(pId) || [];
          list.push(c);
          t2.set(pId, list);
        } else {
          // Fallback: if parent not found, attach directly to root
          t1.push(c);
        }
      }
    }

    return { tier1Agents: t1, tier2ByParent: t2 };
  }, [activeChildren, getParentId, rootId]);

  // Compute Layout Positions and Edge Paths dynamically
  const cardW = 145;
  const cardH = 48;
  const gap = 14;
  const paddingY = 18;

  const { layoutNodes, layoutPaths, totalRows } = useMemo(() => {
    const nodesMap: Array<{
      agent: AgentNodeData;
      x: number;
      y: number;
      w: number;
      h: number;
      tier: 1 | 2;
    }> = [];

    const paths: Array<{
      id: string;
      path: string;
      isUnfunded: boolean;
      isSelected: boolean;
      idx: number;
    }> = [];

    let row = 0;
    let pathIdx = 0;

    for (const t1 of tier1Agents) {
      const subChildren = tier2ByParent.get(t1.id) || [];

      if (subChildren.length <= 1) {
        const rowY = paddingY + row * (cardH + gap);
        nodesMap.push({ agent: t1, x: 540, y: rowY, w: cardW, h: cardH, tier: 1 });

        if (subChildren.length === 1) {
          const t2 = subChildren[0];
          nodesMap.push({ agent: t2, x: 730, y: rowY, w: cardW, h: cardH, tier: 2 });

          // Direct path from Tier 1 to Tier 2
          const isT2Unfunded = t2.status === "unfunded" || (t2.allocatedMinor ?? 0) === 0;
          paths.push({
            id: `edge-${t1.id}-${t2.id}`,
            path: `M685,${rowY + 24} L730,${rowY + 24}`,
            isUnfunded: isT2Unfunded,
            isSelected: activeId === t2.id,
            idx: pathIdx++,
          });
        }
        row += 1;
      } else {
        const startRow = row;
        const totalSpan = subChildren.length * (cardH + gap) - gap;
        const t1Y = paddingY + startRow * (cardH + gap) + (totalSpan - cardH) / 2;
        nodesMap.push({ agent: t1, x: 540, y: t1Y, w: cardW, h: cardH, tier: 1 });

        subChildren.forEach((t2, j) => {
          const t2Y = paddingY + (startRow + j) * (cardH + gap);
          nodesMap.push({ agent: t2, x: 730, y: t2Y, w: cardW, h: cardH, tier: 2 });

          const isT2Unfunded = t2.status === "unfunded" || (t2.allocatedMinor ?? 0) === 0;
          paths.push({
            id: `edge-${t1.id}-${t2.id}`,
            path: `M685,${t1Y + 24} C705,${t1Y + 24} 710,${t2Y + 24} 730,${t2Y + 24}`,
            isUnfunded: isT2Unfunded,
            isSelected: activeId === t2.id,
            idx: pathIdx++,
          });
        });

        row += subChildren.length;
      }
    }

    return { layoutNodes: nodesMap, layoutPaths: paths, totalRows: Math.max(1, row) };
  }, [tier1Agents, tier2ByParent, activeId]);

  // Overall SVG dimensions
  const totalContentHeight = paddingY * 2 + totalRows * cardH + (totalRows - 1) * gap;
  const viewBoxHeight = Math.max(190, totalContentHeight);
  const centerY = viewBoxHeight / 2;

  const pTriggerToGateway = `M140,${centerY} L180,${centerY}`;
  const pGatewayToOrch = `M306,${centerY} L346,${centerY}`;

  // Paths from Orchestrator (right anchor 490, centerY) to each Tier 1 Node (left anchor 540, y + 24)
  const orchToTier1Paths = useMemo(() => {
    return layoutNodes
      .filter((n) => n.tier === 1)
      .map((n, idx) => {
        const targetY = n.y + 24;
        const isSelected = activeId === n.agent.id;
        const isUnfunded = n.agent.status === "unfunded" || (n.agent.allocatedMinor ?? 0) === 0;
        let d = `M490,${centerY} L540,${targetY}`;
        if (Math.abs(targetY - centerY) > 2) {
          d = `M490,${centerY} C515,${centerY} 515,${targetY} 540,${targetY}`;
        }
        return {
          id: `orch-${n.agent.id}`,
          path: d,
          isUnfunded,
          isSelected,
          idx,
        };
      });
  }, [layoutNodes, centerY, activeId]);

  return (
    <div className={`w-full py-2 ${className}`}>
      <svg
        width="100%"
        viewBox={`0 0 920 ${viewBoxHeight}`}
        className="w-full h-auto block select-none"
      >
        <defs>
          <marker
            id="blueArrow"
            viewBox="0 0 10 10"
            refX="8"
            refY="5"
            markerWidth="5"
            markerHeight="5"
            orient="auto"
          >
            <path
              d="M2 1.5L7.5 5L2 8.5"
              fill="none"
              stroke="rgba(0,82,255,0.45)"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </marker>
          <marker
            id="orangeArrow"
            viewBox="0 0 10 10"
            refX="8"
            refY="5"
            markerWidth="5"
            markerHeight="5"
            orient="auto"
          >
            <path
              d="M2 1.5L7.5 5L2 8.5"
              fill="none"
              stroke="rgba(245,158,11,0.5)"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </marker>
        </defs>

        {/* 1. Connection Path: Trigger -> Gateway */}
        <path
          d={pTriggerToGateway}
          fill="none"
          stroke="rgba(0,82,255,0.22)"
          strokeWidth="1.5"
          strokeDasharray="3 5"
          markerEnd="url(#blueArrow)"
        />

        {/* 2. Connection Path: Gateway -> Orchestrator */}
        <path
          d={pGatewayToOrch}
          fill="none"
          stroke="rgba(0,82,255,0.22)"
          strokeWidth="1.5"
          strokeDasharray="3 5"
          markerEnd="url(#blueArrow)"
        />

        {/* Animated Traveling Signal Dots on Backbone */}
        <AnimatedDot path={pTriggerToGateway} duration={1.1} delay={0} size={2.5} opacity={1} />
        <AnimatedDot path={pGatewayToOrch} duration={0.9} delay={0.2} size={2.5} opacity={1} />

        {/* Dynamic Connection Paths: Orchestrator -> Tier 1 Subagents */}
        {orchToTier1Paths.map((conn) => {
          const strokeColor = conn.isUnfunded
            ? "rgba(245,158,11,0.4)"
            : conn.isSelected
            ? "rgba(0,82,255,0.8)"
            : "rgba(0,82,255,0.25)";
          return (
            <React.Fragment key={conn.id}>
              <path
                d={conn.path}
                fill="none"
                stroke={strokeColor}
                strokeWidth="1.5"
                strokeDasharray="3 5"
                markerEnd={conn.isUnfunded ? "url(#orangeArrow)" : "url(#blueArrow)"}
              />
              <AnimatedDot
                path={conn.path}
                duration={1.2}
                delay={0.1 + conn.idx * 0.25}
                size={2.2}
                opacity={conn.isUnfunded ? 0.75 : 0.9}
                color={conn.isUnfunded ? "#f59e0b" : "#0052FF"}
              />
            </React.Fragment>
          );
        })}

        {/* Dynamic Connection Paths: Tier 1 -> Tier 2 Subagents */}
        {layoutPaths.map((conn) => {
          const strokeColor = conn.isUnfunded
            ? "rgba(245,158,11,0.4)"
            : conn.isSelected
            ? "rgba(0,82,255,0.8)"
            : "rgba(0,82,255,0.25)";
          return (
            <React.Fragment key={conn.id}>
              <path
                d={conn.path}
                fill="none"
                stroke={strokeColor}
                strokeWidth="1.5"
                strokeDasharray="3 5"
                markerEnd={conn.isUnfunded ? "url(#orangeArrow)" : "url(#blueArrow)"}
              />
              <AnimatedDot
                path={conn.path}
                duration={1.2}
                delay={0.3 + conn.idx * 0.2}
                size={2.2}
                opacity={conn.isUnfunded ? 0.75 : 0.9}
                color={conn.isUnfunded ? "#f59e0b" : "#0052FF"}
              />
            </React.Fragment>
          );
        })}

        {/* ─── NODE 1: Trigger / Operator Mandate ─── */}
        <g
          onClick={() => handleNodeClick(rootId)}
          className="cursor-pointer group"
        >
          <rect
            x="24"
            y={centerY - 25}
            width="116"
            height="50"
            rx="8"
            fill="#141414"
            stroke="rgba(255,255,255,0.12)"
            strokeWidth="0.5"
            className="transition-colors group-hover:stroke-white/30"
          />
          <text
            x="82"
            y={centerY - 9}
            textAnchor="middle"
            fontSize="9"
            fill="rgba(255,255,255,0.35)"
            fontFamily="system-ui"
            letterSpacing=".07em"
          >
            MANDATE
          </text>
          <text
            x="82"
            y={centerY + 7}
            textAnchor="middle"
            fontSize="11.5"
            fill="rgba(255,255,255,0.88)"
            fontFamily="system-ui"
            fontWeight="500"
          >
            Operator Intent
          </text>
          <text
            x="82"
            y={centerY + 18}
            textAnchor="middle"
            fontSize="8"
            fill="rgba(255,255,255,0.22)"
            fontFamily="monospace"
          >
            man-root
          </text>
        </g>

        {/* ─── NODE 2: Policy & Security Gateway ─── */}
        <g className="cursor-default">
          <rect
            x="180"
            y={centerY - 25}
            width="126"
            height="50"
            rx="8"
            fill="#141414"
            stroke="rgba(255,255,255,0.12)"
            strokeWidth="0.5"
          />
          <text
            x="243"
            y={centerY - 9}
            textAnchor="middle"
            fontSize="8.5"
            fill="rgba(255,255,255,0.35)"
            fontFamily="system-ui"
            letterSpacing=".07em"
          >
            POLICY GATEWAY
          </text>
          <text
            x="243"
            y={centerY + 7}
            textAnchor="middle"
            fontSize="11"
            fill="rgba(255,255,255,0.85)"
            fontFamily="system-ui"
            fontWeight="500"
          >
            Rules & Limits
          </text>
          <text
            x="243"
            y={centerY + 18}
            textAnchor="middle"
            fontSize="8"
            fill="rgba(0,82,255,0.7)"
            fontFamily="monospace"
          >
            PayPal Sandbox
          </text>
        </g>

        {/* ─── NODE 3: Main Orchestrator (Root Agent) ─── */}
        <g
          onClick={() => handleNodeClick(rootId)}
          className="cursor-pointer group"
        >
          <rect
            x="346"
            y={centerY - 38}
            width="144"
            height="76"
            rx="10"
            fill="#050D1C"
            stroke={activeId === rootId ? "#3b82f6" : "#0052FF"}
            strokeWidth={activeId === rootId ? "1.8" : "1"}
            className="transition-all group-hover:stroke-blue-400"
          />
          <rect x="378" y={centerY - 37.5} width="80" height="1" rx="0.5" fill="rgba(51,117,255,0.6)" />
          <text
            x="418"
            y={centerY - 18}
            textAnchor="middle"
            fontSize="9"
            fill="rgba(51,117,255,0.85)"
            fontFamily="system-ui"
            letterSpacing=".07em"
          >
            ORCHESTRATOR
          </text>
          <text
            x="418"
            y={centerY}
            textAnchor="middle"
            fontSize="12.5"
            fill="#fff"
            fontFamily="system-ui"
            fontWeight="600"
          >
            {rootNode?.name ?? "Main Orchestrator"}
          </text>
          <text
            x="418"
            y={centerY + 13}
            textAnchor="middle"
            fontSize="9"
            fill="rgba(0,82,255,0.9)"
            fontFamily="monospace"
            fontWeight="500"
          >
            {formatMinorUnits(rootNode?.subDelegatedMinor || rootNode?.allocatedMinor || env?.budgetLimitMinor || 0, currency)}
          </text>
          <PulsingDot cx={406} cy={centerY + 26} color="#0052FF" duration={1.2} delay={0} />
          <PulsingDot cx={418} cy={centerY + 26} color="#0052FF" duration={1.2} delay={0.4} />
          <PulsingDot cx={430} cy={centerY + 26} color="#0052FF" duration={1.2} delay={0.8} />
        </g>

        {/* Dynamic Child Subagents Rendering */}
        {layoutNodes.length === 0 ? (
          <g className="cursor-default">
            <rect
              x="550"
              y={centerY - 25}
              width="210"
              height="50"
              rx="8"
              fill="#111113"
              stroke="rgba(255,255,255,0.15)"
              strokeDasharray="4 4"
              strokeWidth="1"
            />
            <text
              x="655"
              y={centerY - 4}
              textAnchor="middle"
              fontSize="10"
              fill="rgba(255,255,255,0.45)"
              fontFamily="system-ui"
              letterSpacing=".05em"
            >
              NO SUBAGENTS DELEGATED
            </text>
            <text
              x="655"
              y={centerY + 12}
              textAnchor="middle"
              fontSize="8.5"
              fill="rgba(255,255,255,0.25)"
              fontFamily="system-ui"
            >
              Subagents appear upon task delegation
            </text>
          </g>
        ) : (
          layoutNodes.map((item) => {
            const agent = item.agent;
            const isSelected = activeId === agent.id;
            const isUnfunded = agent.status === "unfunded" || (agent.allocatedMinor ?? 0) === 0;
            const strokeColor = isSelected
              ? isUnfunded
                ? "#f59e0b"
                : "#3b82f6"
              : isUnfunded
              ? "rgba(245,158,11,0.3)"
              : "rgba(255,255,255,0.1)";

            const displayName =
              agent.name.length > 17 ? `${agent.name.slice(0, 16)}...` : agent.name;

            return (
              <g
                key={agent.id}
                onClick={() => handleNodeClick(agent.id)}
                className="cursor-pointer group"
              >
                <rect
                  x={item.x}
                  y={item.y}
                  width={item.w}
                  height={item.h}
                  rx="8"
                  fill="#111113"
                  stroke={strokeColor}
                  strokeWidth={isSelected ? "1.5" : "0.75"}
                  strokeDasharray={isUnfunded ? "3 3" : undefined}
                  className="transition-colors group-hover:stroke-blue-400/80"
                />
                <text
                  x={item.x + item.w / 2}
                  y={item.y + 19}
                  textAnchor="middle"
                  fontSize="11"
                  fill="rgba(255,255,255,0.9)"
                  fontFamily="system-ui"
                  fontWeight="500"
                >
                  {displayName}
                </text>
                <text
                  x={item.x + item.w / 2}
                  y={item.y + 34}
                  textAnchor="middle"
                  fontSize="9"
                  fill={isUnfunded ? "rgba(245,158,11,0.8)" : "rgba(255,255,255,0.4)"}
                  fontFamily="monospace"
                >
                  {isUnfunded
                    ? "Unfunded / Ready"
                    : `${formatMinorUnits(agent.allocatedMinor, currency)} limit`}
                </text>
                <StatusIndicator
                  cx={item.x + item.w - 14}
                  cy={item.y + 12}
                  color={isUnfunded ? "#f59e0b" : "#3b82f6"}
                  pulsing={isUnfunded}
                />
              </g>
            );
          })
        )}
      </svg>
    </div>
  );
}

export function PipelineTicker({
  className = "",
  nodes: propNodes,
  currency: propCurrency,
}: {
  className?: string;
  nodes?: AgentNodeData[];
  currency?: string;
}) {
  const store = useWorkspaceStore();
  const env = store.currentEnvironment;
  const currency = propCurrency ?? env?.currency ?? "USD";
  const nodes = propNodes ?? store.graphNodes;
  const subagentsCount = nodes.filter((n) => n.role === "subagent").length;
  const activeSubagentsCount = nodes.filter((n) => n.role === "subagent" && n.status === "active").length;
  const limitMinor = env?.budgetLimitMinor ?? 0;

  const currentMessage = useMemo(() => {
    if (!env) {
      return "Idle. Listening for next delegated operator event...";
    }
    const envTitle = env.name;
    if (activeSubagentsCount > 0) {
      return `Operational: "${envTitle}" · ${activeSubagentsCount} active subagents (${subagentsCount} total) · ${formatMinorUnits(limitMinor, currency)} total authority`;
    }
    return `Operational: "${envTitle}" · Max delegation depth ≤ 2 verified · ${formatMinorUnits(limitMinor, currency)} total authority`;
  }, [env, limitMinor, currency, subagentsCount, activeSubagentsCount]);

  return (
    <div className={`border-t border-zinc-800/80 px-4 py-2.5 h-[48px] w-full bg-zinc-950/60 ${className}`}>
      <div className="flex gap-2.5 items-center h-full">
        <span className="text-[#0052FF]/80 font-mono text-sm leading-none shrink-0 font-bold">
          ›
        </span>
        <div className="relative flex-1 overflow-hidden h-full flex items-center">
          <div className="font-mono text-[11px] text-zinc-400 truncate">
            {currentMessage}
          </div>
        </div>
      </div>
    </div>
  );
}

export function PipelineStats({
  className = "",
  nodes: propNodes,
  currency: propCurrency,
  totalLimitMinor: propLimit,
  spentMinor: propSpent,
  reservedMinor: propReserved,
}: {
  className?: string;
  nodes?: AgentNodeData[];
  currency?: string;
  totalLimitMinor?: number;
  spentMinor?: number;
  reservedMinor?: number;
}) {
  const store = useWorkspaceStore();
  const env = store.currentEnvironment;
  const currency = propCurrency ?? env?.currency ?? "USD";
  const limitMinor = propLimit ?? env?.budgetLimitMinor ?? 0;
  const spentMinor = propSpent ?? env?.spentMinor ?? 0;
  const reservedMinor = propReserved ?? env?.reservedMinor ?? 0;
  const availableMinor = calculateAvailableMinor(limitMinor, spentMinor, reservedMinor);

  const nodes = propNodes ?? store.graphNodes;
  const workflows = nodes.length;

  return (
    <div className={`border-t border-zinc-800/80 px-4 py-3 flex flex-wrap gap-8 items-center w-full bg-zinc-950/80 ${className}`}>
      <div>
        <div className="text-[9px] text-zinc-500 tracking-[0.09em] mb-[2px]">AGENTS / NODES</div>
        <div className="text-sm font-semibold text-zinc-200 font-mono">
          {workflows.toLocaleString()}
        </div>
      </div>
      <div>
        <div className="text-[9px] text-zinc-500 tracking-[0.09em] mb-[2px]">TOTAL AUTHORITY</div>
        <div className="text-sm font-semibold text-zinc-200 font-mono">
          {formatMinorUnits(limitMinor, currency)}
        </div>
      </div>
      <div>
        <div className="text-[9px] text-zinc-500 tracking-[0.09em] mb-[2px]">AVAILABLE</div>
        <div className="text-sm font-semibold text-blue-400 font-mono">
          {formatMinorUnits(availableMinor, currency)}
        </div>
      </div>
      <div className="ml-auto text-right">
        <div className="text-[9px] text-zinc-500 tracking-[0.09em] mb-[2px]">STACK</div>
        <div className="text-[11px] text-blue-400 font-mono font-medium">PayPal Sandbox · Claude</div>
      </div>
    </div>
  );
}

export interface EnterpriseAIPipelineProps {
  className?: string;
  onSelectNode?: (nodeId: string) => void;
  selectedNodeId?: string | null;
}

export default function EnterpriseAIPipeline({
  className = "",
  onSelectNode,
  selectedNodeId,
}: EnterpriseAIPipelineProps) {
  return (
    <div className={`w-full ${className}`}>
      <PipelineSvg onSelectNode={onSelectNode} selectedNodeId={selectedNodeId} />
    </div>
  );
}
