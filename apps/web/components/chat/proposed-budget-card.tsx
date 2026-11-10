"use client";

import * as React from "react";
import {
  ShieldCheck,
  AlertTriangle,
  Loader2,
  Info,
} from "lucide-react";
import { Button } from "../ui/button";
import { Card, CardContent } from "../ui/card";
import { formatMinorUnits } from "../../app/lib/currency";

export interface ProposedAllocationItem {
  agent: string;
  role: string;
  quotedCostMinor: number;
  requestedMandateMinor: number;
  capabilities: string[];
  description: string;
  isChild?: boolean;
  parentAgent?: string | null;
  reasoning?: string;
}

export interface ProposedBudgetCardProps {
  id: string;
  mandateId: string;
  currency: string;
  rootBudgetMinor: number;
  totalProposedMinor: number;
  allocations: ProposedAllocationItem[];
  onApprove: () => Promise<{ ok: boolean; message?: string; status?: string } | void> | void;
  onDeny: () => Promise<void> | void;
}

export function ProposedBudgetCard({
  mandateId,
  currency = "INR",
  rootBudgetMinor = 1000000,
  totalProposedMinor,
  allocations,
  onApprove,
  onDeny,
}: ProposedBudgetCardProps) {
  const [isApproving, setIsApproving] = React.useState(false);
  const [isDenying, setIsDenying] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  const remainingMinor = Math.max(0, rootBudgetMinor - totalProposedMinor);

  const handleApprove = async () => {
    setIsApproving(true);
    setErrorMessage(null);
    try {
      const res = await onApprove();
      if (res && typeof res === "object" && !res.ok) {
        setErrorMessage(res.message || "Failed to authorize budget delegations.");
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Error authorizing mandates");
    } finally {
      setIsApproving(false);
    }
  };

  const handleDeny = async () => {
    setIsDenying(true);
    setErrorMessage(null);
    try {
      await onDeny();
    } finally {
      setIsDenying(false);
    }
  };

  return (
    <Card className="w-full p-0 border border-border bg-card text-card-foreground shadow-sm rounded-lg overflow-hidden">
      <CardContent className="p-0">
        {/* Header - follows Card pattern: border-b px-4 py-3 */}
        <div className="border-b border-border px-4 py-3 flex items-center justify-between shrink-0 bg-card">
          <div className="flex items-center gap-2 text-muted-foreground [&_svg]:size-4">
            <ShieldCheck aria-hidden="true" className="size-4 shrink-0" />
            <span className="font-medium text-foreground text-sm">
              Proposed Budget Allocation & Mandate Delegation
            </span>
          </div>

          <span className="text-xs font-mono text-warning font-medium">
            Pending Approval
          </span>
        </div>

        {/* Content Body */}
        <div className="space-y-4 p-4">
          <p className="text-muted-foreground text-sm leading-relaxed">
            Specialist agents have collected quotes and proposed spending ceilings. Review and approve before signed child mandates are issued in the ledger.
          </p>

          {/* Summary KPI Strip */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <div className="rounded-lg border border-border bg-muted/20 p-3">
              <div className="text-xs text-muted-foreground">Root Mandate Ceiling</div>
              <div className="mt-1 text-sm font-semibold font-mono text-foreground">
                {formatMinorUnits(rootBudgetMinor, currency)}
              </div>
              <div className="text-[10px] text-muted-foreground font-mono mt-0.5">
                ID: {mandateId.slice(0, 14)}...
              </div>
            </div>

            <div className="rounded-lg border border-border bg-muted/20 p-3">
              <div className="text-xs text-muted-foreground">Total Proposed Authority</div>
              <div className="mt-1 text-sm font-semibold font-mono text-emerald-400">
                {formatMinorUnits(totalProposedMinor, currency)}
              </div>
              <div className="text-[10px] text-muted-foreground mt-0.5">
                Sum of quoted specialist caps
              </div>
            </div>

            <div className="rounded-lg border border-border bg-muted/20 p-3">
              <div className="text-xs text-muted-foreground">Remaining Orchestrator Buffer</div>
              <div className="mt-1 text-sm font-semibold font-mono text-foreground">
                {formatMinorUnits(remainingMinor, currency)}
              </div>
              <div className="text-[10px] text-muted-foreground mt-0.5">
                Unallocated root reserve
              </div>
            </div>
          </div>

          {/* Proposed Allocations Table */}
          <div className="border border-border rounded-lg overflow-hidden bg-card">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-border text-xs text-muted-foreground">
                  <th className="py-2.5 px-4 font-normal">Specialist Agent</th>
                  <th className="py-2.5 px-4 font-normal text-right">Quoted Cost</th>
                  <th className="py-2.5 px-4 font-normal text-right">Proposed Mandate</th>
                  <th className="py-2.5 px-4 font-normal">Purpose & Reasoning</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border text-xs">
                {allocations.map((item) => {
                  const isChild = item.isChild || Boolean(item.parentAgent);
                  return (
                    <tr key={item.agent} className="hover:bg-muted/30 transition-colors">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5 font-medium text-foreground text-sm">
                          {isChild ? (
                            <span className="text-warning font-mono text-xs">↳</span>
                          ) : null}
                          <span>{item.role}</span>
                          {isChild ? (
                            <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                              under {item.parentAgent || "Travel"}
                            </span>
                          ) : null}
                        </div>
                        <div className="text-[10px] text-muted-foreground font-mono">
                          {item.agent}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-sm text-muted-foreground">
                        {formatMinorUnits(item.quotedCostMinor, currency)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-sm font-semibold text-emerald-400">
                        {formatMinorUnits(item.requestedMandateMinor, currency)}
                      </td>
                      <td className="py-3 px-4 max-w-xs">
                        <div className="text-xs text-muted-foreground leading-relaxed mb-1.5">
                          {item.reasoning || item.description}
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {item.capabilities.map((cap) => (
                            <span
                              key={cap}
                              className="rounded bg-muted px-1.5 py-0.5 font-mono text-[9px] text-muted-foreground"
                            >
                              {cap}
                            </span>
                          ))}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Error Message */}
          {errorMessage && (
            <div className="flex items-start gap-2 rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-xs text-destructive">
              <AlertTriangle className="size-4 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <div className="font-semibold">Mandate Authorization Failed</div>
                <div>{errorMessage}</div>
              </div>
            </div>
          )}

          {/* Security Notice */}
          <div className="flex items-start gap-2 rounded-lg bg-muted/20 p-2.5 text-xs text-muted-foreground border border-border">
            <Info className="size-4 text-primary shrink-0 mt-0.5" />
            <span>
              <strong className="text-foreground">Security Guarantee:</strong> No child mandates are added to the database until approved. Specialist agents cannot reserve or capture funds using in-memory plan estimates alone.
            </span>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <Button
              variant="outline"
              size="sm"
              disabled={isApproving || isDenying}
              onClick={handleDeny}
              className="border-border bg-background hover:bg-muted text-foreground"
            >
              {isDenying ? <Loader2 className="mr-1.5 size-3.5 animate-spin" /> : null}
              Reject Proposal
            </Button>

            <Button
              variant="primary"
              size="sm"
              disabled={isApproving || isDenying}
              onClick={handleApprove}
              className="bg-primary hover:bg-primary/90 text-primary-foreground font-medium px-4"
            >
              {isApproving ? (
                <Loader2 className="mr-1.5 size-3.5 animate-spin" />
              ) : null}
              Approve & Delegate Mandates
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
