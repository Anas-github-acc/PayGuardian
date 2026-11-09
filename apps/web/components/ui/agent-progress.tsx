"use client";

import { motion, useReducedMotion } from "motion/react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

// Inlined from beui.dev's shared @/lib/ease motion tokens (only the constant this component uses).
const EASE_IN_OUT = [0.77, 0, 0.175, 1] as const;

const GRID_CELLS = [
  { id: "top-left", delay: 0, shade: "bg-white" },
  { id: "top-center", delay: 0.14, shade: "bg-zinc-200" },
  { id: "top-right", delay: 0.28, shade: "bg-zinc-400" },
  { id: "middle-left", delay: 0.42, shade: "bg-zinc-200" },
  { id: "middle-center", delay: 0.56, shade: "bg-zinc-400" },
  { id: "middle-right", delay: 0.7, shade: "bg-zinc-600" },
  { id: "bottom-left", delay: 0.84, shade: "bg-zinc-400" },
  { id: "bottom-center", delay: 0.98, shade: "bg-zinc-600" },
  { id: "bottom-right", delay: 1.12, shade: "bg-zinc-800" },
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
  const reduce = useReducedMotion() ?? false;
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
      <span
        aria-hidden="true"
        className="grid size-4 shrink-0 grid-cols-3 gap-[2px]"
      >
        {GRID_CELLS.map(({ id, delay, shade }) => (
          <motion.span
            key={id}
            className={cn("rounded-[1px]", shade)}
            animate={
              reduce
                ? { opacity: [0.2, 0.9, 0.2] }
                : {
                    opacity: [0.2, 1, 0.2],
                    scale: [0.8, 1, 0.8],
                  }
            }
            transition={{
              duration: 1.4,
              ease: EASE_IN_OUT,
              repeat: Infinity,
              delay,
            }}
          />
        ))}
      </span>
      <span className="font-sans text-xs font-medium text-zinc-200">{label}</span>
      <span
        aria-hidden="true"
        className="tabular-nums font-mono text-[11px] text-zinc-500"
      >
        {formatElapsed(elapsed)}
      </span>
    </span>
  );
}

export default AgentProgress;
