"use client";

import * as React from "react";
import {
  ShieldCheck,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Wallet,
  ArrowRight,
  Loader2,
  Info,
} from "lucide-react";
import { Button } from "../ui/button";

export interface ProposedAllocationItem {
  agent: string;
  role: string;
  quotedCostMinor: number;
  requestedMandateMinor: number;
  capabilities: string[];
  description: string;
}

export interface ProposedBudgetCardProps {
  id: string;
  mandateId: string;
  currency: string;
  rootBudgetMinor: number;
  totalProposedMinor: number;
  allocations: ProposedAllocationItem[];
  onApprove: () => Promise<void> | void;
  onDeny: () => Promise<void> | void;
}

export function ProposedBudgetCard({
  id,
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

  const formatCurrency = (minor: number, cur: string) => {
    const val = (minor / 100).toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    if (cur === "INR") return `₹${val}`;
    if (cur === "EUR") return `€${val}`;
    if (cur === "GBP") return `£${val}`;
    return `$${val}`;
  };

  const remainingMinor = Math.max(0, rootBudgetMinor - totalProposedMinor);

  const handleApprove = async () => {
    setIsApproving(true);
    try {
      await onApprove();
    } finally {
      setIsApproving(false);
    }
  };

  const handleDeny = async () => {
    setIsDenying(true);
    try {
      await onDeny();
    } finally {
      setIsDenying(false);
    }
  };

  return (
    <div className="w-full rounded-xl border border-blue-900/50 bg-zinc-950/90 p-5 shadow-2xl backdrop-blur-md">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 border-b border-zinc-800/80 pb-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400">
              <ShieldCheck className="h-4 w-4" />
            </div>
            <h4 className="text-sm font-semibold tracking-tight text-white">
              Proposed Budget Allocation & Mandate Delegation
            </h4>
          </div>
          <p className="text-xs text-zinc-400">
            Specialist agents have collected quotes and proposed spending ceilings. Review and approve before signed child mandates are issued in the ledger.
          </p>
        </div>

        <span className="rounded-full bg-amber-500/10 border border-amber-500/20 px-2.5 py-0.5 text-[10px] font-mono font-medium text-amber-400 shrink-0">
          Pending Human Sign-off
        </span>
      </div>

      {/* Summary KPI Strip */}
      <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-2.5">
        <div className="rounded-lg border border-zinc-800/80 bg-zinc-900/60 p-3">
          <div className="text-[11px] text-zinc-400">Root Mandate Ceiling</div>
          <div className="mt-1 text-sm font-bold font-mono text-white">
            {formatCurrency(rootBudgetMinor, currency)}
          </div>
          <div className="text-[10px] text-zinc-500 font-mono mt-0.5">
            ID: {mandateId.slice(0, 14)}...
          </div>
        </div>

        <div className="rounded-lg border border-blue-900/40 bg-blue-950/20 p-3">
          <div className="text-[11px] text-blue-300">Total Proposed Authority</div>
          <div className="mt-1 text-sm font-bold font-mono text-emerald-400">
            {formatCurrency(totalProposedMinor, currency)}
          </div>
          <div className="text-[10px] text-blue-400/80 mt-0.5">
            Sum of quoted specialist caps
          </div>
        </div>

        <div className="rounded-lg border border-zinc-800/80 bg-zinc-900/60 p-3">
          <div className="text-[11px] text-zinc-400">Remaining Orchestrator Buffer</div>
          <div className="mt-1 text-sm font-bold font-mono text-zinc-200">
            {formatCurrency(remainingMinor, currency)}
          </div>
          <div className="text-[10px] text-zinc-500 mt-0.5">
            Unallocated root reserve
          </div>
        </div>
      </div>

      {/* Proposed Allocations Table */}
      <div className="mt-4 space-y-2">
        <div className="text-xs font-medium text-zinc-300">
          Proposed Specialist Delegations:
        </div>
        <div className="overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900/40">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-zinc-800 bg-zinc-900/80 text-[11px] text-zinc-400">
              <tr>
                <th className="px-3 py-2">Specialist Agent</th>
                <th className="px-3 py-2">Quoted Cost</th>
                <th className="px-3 py-2">Requested Mandate</th>
                <th className="px-3 py-2">Permitted Scopes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60 text-zinc-300">
              {allocations.map((item) => (
                <tr key={item.agent} className="hover:bg-zinc-800/20">
                  <td className="px-3 py-2.5">
                    <div className="font-medium text-white">{item.role}</div>
                    <div className="text-[10px] text-zinc-500 font-mono">
                      {item.agent}
                    </div>
                  </td>
                  <td className="px-3 py-2.5 font-mono text-zinc-300">
                    {formatCurrency(item.quotedCostMinor, currency)}
                  </td>
                  <td className="px-3 py-2.5 font-mono font-semibold text-emerald-400">
                    {formatCurrency(item.requestedMandateMinor, currency)}
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex flex-wrap gap-1">
                      {item.capabilities.map((cap) => (
                        <span
                          key={cap}
                          className="rounded bg-zinc-800 px-1.5 py-0.5 font-mono text-[10px] text-zinc-400"
                        >
                          {cap}
                        </span>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Security Notice */}
      <div className="mt-3 flex items-start gap-2 rounded-lg bg-zinc-900/40 p-2.5 text-[11px] text-zinc-400 border border-zinc-800/60">
        <Info className="h-4 w-4 text-blue-400 shrink-0 mt-0.5" />
        <span>
          <strong className="text-zinc-200">Security Guarantee:</strong> No child mandates are added to the database until approved. Specialist agents cannot reserve or capture funds using in-memory plan estimates alone.
        </span>
      </div>

      {/* Action Buttons */}
      <div className="mt-4 flex items-center justify-end gap-3 pt-2">
        <Button
          variant="outline"
          size="sm"
          disabled={isApproving || isDenying}
          onClick={handleDeny}
          className="border-zinc-800 bg-zinc-900 text-zinc-400 hover:text-white hover:bg-zinc-850"
        >
          {isDenying ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
          Reject Proposal
        </Button>

        <Button
          variant="primary"
          size="sm"
          disabled={isApproving || isDenying}
          onClick={handleApprove}
          className="bg-emerald-600 text-white hover:bg-emerald-500 font-medium px-4"
        >
          {isApproving ? (
            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
          ) : (
            <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
          )}
          Approve & Issue Cryptographic Mandates
        </Button>
      </div>
    </div>
  );
}
