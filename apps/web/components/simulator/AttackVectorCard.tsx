"use client";

import * as React from "react";
import {
  ShieldAlert,
  Zap,
  ArrowRight,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Play,
  RotateCw,
} from "lucide-react";
import { cn } from "../../lib/utils";
import { formatMinorUnits } from "../../app/lib/currency";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { SimulationBadge } from "./SimulationBadge";
import type { AttackVector } from "./types";

export interface AttackVectorCardProps {
  vector: AttackVector;
  onTrigger: (vector: AttackVector) => Promise<void> | void;
  isExecuting?: boolean;
  lastExecutedAt?: string | null;
  className?: string;
}

export function AttackVectorCard({
  vector,
  onTrigger,
  isExecuting = false,
  lastExecutedAt = null,
  className = "",
}: AttackVectorCardProps) {
  const getSeverityBadge = () => {
    switch (vector.severity) {
      case "critical":
        return (
          <span className="rounded border border-destructive/40 bg-destructive/15 px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider text-destructive">
            Critical Vector
          </span>
        );
      case "high":
        return (
          <span className="rounded border border-warning/40 bg-warning/15 px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider text-warning">
            High Severity
          </span>
        );
      case "medium":
        return (
          <span className="rounded border border-chart-2/40 bg-chart-2/15 px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider text-chart-2">
            Medium Severity
          </span>
        );
    }
  };

  return (
    <div
      className={cn(
        "group relative flex flex-col justify-between rounded-xl border border-border bg-card p-5 transition-all duration-200 hover:border-border hover:bg-secondary top-shade",
        isExecuting && "border-warning/40 bg-warning/[0.03] shadow-[0_0_15px_oklch(var(--warning-solid)/0.1)]",
        className
      )}
    >
      <div>
        {/* Header: Title, Simulation Badge, and Severity */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-5 w-5 items-center justify-center rounded-md border border-border bg-secondary font-mono text-[10px] font-bold text-foreground">
                {vector.number}
              </span>
              <h3 className="text-sm font-semibold text-foreground tracking-tight group-hover:text-foreground">
                {vector.shortTitle}
              </h3>
            </div>
            <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
              {vector.scenario}
            </p>
          </div>
          <div className="shrink-0">{getSeverityBadge()}</div>
        </div>

        {/* Technical Attributes Strip */}
        <div className="mt-4 grid grid-cols-2 gap-2 rounded-lg border border-border bg-secondary p-3 text-xs">
          <div>
            <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground block">
              Attacker Agent
            </span>
            <span className="font-medium text-foreground text-[11px] truncate block">
              {vector.attackerAgent}
            </span>
          </div>

          <div>
            <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground block">
              Attempted Spend
            </span>
            <span className="font-mono text-[11px] font-semibold text-destructive tabular-nums block">
              {formatMinorUnits(vector.attemptedAmountMinor, "USD")}
            </span>
          </div>

          {vector.targetMerchant && (
            <div className="col-span-2 border-t border-border pt-2">
              <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground block">
                Target Recipient
              </span>
              <span className="text-[11px] text-muted-foreground truncate block">
                {vector.targetMerchant}
              </span>
            </div>
          )}

          <div className="col-span-2 border-t border-border pt-2">
            <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground block">
              Tested Policy Guardrail
            </span>
            <span className="font-mono text-[10px] text-success truncate block">
              {vector.policyRule}
            </span>
          </div>
        </div>

        {/* Expected Gateway Defense */}
        <div className="mt-3 text-[11px] text-muted-foreground leading-relaxed flex items-start gap-1.5">
          <ShieldAlert className="h-3.5 w-3.5 text-warning shrink-0 mt-0.5" />
          <span>
            <strong className="text-foreground">Expected defense:</strong> {vector.expectedOutcome}
          </span>
        </div>
      </div>

      {/* Action Footer */}
      <div className="mt-5 flex items-center justify-between border-t border-border pt-3.5">
        <div className="flex items-center gap-1.5">
          <SimulationBadge />
          {lastExecutedAt && (
            <span className="text-[10px] font-mono text-muted-foreground">
              Last run {new Date(lastExecutedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </span>
          )}
        </div>

        <Button
          size="sm"
          onClick={() => void onTrigger(vector)}
          disabled={isExecuting}
          className={cn(
            "h-8 px-3 text-xs font-semibold transition-all",
            isExecuting
              ? "bg-warning/20 text-warning border border-warning/40"
              : "bg-white/[0.08] text-foreground hover:bg-destructive hover:text-black border border-border"
          )}
        >
          {isExecuting ? (
            <>
              <RotateCw className="mr-1.5 h-3.5 w-3.5 animate-spin text-warning" />
              <span>Simulating…</span>
            </>
          ) : (
            <>
              <Play className="mr-1.5 h-3.5 w-3.5 fill-current" />
              <span>Simulate Attack</span>
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
