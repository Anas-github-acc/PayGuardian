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
    () => nodes.find((n) => n.role === "orchestrator" || n.id === "orchestrator-root"),
    [nodes]
  );
  const travelAgent = useMemo(() => nodes.find((n) => n.id === "agent-travel"), [nodes]);
  const hotelAgent = useMemo(() => nodes.find((n) => n.id === "agent-hotel"), [nodes]);
  const flightScraper = useMemo(
    () => nodes.find((n) => n.id === "agent-flights-unfunded"),
    [nodes]
  );
  const bookingGw = useMemo(() => nodes.find((n) => n.id === "agent-booking-gw"), [nodes]);

  const handleNodeClick = (nodeId: string) => {
    workspaceStore.setSelectedNodeId(nodeId);
    onSelectNode?.(nodeId);
  };

  const paths = {
    pTriggerToGateway: "M140,90 L180,90",
    pGatewayToOrch: "M306,90 L346,90",
    pOrchToTravel: "M490,90 C520,90 520,40 550,40",
    pOrchToHotel: "M490,90 C520,90 520,140 550,140",
    pTravelToScraper: "M694,40 L734,40",
    pHotelToBooking: "M694,140 L734,140",
  };

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
          d={paths.pTriggerToGateway}
          fill="none"
          stroke="rgba(0,82,255,0.22)"
          strokeWidth="1.5"
          strokeDasharray="3 5"
          markerEnd="url(#blueArrow)"
        />

        {/* 2. Connection Path: Gateway -> Orchestrator */}
        <path
          d={paths.pGatewayToOrch}
          fill="none"
          stroke="rgba(0,82,255,0.22)"
          strokeWidth="1.5"
          strokeDasharray="3 5"
          markerEnd="url(#blueArrow)"
        />

        {/* 3. Connection Path: Orchestrator -> Travel Agent */}
        <path
          d={paths.pOrchToTravel}
          fill="none"
          stroke={activeId === "agent-travel" ? "rgba(0,82,255,0.7)" : "rgba(0,82,255,0.22)"}
          strokeWidth="1.5"
          strokeDasharray="3 5"
        />

        {/* 4. Connection Path: Orchestrator -> Hotel Agent */}
        <path
          d={paths.pOrchToHotel}
          fill="none"
          stroke={activeId === "agent-hotel" ? "rgba(0,82,255,0.7)" : "rgba(0,82,255,0.22)"}
          strokeWidth="1.5"
          strokeDasharray="3 5"
        />

        {/* 5. Connection Path: Travel Agent -> Flight Scraper (Unfunded structural helper) */}
        <path
          d={paths.pTravelToScraper}
          fill="none"
          stroke="rgba(245,158,11,0.3)"
          strokeWidth="1.5"
          strokeDasharray="4 4"
          markerEnd="url(#orangeArrow)"
        />

        {/* 6. Connection Path: Hotel Agent -> Booking Gateway */}
        <path
          d={paths.pHotelToBooking}
          fill="none"
          stroke="rgba(0,82,255,0.25)"
          strokeWidth="1.5"
          strokeDasharray="3 5"
          markerEnd="url(#blueArrow)"
        />

        {/* Animated Traveling Signal Dots */}
        <AnimatedDot path={paths.pTriggerToGateway} duration={1.1} delay={0} size={2.5} opacity={1} />
        <AnimatedDot path={paths.pGatewayToOrch} duration={0.9} delay={0.2} size={2.5} opacity={1} />
        
        <AnimatedDot path={paths.pOrchToTravel} duration={1.2} delay={0.1} size={2.2} opacity={0.9} />
        <AnimatedDot path={paths.pOrchToTravel} duration={1.2} delay={0.65} size={1.5} opacity={0.55} />

        <AnimatedDot path={paths.pOrchToHotel} duration={1.2} delay={0.3} size={2.2} opacity={0.9} />
        <AnimatedDot path={paths.pOrchToHotel} duration={1.2} delay={0.85} size={1.5} opacity={0.55} />

        <AnimatedDot
          path={paths.pTravelToScraper}
          duration={1.4}
          delay={0.4}
          size={2.2}
          opacity={0.85}
          color="#f59e0b"
        />
        <AnimatedDot path={paths.pHotelToBooking} duration={1.1} delay={0.5} size={2.2} opacity={0.9} />

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
            {formatMinorUnits(rootNode?.allocatedMinor ?? 1000000, currency)}
          </text>
          <PulsingDot cx={406} cy={116} color="#0052FF" duration={1.2} delay={0} />
          <PulsingDot cx={418} cy={116} color="#0052FF" duration={1.2} delay={0.4} />
          <PulsingDot cx={430} cy={116} color="#0052FF" duration={1.2} delay={0.8} />
        </g>

        {/* ─── NODE 4: Travel Subagent ─── */}
        <g
          onClick={() => handleNodeClick("agent-travel")}
          className="cursor-pointer group"
        >
          <rect
            x="550"
            y="16"
            width="144"
            height="48"
            rx="8"
            fill="#111113"
            stroke={activeId === "agent-travel" ? "#3b82f6" : "rgba(255,255,255,0.1)"}
            strokeWidth={activeId === "agent-travel" ? "1.5" : "0.5"}
            className="transition-colors group-hover:stroke-blue-400/80"
          />
          <text
            x="620"
            y="35"
            textAnchor="middle"
            fontSize="11"
            fill="rgba(255,255,255,0.9)"
            fontFamily="system-ui"
            fontWeight="500"
          >
            {travelAgent?.name ?? "Travel Agent"}
          </text>
          <text
            x="620"
            y="50"
            textAnchor="middle"
            fontSize="9"
            fill="rgba(255,255,255,0.4)"
            fontFamily="monospace"
          >
            {formatMinorUnits(travelAgent?.allocatedMinor ?? 400000, currency)} limit
          </text>
          <StatusIndicator cx={678} cy={28} color="#3b82f6" />
        </g>

        {/* ─── NODE 5: Flight Scraper (Structural Helper · Unfunded) ─── */}
        <g
          onClick={() => handleNodeClick("agent-flights-unfunded")}
          className="cursor-pointer group"
        >
          <rect
            x="734"
            y="16"
            width="150"
            height="48"
            rx="8"
            fill="#111113"
            stroke={
              activeId === "agent-flights-unfunded"
                ? "#f59e0b"
                : "rgba(245,158,11,0.3)"
            }
            strokeDasharray="3 3"
            strokeWidth={activeId === "agent-flights-unfunded" ? "1.5" : "0.8"}
            className="transition-colors group-hover:stroke-orange-400"
          />
          <text
            x="806"
            y="35"
            textAnchor="middle"
            fontSize="11"
            fill="rgba(255,255,255,0.85)"
            fontFamily="system-ui"
            fontWeight="500"
          >
            {flightScraper?.name ?? "Flight Scraper"}
          </text>
          <text
            x="806"
            y="50"
            textAnchor="middle"
            fontSize="9"
            fill="rgba(245,158,11,0.8)"
            fontFamily="monospace"
          >
            Unfunded Helper
          </text>
          <StatusIndicator cx={868} cy={28} color="#f59e0b" pulsing duration={2.1} />
        </g>

        {/* ─── NODE 6: Hotel Subagent ─── */}
        <g
          onClick={() => handleNodeClick("agent-hotel")}
          className="cursor-pointer group"
        >
          <rect
            x="550"
            y="116"
            width="144"
            height="48"
            rx="8"
            fill="#111113"
            stroke={activeId === "agent-hotel" ? "#3b82f6" : "rgba(255,255,255,0.1)"}
            strokeWidth={activeId === "agent-hotel" ? "1.5" : "0.5"}
            className="transition-colors group-hover:stroke-blue-400/80"
          />
          <text
            x="620"
            y="135"
            textAnchor="middle"
            fontSize="11"
            fill="rgba(255,255,255,0.9)"
            fontFamily="system-ui"
            fontWeight="500"
          >
            {hotelAgent?.name ?? "Hotel Agent"}
          </text>
          <text
            x="620"
            y="150"
            textAnchor="middle"
            fontSize="9"
            fill="rgba(255,255,255,0.4)"
            fontFamily="monospace"
          >
            {formatMinorUnits(hotelAgent?.allocatedMinor ?? 400000, currency)} limit
          </text>
          <StatusIndicator cx={678} cy={128} color="#3b82f6" />
        </g>

        {/* ─── NODE 7: Booking Gateway ─── */}
        <g
          onClick={() => handleNodeClick("agent-booking-gw")}
          className="cursor-pointer group"
        >
          <rect
            x="734"
            y="116"
            width="150"
            height="48"
            rx="8"
            fill="#111113"
            stroke={activeId === "agent-booking-gw" ? "#3b82f6" : "rgba(255,255,255,0.1)"}
            strokeWidth={activeId === "agent-booking-gw" ? "1.5" : "0.5"}
            className="transition-colors group-hover:stroke-blue-400/80"
          />
          <text
            x="806"
            y="135"
            textAnchor="middle"
            fontSize="11"
            fill="rgba(255,255,255,0.9)"
            fontFamily="system-ui"
            fontWeight="500"
          >
            {bookingGw?.name ?? "Booking Gateway"}
          </text>
          <text
            x="806"
            y="150"
            textAnchor="middle"
            fontSize="9"
            fill="rgba(255,255,255,0.4)"
            fontFamily="monospace"
          >
            {formatMinorUnits(bookingGw?.allocatedMinor ?? 100000, currency)} limit
          </text>
          <StatusIndicator cx={868} cy={128} color="#3b82f6" pulsing duration={1.8} delay={0.3} />
        </g>
      </svg>
    </div>
  );
}

export function PipelineTicker({ className = "" }: { className?: string }) {
  const store = useWorkspaceStore();
  const env = store.currentEnvironment;
  const currency = env?.currency ?? "USD";
  const nodes = store.graphNodes;
  const subagentsCount = nodes.filter((n) => n.role === "subagent").length || 4;
  const activeSubagentsCount = nodes.filter((n) => n.role === "subagent" && n.status === "active").length || 2;
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

  const workflows = store.graphNodes.length > 0 ? store.graphNodes.length : (env?.agentCount ?? 0);

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
