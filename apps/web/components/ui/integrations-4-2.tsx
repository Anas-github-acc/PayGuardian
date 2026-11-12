"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { SecureAgentDelegationVisual } from "./secure-agent-delegation";

export interface IntegrationsProps {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  ctaPrimary?: React.ReactNode;
  ctaSecondary?: React.ReactNode;
  visual?: React.ReactNode;
  className?: string;
}

export function Integrations({
  title = "Delegating work to subagents",
  subtitle = "Yes, AI agents can delegate work easily to other subagents. But delegating spending authority safely, with full accountability, is not. That's why we built PayGuardian.",
  ctaPrimary,
  ctaSecondary,
  visual,
  className,
}: IntegrationsProps = {}) {
  return (
    <div
      className={cn(
        "mx-auto grid max-w-6xl grid-cols-1 items-center gap-8 p-4 lg:grid-cols-[1fr_1.18fr] lg:gap-12",
        className,
      )}
    >
      {/* Left Content */}
      <div className="max-w-xl space-y-6">
        <div className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-black/[0.03] px-3 py-1 text-xs font-mono font-medium text-black/70 dark:border-white/10 dark:bg-white/[0.04] dark:text-white/70">
          <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <span>Cryptographic Authority Bounds</span>
        </div>

        <h2 className="font-semibold text-3xl tracking-tight sm:text-4xl md:text-5xl text-foreground">
          {title}
        </h2>
        <p className="text-base sm:text-lg text-muted-foreground leading-relaxed sm:leading-8">
          {subtitle}
        </p>
        {(ctaPrimary || ctaSecondary) && (
          <div className="flex flex-wrap items-center gap-3.5 pt-2">
            {ctaPrimary}
            {ctaSecondary}
          </div>
        )}
      </div>

      {/* Right Content - Real Multi-Agent Delegation Visual */}
      <div className="flex w-full justify-center lg:justify-end">
        {visual ?? <SecureAgentDelegationVisual />}
      </div>
    </div>
  );
}

export default Integrations;
