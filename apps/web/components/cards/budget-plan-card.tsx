"use client";

import * as React from "react";
import { ShieldCheck, CheckCircle2, Clock, ExternalLink, SlidersHorizontal } from "lucide-react";
import { formatMinorUnits } from "../../app/lib/currency";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";

export interface BudgetSubAllocation {
  agentId: string;
  agentName: string;
  role?: string;
  amountMinor: number;
}

export interface BudgetPlanCardProps {
  id?: string;
  title?: string;
  parentMandateId?: string;
  totalRequestedMinor: number;
  currency?: string;
  status?: "pending" | "approved" | "rejected";
  subAllocations?: BudgetSubAllocation[];
  policyNotes?: string;
  verifiedAt?: string;
  onApprove?: () => void;
  onAdjust?: (allocations: BudgetSubAllocation[]) => void;
  onViewTrace?: (traceId?: string) => void;
  className?: string;
}

export function BudgetPlanCard({
  id = "plan-budget-01",
  title = "Proposed Budget Allocation Plan",
  parentMandateId = "man-root-9081",
  totalRequestedMinor,
  currency = "USD",
  status = "pending",
  subAllocations = [
    { agentId: "ag-travel-01", agentName: "Travel Subagent", role: "Logistics", amountMinor: 400000 },
    { agentId: "ag-hotel-02", agentName: "Hotel Subagent", role: "Hospitality", amountMinor: 400000 },
    { agentId: "ag-reserve-00", agentName: "Unallocated Reserve", role: "Contingency", amountMinor: 200000 },
  ],
  policyNotes = "Allocation complies with Mandate Policy #POL-8820: Total does not exceed root parent limit.",
  verifiedAt = new Date().toISOString(),
  onApprove,
  onAdjust,
  onViewTrace,
  className = "",
}: BudgetPlanCardProps) {
  const [isEditing, setIsEditing] = React.useState(false);
  const [allocations, setAllocations] = React.useState<BudgetSubAllocation[]>(subAllocations);
  const [approved, setApproved] = React.useState(status === "approved");

  const totalAllocatedMinor = allocations.reduce((acc, curr) => acc + curr.amountMinor, 0);

  const handleAmountChange = (index: number, newAmountMinor: number) => {
    const updated = [...allocations];
    const item = updated[index];
    if (item) {
      updated[index] = { ...item, amountMinor: Math.max(0, newAmountMinor) };
      setAllocations(updated);
    }
  };

  const handleApprove = () => {
    setApproved(true);
    setIsEditing(false);
    onApprove?.();
  };

  const handleSaveAdjustments = () => {
    setIsEditing(false);
    onAdjust?.(allocations);
  };

  return (
    <div
      className={`relative rounded-lg border border-border bg-card p-4 text-foreground top-shade verified-glow ${className}`}
    >
      {/* Header with Verification Pill & Timestamp */}
      <div className="flex items-center justify-between border-b border-border pb-3">
        <div className="flex items-center gap-2">
          <Badge variant="authorized" showDot className="bg-success/10 text-success border-success/30">
            <ShieldCheck className="h-3 w-3 mr-1" />
            GATEWAY VERIFIED
          </Badge>
          <span className="text-[11px] font-mono text-muted-foreground">
            {parentMandateId}
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground font-mono">
          <Clock className="h-3 w-3" />
          <span>{new Date(verifiedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
        </div>
      </div>

      {/* Card Title & Total Requested */}
      <div className="mt-3 flex items-start justify-between">
        <div>
          <h4 className="text-xs font-semibold tracking-tight text-foreground">{title}</h4>
          <p className="mt-0.5 text-[11px] text-muted-foreground leading-relaxed">
            Parent Mandate: <span className="font-mono text-foreground">{parentMandateId}</span>
          </p>
        </div>
        <div className="text-right">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono">Requested Total</div>
          <div className="text-sm font-semibold font-mono text-success tabular-nums">
            {formatMinorUnits(totalRequestedMinor, currency)}
          </div>
        </div>
      </div>

      {/* Sub-Allocations Breakdown Table */}
      <div className="mt-3 overflow-hidden rounded-md border border-border bg-card">
        <div className="grid grid-cols-12 px-3 py-1.5 text-[10px] font-medium text-muted-foreground border-b border-border">
          <span className="col-span-7">Target Agent / Purpose</span>
          <span className="col-span-5 text-right font-mono">Proposed Share</span>
        </div>
        <div className="divide-y divide-border">
          {allocations.map((alloc, idx) => (
            <div key={alloc.agentId} className="grid grid-cols-12 items-center px-3 py-2 text-xs">
              <div className="col-span-7 pr-2">
                <div className="font-medium text-foreground truncate">{alloc.agentName}</div>
                {alloc.role && (
                  <div className="text-[10px] text-muted-foreground">{alloc.role}</div>
                )}
              </div>
              <div className="col-span-5 text-right font-mono tabular-nums">
                {isEditing ? (
                  <input
                    type="number"
                    step="100"
                    value={alloc.amountMinor / 100}
                    onChange={(e) =>
                      handleAmountChange(idx, Math.round(Number(e.target.value) * 100))
                    }
                    className="w-20 rounded border border-border bg-secondary px-1.5 py-0.5 text-right text-xs text-foreground focus:border-success focus:outline-none"
                  />
                ) : (
                  <span className="text-foreground">
                    {formatMinorUnits(alloc.amountMinor, currency)}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
        {/* Total Summary Footer */}
        <div className="grid grid-cols-12 items-center px-3 py-1.5 bg-secondary text-xs font-medium border-t border-border">
          <span className="col-span-7 text-muted-foreground">Calculated Total</span>
          <span className="col-span-5 text-right font-mono text-success tabular-nums">
            {formatMinorUnits(totalAllocatedMinor, currency)}
          </span>
        </div>
      </div>

      {/* Policy Notes */}
      {policyNotes && (
        <div className="mt-2.5 rounded border border-border bg-secondary/60 px-2.5 py-1.5 text-[11px] text-muted-foreground leading-relaxed">
          <span className="font-medium text-foreground">Policy Verification: </span>
          {policyNotes}
        </div>
      )}

      {/* Action Footer */}
      <div className="mt-3.5 flex items-center justify-between pt-2 border-t border-border">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onViewTrace?.(id)}
          className="h-7 px-2 text-[11px] text-muted-foreground hover:text-foreground"
        >
          <ExternalLink className="mr-1 h-3 w-3" />
          View Trace
        </Button>

        <div className="flex items-center gap-2">
          {approved ? (
            <Badge variant="authorized" showDot className="bg-success/15 text-success">
              <CheckCircle2 className="mr-1 h-3 w-3" />
              Plan Approved & Delegated
            </Badge>
          ) : isEditing ? (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsEditing(false)}
                className="h-7 px-2.5 text-xs"
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleSaveAdjustments}
                className="h-7 px-3 text-xs bg-success text-background hover:bg-success/90"
              >
                Save
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsEditing(true)}
                className="h-7 px-2.5 text-xs text-muted-foreground hover:text-foreground"
              >
                <SlidersHorizontal className="mr-1 h-3 w-3" />
                Adjust
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleApprove}
                className="h-7 px-3 text-xs"
              >
                Approve Plan
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
