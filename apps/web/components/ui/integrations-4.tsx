"use client";

import * as React from "react";
import { useId } from "react";
import { cn } from "@/lib/utils";

type Cell = {
  row: number;
  col: number;
};

type AgentType = {
  name: string;
  isOrchestrator?: boolean;
};

type TileData = Cell & {
  agent?: AgentType;
};

// A delegation from one agent to another. Both tiles sit in the same row or
// column, two cells apart, so the link crosses the empty cell between them.
type LinkData = {
  from: Cell;
  to: Cell;
};

const CELL = 72; // 72px cell, matches size-18
const HALF = CELL / 2;
const GRID = CELL * 5; // 5x5 grid
const PAD = 6; // breathing room between a tile and a link
const ARROW_ID = "agent-delegation-arrow";

export interface IntegrationsProps {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  ctaPrimary?: React.ReactNode;
  ctaSecondary?: React.ReactNode;
  className?: string;
}

export function Integrations({
  title = "Seamless Integration",
  subtitle = "Integrate with over 100+ tools and platforms to streamline your workflow and boost productivity.",
  ctaPrimary,
  ctaSecondary,
  className,
}: IntegrationsProps = {}) {
  return (
    <div
      className={cn(
        "mx-auto grid max-w-5xl grid-cols-1 gap-12 p-4 md:grid-cols-2 md:items-center",
        className,
      )}
    >
      {/* Left Content */}
      <div className="max-w-xl space-y-5">
        <h2 className="font-medium text-3xl text-foreground tracking-tight sm:text-4xl md:text-5xl">
          {title}
        </h2>
        <p className="text-lg text-muted-foreground leading-8">{subtitle}</p>
        {(ctaPrimary || ctaSecondary) && (
          <div className="flex flex-wrap items-center gap-3.5 pt-2">
            {ctaPrimary}
            {ctaSecondary}
          </div>
        )}
      </div>

      {/* Right Content - Visual */}
      <div className="flex justify-center md:place-items-end">
        <div className="mask-radial-gradient relative size-90 overflow-hidden">
          {tiles.map((tile) => (
            <AgentTile key={`${tile.row}_${tile.col}`} {...tile} />
          ))}
          <DelegationLayer />
        </div>
      </div>
    </div>
  );
}

function AgentTile({ row, col, agent }: TileData) {
  const position = { left: col * CELL, top: row * CELL };

  return (
    <>
      {agent?.isOrchestrator && (
        <div
          aria-hidden="true"
          className="absolute size-18 rounded-md bg-indigo-500/40 blur-xl"
          style={position}
        />
      )}
      <div
        aria-label={agent?.name}
        className={cn(
          "absolute flex size-18 items-center justify-center rounded-md border",
          !agent && "bg-secondary/30 dark:bg-background", // Styling for empty tiles
          agent &&
            !agent.isOrchestrator &&
            "bg-card shadow-[0_3px_0_0_var(--border)] dark:bg-card/60",
          agent?.isOrchestrator &&
            "border-indigo-500/50 bg-indigo-500/15 shadow-[0_3px_0_0] shadow-indigo-700/60",
        )}
        role={agent ? "img" : undefined}
        style={position}
      >
        {agent && (
          <AgentIcon
            className={cn(
              "pointer-events-none size-9 select-none",
              agent.isOrchestrator ? "text-indigo-600 dark:text-indigo-200" : "text-foreground",
            )}
          />
        )}
      </div>
    </>
  );
}

// Standard agent icon (robot head). The eyes and mouth are cut out with a mask,
// so the icon works on any tile color and follows currentColor.
function AgentIcon({ className }: { className?: string }) {
  const maskId = `agent-${useId().replace(/:/g, "")}`;

  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="currentColor"
      viewBox="-25 -28 50 44"
      xmlns="http://www.w3.org/2000/svg"
    >
      <mask id={maskId}>
        <rect fill="white" height="44" width="50" x="-25" y="-28" />
        <circle cx="-6.5" cy="-1" fill="black" r="3.3" />
        <circle cx="6.5" cy="-1" fill="black" r="3.3" />
        <rect fill="black" height="2.6" rx="1.3" width="11" x="-5.5" y="6.5" />
      </mask>
      <g mask={`url(#${maskId})`}>
        <rect height="9" rx="1.5" width="3" x="-1.5" y="-21" />
        <circle cy="-23" r="3.4" />
        <rect height="13" rx="2.25" width="4.5" x="-23" y="-6" />
        <rect height="13" rx="2.25" width="4.5" x="18.5" y="-6" />
        <rect height="27" rx="8.5" width="34" x="-17" y="-13" />
      </g>
    </svg>
  );
}

