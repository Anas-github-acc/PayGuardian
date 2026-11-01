"use client";

import * as React from "react";
import {
  ShieldCheck,
  ShieldAlert,
  ArrowDown,
  Layers,
  Scale,
  Key,
  Check,
  Building2,
  Cpu,
} from "lucide-react";
import { formatMinorUnits } from "../../app/lib/currency";
import { Badge } from "../ui/badge";
import type { TraceAuthNode } from "./types";

export interface VerticalAuthChainProps {
  nodes: TraceAuthNode[];
  className?: string;
}

export function VerticalAuthChain({ nodes, className = "" }: VerticalAuthChainProps) {
  return (
    <div className={`space-y-3 ${className}`}>
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground font-mono">
          Vertical Authorization & Budget Delegation Chain
        </h4>
        <span className="text-[11px] text-muted-foreground font-mono">
          {nodes.length} hierarchy levels evaluated
        </span>
      </div>

      <div className="relative pl-6 space-y-4">
        {/* Continuous Vertical Trace Line */}
        <div className="absolute left-[23px] top-4 bottom-4 w-[2px] bg-white/[0.08]" />

        {nodes.map((node, index) => {
          const isRoot = index === 0;
          const isLast = index === nodes.length - 1;

          return (
            <div key={node.id} className="relative">
              {/* Connector Dot */}
              <div
                className={`absolute -left-6 top-3 flex h-4 w-4 -translate-x-[7px] items-center justify-center rounded-full border ${
                  node.status === "active"
                    ? "border-success bg-card text-success"
                    : "border-border bg-secondary text-muted-foreground"
                }`}
              >
                <div
                  className={`h-1.5 w-1.5 rounded-full ${
                    node.status === "active" ? "bg-success" : "bg-muted-foreground"
                  }`}
                />
              </div>

              {/* Node Card */}
              <div className="rounded-lg border border-border bg-card p-3.5 text-foreground top-shade hover:border-border transition-colors">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-2.5">
                  <div className="flex items-center gap-2">
                    {isRoot ? (
                      <Key className="h-3.5 w-3.5 text-success" />
                    ) : isLast ? (
                      <Scale className="h-3.5 w-3.5 text-warning" />
                    ) : (
                      <Cpu className="h-3.5 w-3.5 text-muted-foreground" />
                    )}
                    <span className="text-xs font-semibold text-foreground">{node.name}</span>
                    <Badge variant={node.status === "active" ? "authorized" : "revoked"} className="text-[10px] py-0 px-1.5">
                      {node.role}
                    </Badge>
                  </div>

                  <span className="font-mono text-[11px] text-muted-foreground">
                    Mandate: {node.mandateId}
                  </span>
                </div>

                {/* Financial Balances Row */}
                <div className="mt-2.5 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono">
                  <div>
                    <span className="text-[10px] uppercase text-muted-foreground block">Allocated</span>
                    <span className="tabular-nums text-foreground">
                      {formatMinorUnits(node.allocatedMinor, node.currency)}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase text-muted-foreground block">Spent</span>
                    <span className="tabular-nums text-muted-foreground">
                      {formatMinorUnits(node.spentMinor, node.currency)}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase text-muted-foreground block">Reserved</span>
                    <span className="tabular-nums text-warning">
                      {formatMinorUnits(node.reservedMinor, node.currency)}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase text-muted-foreground block">Available</span>
                    <span className="tabular-nums text-success font-medium">
                      {formatMinorUnits(node.availableMinor, node.currency)}
                    </span>
                  </div>
                </div>

                {/* Policy Rule Footnote */}
                {node.policyRule && (
                  <div className="mt-2.5 rounded bg-secondary px-2.5 py-1.5 text-[11px] text-muted-foreground border border-border">
                    <span className="font-medium text-foreground">Policy constraint:</span>{" "}
                    {node.policyRule}
                  </div>
                )}
              </div>

              {/* Downward indicator between nodes */}
              {!isLast && (
                <div className="flex justify-center -my-1">
                  <ArrowDown className="h-3 w-3 text-muted-foreground opacity-40" />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
