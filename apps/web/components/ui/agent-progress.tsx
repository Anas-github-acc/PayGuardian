"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

const GRID_CELLS = [
  { id: "top-left", delay: 0, shade: "bg-[#D0785A]" },
  { id: "top-center", delay: 0.14, shade: "bg-[#D0785A]/90" },
  { id: "top-right", delay: 0.28, shade: "bg-[#D0785A]/75" },
  { id: "middle-left", delay: 0.42, shade: "bg-[#D0785A]/90" },
  { id: "middle-center", delay: 0.56, shade: "bg-[#D0785A]/75" },
  { id: "middle-right", delay: 0.7, shade: "bg-[#D0785A]/60" },
  { id: "bottom-left", delay: 0.84, shade: "bg-[#D0785A]/75" },
  { id: "bottom-center", delay: 0.98, shade: "bg-[#D0785A]/60" },
  { id: "bottom-right", delay: 1.12, shade: "bg-[#D0785A]/40" },
];

export interface AgentProgressProps {
  /** Verb describing the agent's current activity. */
  label?: string;
  /** Controlled elapsed time in seconds. */
  elapsedSeconds?: number;
  /** Starting time for the internal timer, in seconds. */
  initialSeconds?: number;
  /** Whether the internal timer should advance. Ignored when elapsedSeconds is provided. */
  running?: boolean;
  className?: string;
}

function formatElapsed(totalSeconds: number) {
  const safeSeconds = Math.max(0, totalSeconds);
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = (safeSeconds % 60).toFixed(1);
  return minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
}

export function AgentProgress({
  label = "Churning",
  elapsedSeconds,
  initialSeconds = 0,
  running = true,
  className,
}: AgentProgressProps) {
  const [internalSeconds, setInternalSeconds] = useState(initialSeconds);

  useEffect(() => {
    if (elapsedSeconds !== undefined || !running) return;

    const startedAt = performance.now() - initialSeconds * 1000;
    const timer = window.setInterval(() => {
      setInternalSeconds((performance.now() - startedAt) / 1000);
    }, 100);

    return () => window.clearInterval(timer);
  }, [elapsedSeconds, initialSeconds, running]);

  const elapsed = elapsedSeconds ?? internalSeconds;

  return (
    <span
      role="status"
      aria-label={`${label}, in progress`}
      className={cn(
        "inline-flex items-center gap-2.5 font-mono text-xs text-zinc-300 bg-transparent select-none",
        className,
      )}
    >
      <span aria-hidden="true" className="grid size-4 shrink-0 grid-cols-3 gap-[2px]">
        {GRID_CELLS.map(({ id, delay, shade }) => (
          <span
            key={id}
            className={cn("rounded-[1px] inline-block animate-agent-grid", shade)}
            style={{
              animationDelay: `${delay}s`,
            }}
          />
        ))}
      </span>
      <span className="font-sans text-xs font-medium text-zinc-200">{label}</span>
      <span aria-hidden="true" className="tabular-nums font-mono text-[11px] text-zinc-500">
        {formatElapsed(elapsed)}
      </span>
    </span>
  );
}

export default AgentProgress;