// Dashed delegation arrows plus a trust shield on every handoff.
function DelegationLayer() {
  return (
    <svg
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 size-full"
      viewBox={`0 0 ${GRID} ${GRID}`}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <marker
          id={ARROW_ID}
          markerHeight="8"
          markerUnits="userSpaceOnUse"
          markerWidth="8"
          orient="auto"
          refX="8"
          refY="5"
          viewBox="0 0 10 10"
        >
          <path
            className="fill-indigo-500 stroke-indigo-500 dark:fill-indigo-400 dark:stroke-indigo-400"
            d="M1.5 1.5L9 5 1.5 8.5Z"
            strokeLinejoin="round"
            strokeWidth="1.5"
          />
        </marker>
      </defs>

      {links.map((link) => {
        const { start, end } = getLinkGeometry(link);
        return (
          <path
            className="animate-agent-flow stroke-indigo-500 motion-reduce:animate-none dark:stroke-indigo-400"
            d={`M${start.x} ${start.y}L${end.x} ${end.y}`}
            fill="none"
            key={`${link.from.row}_${link.from.col}-${link.to.row}_${link.to.col}`}
            markerEnd={`url(#${ARROW_ID})`}
            strokeDasharray="5 6"
            strokeLinecap="round"
            strokeWidth="2"
          />
        );
      })}

      {links.map((link) => {
        const { mid } = getLinkGeometry(link);
        return (
          <TrustShield
            key={`shield_${link.from.row}_${link.from.col}-${link.to.row}_${link.to.col}`}
            x={mid.x}
            y={mid.y}
          />
        );
      })}
    </svg>
  );
}

function TrustShield({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <circle className="fill-white/10 dark:fill-white/15 backdrop-blur-sm" r="15" />
      <g transform="scale(.95)">
        <path
          className="fill-card stroke-foreground/80 dark:stroke-white/90"
          d="M0-13L11-9V0C11 7 6 11.5 0 14C-6 11.5-11 7-11 0V-9Z"
          strokeLinejoin="round"
          strokeWidth="2"
        />
        <path
          className="stroke-foreground dark:stroke-white"
          d="M-4.5 0L-1 3.5 5-4"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2.4"
        />
      </g>
    </g>
  );
}

function getLinkGeometry({ from, to }: LinkData) {
  const a = { x: from.col * CELL + HALF, y: from.row * CELL + HALF };
  const b = { x: to.col * CELL + HALF, y: to.row * CELL + HALF };
  const dx = Math.sign(b.x - a.x);
  const dy = Math.sign(b.y - a.y);

  return {
    start: { x: a.x + dx * (HALF + PAD), y: a.y + dy * (HALF + PAD) },
    end: { x: b.x - dx * (HALF + PAD), y: b.y - dy * (HALF + PAD) },
    mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
  };
}

// Coordinate mapping to approximate the "scattered" look in the image.
// Grid 5x5. Same tile positions as the original logo layout.
const tiles: TileData[] = [
  // Row 0
  { row: 0, col: 1 }, // Empty
  { row: 0, col: 3, agent: { name: "Research agent" } },

  // Row 1
  { row: 1, col: 0 }, // Empty
  { row: 1, col: 2, agent: { name: "Planner agent" } },
  { row: 1, col: 4, agent: { name: "Writer agent" } },

  // Row 2
  { row: 2, col: 1, agent: { name: "Coding agent" } },
  { row: 2, col: 3, agent: { name: "Orchestrator agent", isOrchestrator: true } },

  // Row 3
  { row: 3, col: 0 }, // Empty
  { row: 3, col: 2, agent: { name: "Reviewer agent" } },
  { row: 3, col: 4, agent: { name: "Editor agent" } },

  // Row 4
  { row: 4, col: 1, agent: { name: "Testing agent" } },
  { row: 4, col: 3, agent: { name: "Support agent" } },
];

// Delegations, from delegator to delegate. Each one crosses the empty cell
// between two tiles, which is where its trust shield sits.
const links: LinkData[] = [
  { from: { row: 2, col: 3 }, to: { row: 0, col: 3 } },
  { from: { row: 2, col: 3 }, to: { row: 4, col: 3 } },
  { from: { row: 4, col: 3 }, to: { row: 4, col: 1 } },
  { from: { row: 4, col: 1 }, to: { row: 2, col: 1 } },
  { from: { row: 1, col: 2 }, to: { row: 3, col: 2 } },
  { from: { row: 1, col: 4 }, to: { row: 3, col: 4 } },
];

export default Integrations;
