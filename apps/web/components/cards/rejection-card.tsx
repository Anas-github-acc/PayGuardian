"use client";

import * as React from "react";
import { AlertCircle, ChevronDown, ChevronUp, Clock, ExternalLink, ShieldAlert } from "lucide-react";
import { formatMinorUnits } from "../../app/lib/currency";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";

export type RejectionReasonCode =
  | "BUDGET_EXCEEDED"
  | "UNAUTHORIZED_MERCHANT"
  | "THRESHOLD_EXCEEDED"
  | "EXPIRED"
  | "REVOKED"
  | "POLICY_DENIED";

export interface RejectionCardProps {
  id?: string;
  reasonCode: RejectionReasonCode | string;
  agentName: string;
  attemptedAmountMinor: number;
  currency?: string;
  attemptedMerchant?: string;
  ruleReference?: string;
  explanation?: string;
  rejectedAt?: string;
  checksFailed?: string[];
  onViewTrace?: (traceId?: string) => void;
  className?: string;
}

const REASON_MAPPINGS: Record<string, string> = {
  BUDGET_EXCEEDED: "Requested spend exceeds available allocated budget limit.",
  UNAUTHORIZED_MERCHANT: "Merchant is not present on the environment category allowlist.",
  THRESHOLD_EXCEEDED: "Payment exceeds single-transaction autonomous human approval threshold.",
  EXPIRED: "Agent mandate authority has passed its scheduled expiration timestamp.",
  REVOKED: "Agent spending authority was explicitly revoked by human administrator.",
  POLICY_DENIED: "Action violated cryptographic policy guardrails.",
};

export function RejectionCard({
  id = "trace-rej-7712",
  reasonCode = "BUDGET_EXCEEDED",
  agentName = "Hotel Subagent",
  attemptedAmountMinor = 500000,
  currency = "USD",
  attemptedMerchant = "Grand Hyatt Luxury Villas",
  ruleReference = "Rule #POL-8820 (Max Sub-Allocation)",
  explanation,
  rejectedAt = new Date().toISOString(),
  checksFailed = [
    "Remaining balance verification: FAILED (Available: $200.00 < Requested: $5,000.00)",
    "Sub-allocation depth check: PASSED",
    "Merchant category check: PASSED",
  ],
  onViewTrace,
  className = "",
}: RejectionCardProps) {
  const [showTechnicalDetails, setShowTechnicalDetails] = React.useState(false);

  const plainLanguageExplanation =
    explanation ??
    (reasonCode === "BUDGET_EXCEEDED"
      ? `${agentName} attempted to spend ${formatMinorUnits(attemptedAmountMinor, currency)}, but only has ${formatMinorUnits(20000, currency)} remaining in its sub-mandate.`
      : reasonCode === "UNAUTHORIZED_MERCHANT"
      ? `Merchant "${attemptedMerchant}" is not authorized on the approved vendor allowlist.`
      : reasonCode === "THRESHOLD_EXCEEDED"
      ? `Single payment of ${formatMinorUnits(attemptedAmountMinor, currency)} exceeds the autonomous limit. Explicit human approval is required.`
      : (REASON_MAPPINGS[reasonCode] ?? "The gateway denied this transaction based on security rules."));

  return (
    <div
      className={`relative rounded-lg border border-destructive/30 bg-card p-4 text-foreground top-shade ${className}`}
      style={{
        backgroundImage: "radial-gradient(90% 120% at 50% 0%, oklch(var(--destructive) / 0.05), transparent 80%)",
      }}
    >
      {/* Header with Rejection Badge & Timestamp */}
      <div className="flex items-center justify-between border-b border-border pb-3">
        <div className="flex items-center gap-2">
          <Badge variant="rejected" showDot className="bg-destructive/15 text-destructive border-destructive/40">
            <ShieldAlert className="h-3 w-3 mr-1" />
            GATEWAY REFUSED
          </Badge>
          <span className="font-mono text-[11px] text-destructive">
            {reasonCode}
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground font-mono">
          <Clock className="h-3 w-3" />
          <span>{new Date(rejectedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
        </div>
      </div>

      {/* Plain Language Rejection Message */}
      <div className="mt-3">
        <h4 className="text-xs font-semibold text-foreground flex items-center gap-1.5">
          <AlertCircle className="h-3.5 w-3.5 text-destructive shrink-0" />
          Transaction Blocked by Policy
        </h4>
        <p className="mt-1 text-xs text-foreground leading-relaxed bg-destructive/10 border border-destructive/20 rounded-md p-2.5">
          {plainLanguageExplanation}
        </p>
      </div>

      {/* Attempt Details */}
      <div className="mt-3 grid grid-cols-2 gap-2 text-xs border-t border-border pt-3">
        <div>
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono block">Actor Agent</span>
          <span className="text-foreground font-medium text-[11px] truncate block">{agentName}</span>
        </div>
        <div>
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono block">Attempted Amount</span>
          <span className="font-mono text-destructive font-semibold text-[11px] tabular-nums block">
            {formatMinorUnits(attemptedAmountMinor, currency)}
          </span>
        </div>
        {attemptedMerchant && (
          <div className="col-span-2">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono block">Attempted Merchant</span>
            <span className="text-muted-foreground text-[11px] truncate block">{attemptedMerchant}</span>
          </div>
        )}
        <div className="col-span-2">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono block">Enforced Policy</span>
          <span className="font-mono text-muted-foreground text-[11px] truncate block">{ruleReference}</span>
        </div>
      </div>

      {/* Expandable Technical Verification Checklist */}
      <div className="mt-3 border-t border-border pt-2">
        <button
          type="button"
          onClick={() => setShowTechnicalDetails(!showTechnicalDetails)}
          className="flex w-full items-center justify-between text-[11px] text-muted-foreground hover:text-foreground py-1"
        >
          <span>Cryptographic Enforcement Checklist</span>
          {showTechnicalDetails ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        </button>

        {showTechnicalDetails && (
          <div className="mt-2 rounded bg-card border border-border p-2.5 space-y-1.5 font-mono text-[10px]">
            {checksFailed.map((check, idx) => (
              <div
                key={idx}
                className={check.includes("FAILED") ? "text-destructive" : "text-success"}
              >
                {check}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Action Footer */}
      <div className="mt-3 flex items-center justify-between pt-2 border-t border-border">
        <span className="text-[10px] text-muted-foreground">
          Zero funds disbursed. Protected by PayGuardian.
        </span>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onViewTrace?.(id)}
          className="h-7 px-2.5 text-xs text-destructive border-destructive/30 hover:bg-destructive/10"
        >
          <ExternalLink className="mr-1.5 h-3 w-3" />
          View Trace
        </Button>
      </div>
    </div>
  );
}
