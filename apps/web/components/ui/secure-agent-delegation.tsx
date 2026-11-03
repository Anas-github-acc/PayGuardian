"use client";

import * as React from "react";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  ShieldCheck,
  Bot,
  Cpu,
  Lock,
  Key,
  CheckCircle2,
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface AgentNodeData {
  id: string;
  name: string;
  role: string;
  tier: string;
  cap: string;
  depth: number;
  keyHash: string;
  scope: string[];
  status: "active" | "delegating" | "guarded";
  isRoot?: boolean;
}

const AGENTS: Record<string, AgentNodeData> = {
  root: {
    id: "root",
    name: "Primary Orchestrator",
    role: "Root Authority Mandate Holder",
    tier: "Tier 0 (Root)",
    cap: "$10,000.00",
    depth: 0,
    keyHash: "ed25519:7f9a...3c21",
    scope: ["*"],
    status: "active",
    isRoot: true,
  },
  travel: {
    id: "travel",
    name: "Travel Specialist",
    role: "Logistics & Procurement",
    tier: "Tier 1 (Specialist)",
    cap: "$4,000.00",
    depth: 1,
    keyHash: "ed25519:4b12...9e87",
    scope: ["flight.search", "flight.book", "itinerary.settle"],
    status: "delegating",
  },
  infra: {
    id: "infra",
    name: "Infra Orchestrator",
    role: "Cloud Compute Procurement",
    tier: "Tier 1 (Specialist)",
    cap: "$3,000.00",
    depth: 1,
    keyHash: "ed25519:1c88...6f44",
    scope: ["cloud.scale", "compute.reserve"],
    status: "active",
  },
  hotel: {
    id: "hotel",
    name: "Hotel Booking Subagent",
    role: "Accommodations Micro-Agent",
    tier: "Tier 2 (Leaf Subagent)",
    cap: "$1,200.00",
    depth: 2,
    keyHash: "ed25519:9d34...1a55",
    scope: ["hotel.search", "hotel.book"],
    status: "guarded",
  },
};

const TICKER_EVENTS = [
  {
    tag: "DELEGATION",
    text: "Root Orchestrator carved $4,000.00 mandate to Travel Specialist",
    hash: "0x8f2a...1b",
    status: "APPROVED",
  },
  {
    tag: "DAG INVARIANT",
    text: "Depth 1 ≤ 2 verification check passed (Cryptographic guarantee)",
    hash: "0x3e91...4c",
    status: "VERIFIED",
  },
  {
    tag: "SUB-DELEGATE",
    text: "Travel Specialist carved $1,200.00 sub-mandate to Hotel Agent",
    hash: "0x5d11...7a",
    status: "BOUNDED",
  },
  {
    tag: "AUTONOMOUS",
    text: "Micro-spend $142.50 auto-settled in 14ms under threshold ($500.00)",
    hash: "0x7a4e...9f",
    status: "EXECUTED",
  },
  {
    tag: "PASSKEY HALT",
    text: "Booking request $850.00 halted: Demanding FIDO2 hardware biometric sign-off",
    hash: "0x2c88...3e",
    status: "HALTED",
  },
  {
    tag: "LEDGER INTEGRITY",
    text: "Double-entry invariant verified: Available ($1,800) + Delegated ($8,200) = $10,000",
    hash: "0x9e12...0a",
    status: "CONSERVED",
  },
];

