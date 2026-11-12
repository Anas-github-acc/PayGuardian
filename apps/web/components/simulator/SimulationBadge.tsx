"use client";

import * as React from "react";
import { Zap } from "lucide-react";
import { cn } from "../../lib/utils";

export interface SimulationBadgeProps {
  className?: string;
  showIcon?: boolean;
}

export function SimulationBadge({ className = "", showIcon = true }: SimulationBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded border border-warning/40 bg-warning/15 px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider text-warning shadow-[0_0_8px_oklch(var(--warning-solid)/0.15)] select-none",
        className,
      )}
      title="Simulated Sandbox Event: Zero real financial funds affected"
    >
      {showIcon && <Zap className="h-2.5 w-2.5 shrink-0 text-warning" />}
      <span>[SIMULATION]</span>
    </span>
  );
}
