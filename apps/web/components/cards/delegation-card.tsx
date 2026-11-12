"use client";

import * as React from "react";
import { ArrowRight, Clock, ExternalLink, Link2, ShieldCheck } from "lucide-react";
import { formatMinorUnits } from "../../app/lib/currency";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";

export interface DelegationCardProps {
  id?: string;
  parentAgentName: string;
  subagentName: string;
  delegatedBudgetMinor: number;
  currency?: string;
  allowedRails?: string[];
  maxDepth?: number;
  expiresAt?: string;
  isFunded?: boolean;
  delegationHash?: string;
  verifiedAt?: string;
  onViewTrace?: (traceId?: string) => void;
  className?: string;
}

export function DelegationCard({
  id = "del-mandate-4421",
  parentAgentName = "Main Orchestrator",
  subagentName = "Travel Subagent",
  delegatedBudgetMinor = 400000,
  currency = "USD",
  allowedRails = ["PayPal", "Simulation"],
  maxDepth = 2,
  expiresAt = "2026-12-31T23:59:59Z",
  isFunded = true,
  delegationHash = "0x44fa9...88e1",
  verifiedAt = new Date().toISOString(),
  onViewTrace,
  className = "",
}: DelegationCardProps) {
  return (
    <div
      className={`relative rounded-lg border border-border bg-card p-4 text-foreground top-shade verified-glow ${className}`}
    >
      {/* Header with Authority Badge */}
      <div className="flex items-center justify-between border-b border-border pb-3">
        <div className="flex items-center gap-2">
          {isFunded ? (
            <Badge
              variant="authorized"
              showDot
              className="bg-success/10 text-success border-success/30"
            >
              <ShieldCheck className="h-3 w-3 mr-1" />
              AUTHORITY DELEGATED
            </Badge>
          ) : (
            <Badge variant="unfunded" className="border-dashed border-border text-muted-foreground">
              <Link2 className="h-3 w-3 mr-1" />
              STRUCTURAL ATTACHMENT
            </Badge>
          )}
          <span className="font-mono text-[11px] text-muted-foreground">{id}</span>
        </div>
        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground font-mono">
          <Clock className="h-3 w-3" />
          <span>
            {new Date(verifiedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </span>
        </div>
      </div>

      {/* Parent -> Child Chain */}
      <div className="mt-3.5 flex items-center gap-2 text-xs">
        <div className="flex-1 rounded border border-border bg-secondary p-2 text-center">
          <span className="text-[10px] text-muted-foreground block uppercase font-mono">
            Parent Mandate
          </span>
          <span className="font-medium text-foreground truncate block mt-0.5">
            {parentAgentName}
          </span>
        </div>

        <div className="flex flex-col items-center px-1 text-success">
          <ArrowRight className="h-4 w-4" />
          <span className="text-[9px] font-mono mt-0.5">grant</span>
        </div>

        <div className="flex-1 rounded border border-success/30 bg-success/5 p-2 text-center">
          <span className="text-[10px] text-success block uppercase font-mono">
            Authorized Subagent
          </span>
          <span className="font-medium text-foreground truncate block mt-0.5">{subagentName}</span>
        </div>
      </div>

      {/* Budget Limit & Details */}
      <div className="mt-3 grid grid-cols-2 gap-2 text-xs border-t border-border pt-3">
        <div>
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono block">
            Delegated Budget Limit
          </span>
          <span className="font-mono text-sm font-semibold text-success tabular-nums block mt-0.5">
            {isFunded ? formatMinorUnits(delegatedBudgetMinor, currency) : "Unfunded ($0)"}
          </span>
        </div>

        <div>
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono block">
            Sub-Delegation Depth
          </span>
          <span className="text-foreground text-[11px] block mt-1">Max {maxDepth} hops</span>
        </div>

        <div>
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono block">
            Permitted Rails
          </span>
          <div className="flex flex-wrap gap-1 mt-1">
            {allowedRails.map((rail) => (
              <span
                key={rail}
                className="rounded bg-secondary px-1.5 py-0.5 text-[10px] text-muted-foreground border border-border"
              >
                {rail}
              </span>
            ))}
          </div>
        </div>

        <div>
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono block">
            Authority Expiry
          </span>
          <span className="font-mono text-[11px] text-muted-foreground block mt-1">
            {new Date(expiresAt).toLocaleDateString([], {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          </span>
        </div>
      </div>

      {/* Action Footer */}
      <div className="mt-3.5 flex items-center justify-between pt-2 border-t border-border">
        <span className="font-mono text-[10px] text-muted-foreground truncate max-w-[180px]">
          Sig: {delegationHash}
        </span>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onViewTrace?.(id)}
          className="h-7 px-2.5 text-xs text-foreground hover:bg-white/[0.04]"
        >
          <ExternalLink className="mr-1.5 h-3 w-3" />
          View Mandate
        </Button>
      </div>
    </div>
  );
}