export function SecureAgentDelegationVisual({ className }: { className?: string }) {
  const [selectedAgent, setSelectedAgent] = useState<string>("root");
  const [tickerIndex, setTickerIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setTickerIndex((prev) => (prev + 1) % TICKER_EVENTS.length);
    }, 3800);
    return () => clearInterval(timer);
  }, []);

  const activeAgent = AGENTS[selectedAgent] || AGENTS.root;
  const currentEvent = TICKER_EVENTS[tickerIndex];

  return (
    <div
      className={cn(
        "relative w-full max-w-[560px] rounded-2xl border border-white/10 bg-[#070709]/95 p-4 sm:p-5 shadow-[0_24px_80px_-20px_rgba(0,0,0,0.9)] backdrop-blur-2xl overflow-hidden select-none",
        className
      )}
    >
      {/* Background Ambience: Subtle Radial Mesh Glow & Dot Grid */}
      <div className="absolute -top-24 -left-24 size-80 rounded-full bg-indigo-500/10 blur-[90px] pointer-events-none" />
      <div className="absolute -bottom-24 -right-24 size-80 rounded-full bg-cyan-500/10 blur-[90px] pointer-events-none" />
      <div
        className="absolute inset-0 bg-[radial-gradient(#27272a_1px,transparent_1px)] [background-size:18px_18px] opacity-40 pointer-events-none"
        style={{
          maskImage: "radial-gradient(ellipse at center, black 65%, transparent 100%)",
          WebkitMaskImage: "radial-gradient(ellipse at center, black 65%, transparent 100%)",
        }}
      />

      {/* Micro-Header Bar: System Title & Invariant Pill */}
      <div className="relative z-10 flex items-center justify-between pb-4 border-b border-white/5 text-xs font-mono">
        <div className="flex items-center gap-2">
          <span className="size-2 rounded-full bg-white/40" />
          <span className="size-2 rounded-full bg-white/20" />
          <span className="size-2 rounded-full bg-white/10" />
          <span className="ml-2 text-white/50 text-[11px] tracking-wide">
            mesh://delegation-dag
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span className="relative flex size-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-indigo-400 opacity-75" />
            <span className="relative inline-flex size-2 rounded-full bg-indigo-500" />
          </span>
          <span className="text-[10px] font-semibold tracking-wider uppercase text-indigo-300/90 bg-indigo-950/40 border border-indigo-500/30 px-2 py-0.5 rounded-full">
            DAG Depth ≤ 2 Bounded
          </span>
        </div>
      </div>

      {/* Main Interactive Diagram: SVG Beams + Node Canvas */}
      <div className="relative z-10 my-4 h-[350px] w-full">
        {/* SVG Delegation Beams with animated glow and traveling particles */}
        <svg
          className="pointer-events-none absolute inset-0 size-full"
          viewBox="0 0 520 350"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            {/* Animated Gradient for Beam 1 (Root -> Travel) */}
            <linearGradient id="beamGrad1" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#818cf8" stopOpacity="0.8" />
              <stop offset="50%" stopColor="#38bdf8" stopOpacity="0.9" />
              <stop offset="100%" stopColor="#818cf8" stopOpacity="0.2" />
            </linearGradient>

            {/* Animated Gradient for Beam 2 (Root -> Infra) */}
            <linearGradient id="beamGrad2" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#818cf8" stopOpacity="0.8" />
              <stop offset="60%" stopColor="#c084fc" stopOpacity="0.9" />
              <stop offset="100%" stopColor="#818cf8" stopOpacity="0.2" />
            </linearGradient>

            {/* Animated Gradient for Beam 3 (Travel -> Hotel) */}
            <linearGradient id="beamGrad3" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.9" />
              <stop offset="70%" stopColor="#34d399" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.2" />
            </linearGradient>
          </defs>

          {/* Background Static Connection Lines */}
          <path
            d="M 260 62 C 260 110, 130 110, 130 155"
            stroke="rgba(255,255,255,0.08)"
            strokeWidth="2"
            strokeDasharray="4 4"
          />
          <path
            d="M 260 62 C 260 110, 390 110, 390 155"
            stroke="rgba(255,255,255,0.08)"
            strokeWidth="2"
            strokeDasharray="4 4"
          />
          <path
            d="M 130 220 C 130 255, 260 255, 260 282"
            stroke="rgba(255,255,255,0.08)"
            strokeWidth="2"
            strokeDasharray="4 4"
          />

          {/* Active Animated Beams with Traveling Pulse */}
          <path
            d="M 260 62 C 260 110, 130 110, 130 155"
            stroke="url(#beamGrad1)"
            strokeWidth="2"
            strokeDasharray="6 8"
            className="animate-agent-flow"
          />
          <path
            d="M 260 62 C 260 110, 390 110, 390 155"
            stroke="url(#beamGrad2)"
            strokeWidth="2"
            strokeDasharray="6 8"
            className="animate-agent-flow"
          />
          <path
            d="M 130 220 C 130 255, 260 255, 260 282"
            stroke="url(#beamGrad3)"
            strokeWidth="2"
            strokeDasharray="6 8"
            className="animate-agent-flow"
          />

          {/* Glowing particle circles tracking along the paths */}
          <circle r="3" fill="#ffffff" filter="drop-shadow(0 0 6px #818cf8)">
            <animateMotion
              path="M 260 62 C 260 110, 130 110, 130 155"
              dur="2.8s"
              repeatCount="indefinite"
            />
          </circle>
          <circle r="3" fill="#ffffff" filter="drop-shadow(0 0 6px #c084fc)">
            <animateMotion
              path="M 260 62 C 260 110, 390 110, 390 155"
              dur="3.2s"
              repeatCount="indefinite"
            />
          </circle>
          <circle r="3" fill="#ffffff" filter="drop-shadow(0 0 6px #34d399)">
            <animateMotion
              path="M 130 220 C 130 255, 260 255, 260 282"
              dur="2.4s"
              repeatCount="indefinite"
            />
          </circle>
        </svg>

        {/* Level 0: Root Orchestrator (Top Center) */}
        <div className="absolute top-1 left-1/2 -translate-x-1/2 w-[240px]">
          <div
            onClick={() => setSelectedAgent("root")}
            className={cn(
              "group relative flex items-center gap-3 rounded-xl border p-2.5 transition-all duration-200 cursor-pointer",
              selectedAgent === "root"
                ? "border-indigo-500/60 bg-indigo-950/40 shadow-[0_0_24px_rgba(99,102,241,0.25)] ring-1 ring-indigo-500/40"
                : "border-white/10 bg-zinc-900/80 hover:border-white/20 hover:bg-zinc-900"
            )}
          >
            <div className="relative flex size-10 shrink-0 items-center justify-center rounded-lg border border-indigo-500/30 bg-indigo-500/10 text-indigo-400">
              <ShieldCheck className="size-5" />
              <span className="absolute -top-1 -right-1 size-2 rounded-full bg-indigo-400 animate-ping" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-xs text-white truncate">
                  Root Orchestrator
                </span>
                <span className="text-[9px] font-mono text-indigo-300 font-semibold bg-indigo-500/20 px-1.5 py-0.2 rounded">
                  $10k Cap
                </span>
              </div>
              <div className="mt-0.5 flex items-center gap-1.5 font-mono text-[10px] text-zinc-400">
                <Key className="size-3 text-zinc-500" />
                <span className="truncate">Depth 0 · Sovereign Root</span>
              </div>
            </div>
          </div>
        </div>

        {/* Level 1: Travel Specialist (Middle Left) */}
        <div className="absolute top-[138px] left-2 w-[205px]">
          <div
            onClick={() => setSelectedAgent("travel")}
            className={cn(
              "group relative flex items-center gap-2.5 rounded-xl border p-2.5 transition-all duration-200 cursor-pointer",
              selectedAgent === "travel"
                ? "border-sky-500/60 bg-sky-950/40 shadow-[0_0_24px_rgba(56,189,248,0.25)] ring-1 ring-sky-500/40"
                : "border-white/10 bg-zinc-900/80 hover:border-white/20 hover:bg-zinc-900"
            )}
          >
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-sky-500/30 bg-sky-500/10 text-sky-400">
              <Bot className="size-4" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-xs text-white truncate">
                  Travel Agent
                </span>
                <span className="text-[9px] font-mono text-sky-300 font-semibold bg-sky-500/20 px-1 py-0.2 rounded">
                  $4,000
                </span>
              </div>
              <div className="mt-0.5 flex items-center gap-1 font-mono text-[9px] text-zinc-400">
                <span>Depth 1 · Sub-mandate</span>
              </div>
            </div>
          </div>
        </div>

        {/* Level 1: Compute / Infra Agent (Middle Right) */}
        <div className="absolute top-[138px] right-2 w-[205px]">
          <div
            onClick={() => setSelectedAgent("infra")}
            className={cn(
              "group relative flex items-center gap-2.5 rounded-xl border p-2.5 transition-all duration-200 cursor-pointer",
              selectedAgent === "infra"
                ? "border-purple-500/60 bg-purple-950/40 shadow-[0_0_24px_rgba(192,132,252,0.25)] ring-1 ring-purple-500/40"
                : "border-white/10 bg-zinc-900/80 hover:border-white/20 hover:bg-zinc-900"
            )}
          >
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-purple-500/30 bg-purple-500/10 text-purple-400">
              <Cpu className="size-4" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-xs text-white truncate">
                  Infra Agent
                </span>
                <span className="text-[9px] font-mono text-purple-300 font-semibold bg-purple-500/20 px-1 py-0.2 rounded">
                  $3,000
                </span>
              </div>
              <div className="mt-0.5 flex items-center gap-1 font-mono text-[9px] text-zinc-400">
                <span>Depth 1 · Auto &lt; $500</span>
              </div>
            </div>
          </div>
        </div>

        {/* Level 2: Hotel Booking Subagent (Bottom Center) */}
        <div className="absolute bottom-1 left-1/2 -translate-x-1/2 w-[235px]">
          <div
            onClick={() => setSelectedAgent("hotel")}
            className={cn(
              "group relative flex items-center gap-2.5 rounded-xl border p-2.5 transition-all duration-200 cursor-pointer",
              selectedAgent === "hotel"
                ? "border-emerald-500/60 bg-emerald-950/40 shadow-[0_0_24px_rgba(52,211,153,0.25)] ring-1 ring-emerald-500/40"
                : "border-white/10 bg-zinc-900/80 hover:border-white/20 hover:bg-zinc-900"
            )}
          >
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-emerald-400">
              <Lock className="size-4" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-xs text-white truncate">
                  Hotel Subagent
                </span>
                <span className="text-[9px] font-mono text-emerald-300 font-semibold bg-emerald-500/20 px-1.5 py-0.2 rounded">
                  $1,200
                </span>
              </div>
              <div className="mt-0.5 flex items-center gap-1.5 font-mono text-[9px] text-zinc-400">
                <CheckCircle2 className="size-3 text-emerald-400" />
                <span>Depth 2 (Hard Invariant Limit)</span>
              </div>
            </div>
          </div>
        </div>

        {/* Floating Policy Gate Indicators on Beams */}
        <div className="pointer-events-none absolute top-[94px] left-[155px] -translate-x-1/2 rounded-full border border-sky-500/30 bg-black/80 px-2 py-0.5 text-[8px] font-mono text-sky-300 backdrop-blur-md">
          Mandate: $4k ✓
        </div>
        <div className="pointer-events-none absolute top-[94px] right-[155px] translate-x-1/2 rounded-full border border-purple-500/30 bg-black/80 px-2 py-0.5 text-[8px] font-mono text-purple-300 backdrop-blur-md">
          Mandate: $3k ✓
        </div>
        <div className="pointer-events-none absolute bottom-[68px] left-[175px] rounded-full border border-emerald-500/30 bg-black/80 px-2 py-0.5 text-[8px] font-mono text-emerald-300 backdrop-blur-md">
          Child Cap ≤ Parent Cap ✓
        </div>
      </div>

      {/* Selected Node Cryptographic Telemetry Inspector Card */}
      <div className="relative z-10 mt-3 rounded-xl border border-white/10 bg-black/60 p-3 backdrop-blur-md">
        <div className="flex items-center justify-between pb-2 border-b border-white/5">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono uppercase tracking-wider text-white/50">
              Selected Identity:
            </span>
            <span className="text-xs font-semibold text-white">
              {activeAgent.name}
            </span>
          </div>
          <span className="text-[10px] font-mono text-white/70 bg-white/5 px-2 py-0.5 rounded">
            {activeAgent.tier}
          </span>
        </div>

        <div className="grid grid-cols-3 gap-2 pt-2.5 text-[11px] font-mono">
          <div>
            <span className="text-[9px] text-white/40 uppercase block">Spending Ceiling</span>
            <span className="text-white font-medium">{activeAgent.cap}</span>
          </div>
          <div>
            <span className="text-[9px] text-white/40 uppercase block">DAG Depth</span>
            <span className="text-white font-medium">Level {activeAgent.depth} of 2</span>
          </div>
          <div>
            <span className="text-[9px] text-white/40 uppercase block">Cryptographic Key</span>
            <span className="text-white/80 truncate block">{activeAgent.keyHash}</span>
          </div>
        </div>

        <div className="mt-2.5 flex items-center gap-1.5 flex-wrap pt-2 border-t border-white/5">
          <span className="text-[9px] font-mono text-white/40 uppercase mr-1">Permitted:</span>
          {activeAgent.scope.map((s, idx) => (
            <span
              key={idx}
              className="text-[9px] font-mono text-white/70 bg-white/5 border border-white/5 px-1.5 py-0.5 rounded"
            >
              {s}
            </span>
          ))}
        </div>
      </div>

      {/* Live Real-Time Verification Event Ticker */}
      <div className="relative z-10 mt-3 flex items-center justify-between rounded-lg border border-white/5 bg-zinc-950/70 px-3 py-2 text-[10px] font-mono text-zinc-400">
        <div className="flex items-center gap-2 truncate">
          <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span className="font-semibold text-white uppercase text-[9px] bg-white/10 px-1 py-0.5 rounded">
            {currentEvent.tag}
          </span>
          <AnimatePresence mode="wait">
            <motion.span
              key={tickerIndex}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.25 }}
              className="truncate text-zinc-300"
            >
              {currentEvent.text}
            </motion.span>
          </AnimatePresence>
        </div>

        <span className="text-zinc-500 shrink-0 ml-2 hidden sm:inline">
          {currentEvent.status}
        </span>
      </div>
    </div>
  );
}

export default SecureAgentDelegationVisual;
