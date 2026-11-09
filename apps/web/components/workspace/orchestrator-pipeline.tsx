"use client";

import * as React from "react";
import { useMemo } from "react";
import { motion } from "framer-motion";
import { useWorkspaceStore, workspaceStore } from "../../app/lib/workspace-store";
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
}

export function PipelineSvg({
  className = "",
  onSelectNode,
  selectedNodeId,
}: PipelineSvgProps) {
  const store = useWorkspaceStore();
  const env = store.currentEnvironment;
  const currency = env?.currency ?? "USD";
  const activeId = selectedNodeId ?? store.selectedNodeId ?? "orchestrator-root";

  const nodes = store.graphNodes;
  const rootNode = useMemo(
    () => nodes.find((n) => n.role === "orchestrator" || n.id === "orchestrator-root") || nodes[0],
    [nodes]
  );
  const childAgents = useMemo(
    () => nodes.filter((n) => n.id !== (rootNode?.id ?? "orchestrator-root")),
    [nodes, rootNode]
  );

  const handleNodeClick = (nodeId: string) => {
    workspaceStore.setSelectedNodeId(nodeId);
    onSelectNode?.(nodeId);
  };

  const pTriggerToGateway = "M140,90 L180,90";
  const pGatewayToOrch = "M306,90 L346,90";

  // Dynamic positions for child subagents
  const childPositions = useMemo(() => {
    if (childAgents.length === 1) {
      return [{ x: 550, y: 65, w: 160, h: 50, path: "M490,90 L550,90" }];
    }
    if (childAgents.length === 2) {
      return [
        { x: 550, y: 22, w: 160, h: 48, path: "M490,90 C520,90 520,46 550,46" },
        { x: 550, y: 110, w: 160, h: 48, path: "M490,90 C520,90 520,134 550,134" },
      ];
    }
    if (childAgents.length === 3) {
      return [
        { x: 540, y: 16, w: 145, h: 48, path: "M490,90 C515,90 515,40 540,40" },
        { x: 540, y: 116, w: 145, h: 48, path: "M490,90 C515,90 515,140 540,140" },
        { x: 720, y: 66, w: 145, h: 48, path: "M490,90 L720,90" },
      ];
    }
    return [
      { x: 540, y: 16, w: 140, h: 48, path: "M490,90 C515,90 515,40 540,40" },
      { x: 540, y: 116, w: 140, h: 48, path: "M490,90 C515,90 515,140 540,140" },
      { x: 710, y: 16, w: 140, h: 48, path: "M680,40 L710,40" },
      { x: 710, y: 116, w: 140, h: 48, path: "M680,140 L710,140" },
    ];
  }, [childAgents.length]);

  return (
    <div className={`w-full py-2 ${className}`}>
      <svg
        width="100%"
        viewBox="0 0 910 180"
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

        {/* Animated Traveling Signal Dots */}
        <AnimatedDot path={pTriggerToGateway} duration={1.1} delay={0} size={2.5} opacity={1} />
        <AnimatedDot path={pGatewayToOrch} duration={0.9} delay={0.2} size={2.5} opacity={1} />

        {/* Dynamic Connection Paths for Child Subagents */}
        {childAgents.length === 0 ? (
          <path
            d="M490,90 L550,90"
            fill="none"
            stroke="rgba(255,255,255,0.15)"
            strokeWidth="1.5"
            strokeDasharray="3 5"
          />
        ) : (
          childAgents.map((agent, idx) => {
            const pos = childPositions[idx] || childPositions[childPositions.length - 1];
            const isSelected = activeId === agent.id;
            const isUnfunded = agent.status === "unfunded" || (agent.allocatedMinor ?? 0) === 0;
            const strokeColor = isUnfunded
              ? "rgba(245,158,11,0.4)"
              : isSelected
              ? "rgba(0,82,255,0.8)"
              : "rgba(0,82,255,0.25)";
            return (
              <React.Fragment key={`path-${agent.id}`}>
                <path
                  d={pos.path}
                  fill="none"
                  stroke={strokeColor}
                  strokeWidth="1.5"
                  strokeDasharray="3 5"
                  markerEnd={isUnfunded ? "url(#orangeArrow)" : "url(#blueArrow)"}
                />
                <AnimatedDot
                  path={pos.path}
                  duration={1.2}
                  delay={0.1 + idx * 0.25}
                  size={2.2}
                  opacity={isUnfunded ? 0.75 : 0.9}
                  color={isUnfunded ? "#f59e0b" : "#0052FF"}
                />
              </React.Fragment>
            );
          })
        )}

        {/* ─── NODE 1: Trigger / Operator Mandate ─── */}
        <g
          onClick={() => handleNodeClick("orchestrator-root")}
          className="cursor-pointer group"
        >
          <rect
            x="24"
            y="65"
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
            y="81"
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
            y="97"
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
            y="108"
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
            y="65"
            width="126"
            height="50"
            rx="8"
            fill="#141414"
            stroke="rgba(255,255,255,0.12)"
            strokeWidth="0.5"
          />
          <text
            x="243"
            y="81"
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
            y="97"
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
            y="108"
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
          onClick={() => handleNodeClick("orchestrator-root")}
          className="cursor-pointer group"
        >
          <rect
            x="346"
            y="52"
            width="144"
            height="76"
            rx="10"
            fill="#050D1C"
            stroke={activeId === "orchestrator-root" ? "#3b82f6" : "#0052FF"}
            strokeWidth={activeId === "orchestrator-root" ? "1.8" : "1"}
            className="transition-all group-hover:stroke-blue-400"
          />
          <rect x="378" y="52.5" width="80" height="1" rx="0.5" fill="rgba(51,117,255,0.6)" />
          <text
            x="418"
            y="72"
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
            y="90"
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
            y="103"
            textAnchor="middle"
            fontSize="9"
            fill="rgba(0,82,255,0.9)"
            fontFamily="monospace"
            fontWeight="500"
          >
            {formatMinorUnits(rootNode?.allocatedMinor ?? env?.budgetLimitMinor ?? 0, currency)}
          </text>
          <PulsingDot cx={406} cy={116} color="#0052FF" duration={1.2} delay={0} />
          <PulsingDot cx={418} cy={116} color="#0052FF" duration={1.2} delay={0.4} />
          <PulsingDot cx={430} cy={116} color="#0052FF" duration={1.2} delay={0.8} />
        </g>

        {/* Dynamic Child Subagents Rendering */}
        {childAgents.length === 0 ? (
          <g className="cursor-default">
            <rect
              x="550"
              y="65"
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
              y="86"
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
              y="102"
              textAnchor="middle"
              fontSize="8.5"
              fill="rgba(255,255,255,0.25)"
              fontFamily="system-ui"
            >
              Subagents appear upon task delegation
            </text>
          </g>
        ) : (
          childAgents.map((agent, idx) => {
            const pos = childPositions[idx] || childPositions[childPositions.length - 1];
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
                  x={pos.x}
                  y={pos.y}
                  width={pos.w}
                  height={pos.h}
                  rx="8"
                  fill="#111113"
                  stroke={strokeColor}
                  strokeWidth={isSelected ? "1.5" : "0.75"}
                  strokeDasharray={isUnfunded ? "3 3" : undefined}
                  className="transition-colors group-hover:stroke-blue-400/80"
                />
                <text
                  x={pos.x + pos.w / 2}
                  y={pos.y + 19}
                  textAnchor="middle"
                  fontSize="11"
                  fill="rgba(255,255,255,0.9)"
                  fontFamily="system-ui"
                  fontWeight="500"
                >
                  {displayName}
                </text>
                <text
                  x={pos.x + pos.w / 2}
                  y={pos.y + 34}
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
                  cx={pos.x + pos.w - 14}
                  cy={pos.y + 12}
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

export function PipelineTicker({ className = "" }: { className?: string }) {
  const store = useWorkspaceStore();
  const env = store.currentEnvironment;
  const currency = env?.currency ?? "USD";
  const nodes = store.graphNodes;
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

export function PipelineStats({ className = "" }: { className?: string }) {
  const store = useWorkspaceStore();
  const env = store.currentEnvironment;
  const currency = env?.currency ?? "USD";
  const limitMinor = env?.budgetLimitMinor ?? 0;
  const spentMinor = env?.spentMinor ?? 0;
  const reservedMinor = env?.reservedMinor ?? 0;
  const availableMinor = calculateAvailableMinor(limitMinor, spentMinor, reservedMinor);

  const workflows = store.graphNodes.length;

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
