"use client";

import * as React from "react";
import { ShieldCheck, Check, Clock, ExternalLink, ArrowRight } from "lucide-react";
import { formatMinorUnits } from "../../app/lib/currency";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";

export type PaymentLifecycleStage =
  | "requested"
  | "authorized"
  | "sent_to_provider"
  | "provider_accepted"
  | "completed";

export interface PaymentResultCardProps {
  id?: string;
  transactionId?: string;
  recipient: string;
  merchantCategory?: string;
  amountMinor: number;
  currency?: string;
  rail?: string;
  authHash?: string;
  currentStage?: PaymentLifecycleStage;
  completedAt?: string;
  agentName?: string;
  onViewTrace?: (traceId?: string) => void;
  className?: string;
}

const LIFECYCLE_STAGES: Array<{ key: PaymentLifecycleStage; label: string }> = [
  { key: "requested", label: "Requested" },
  { key: "authorized", label: "Authorized" },
  { key: "sent_to_provider", label: "Sent to PayPal" },
  { key: "provider_accepted", label: "Accepted" },
  { key: "completed", label: "Settled" },
];

export function PaymentResultCard({
  id = "trace-pay-9018",
  transactionId = "txn_pp_982194820",
  recipient = "IndiGo Airlines Ltd",
  merchantCategory = "Air Travel & Transportation",
  amountMinor = 24500,
  currency = "USD",
  rail = "PayPal",
  authHash = "0x89f41b2a...c07d391e",
  currentStage = "completed",
  completedAt = new Date().toISOString(),
  agentName = "Travel Subagent",
  onViewTrace,
  className = "",
}: PaymentResultCardProps) {
  const currentStageIndex = LIFECYCLE_STAGES.findIndex((s) => s.key === currentStage);
  const activeIndex = currentStageIndex >= 0 ? currentStageIndex : LIFECYCLE_STAGES.length - 1;

  return (
    <div
      className={`relative rounded-lg border border-border bg-card p-4 text-foreground top-shade verified-glow ${className}`}
    >
      {/* Top Banner: Verification Shield & Timestamp */}
      <div className="flex items-center justify-between border-b border-border pb-3">
        <div className="flex items-center gap-2">
          <Badge variant="authorized" showDot className="bg-success/10 text-success border-success/30">
            <ShieldCheck className="h-3 w-3 mr-1" />
            PAYMENT SETTLED
          </Badge>
          <span className="font-mono text-[11px] text-muted-foreground">{rail}</span>
        </div>
        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground font-mono">
          <Clock className="h-3 w-3" />
          <span>{new Date(completedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</span>
        </div>
      </div>

      {/* Recipient & Amount Headline */}
      <div className="mt-3 flex items-start justify-between">
        <div>
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono">Merchant / Recipient</div>
          <h4 className="text-sm font-semibold tracking-tight text-foreground">{recipient}</h4>
          {merchantCategory && (
            <p className="mt-0.5 text-[11px] text-muted-foreground">{merchantCategory}</p>
          )}
        </div>
        <div className="text-right">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono">Amount Paid</div>
          <div className="text-base font-semibold font-mono text-success tabular-nums">
            {formatMinorUnits(amountMinor, currency)}
          </div>
        </div>
      </div>

      {/* 5-Stage Payment Lifecycle Timeline */}
      <div className="mt-4 rounded-md border border-border bg-card p-3">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono mb-2.5">
          Gateway Lifecycle Verification
        </div>
        <div className="flex items-center justify-between">
          {LIFECYCLE_STAGES.map((stage, idx) => {
            const isCompleted = idx <= activeIndex;
            const isCurrent = idx === activeIndex;

            return (
              <React.Fragment key={stage.key}>
                <div className="flex flex-col items-center">
                  <div
                    className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] transition-colors ${
                      isCompleted
                        ? "bg-success text-background font-semibold"
                        : "border border-border bg-secondary text-muted-foreground"
                    } ${isCurrent ? "ring-2 ring-success/40" : ""}`}
                  >
                    {isCompleted ? <Check className="h-3 w-3" /> : idx + 1}
                  </div>
                  <span
                    className={`mt-1 text-[10px] text-center whitespace-nowrap ${
                      isCompleted ? "text-foreground font-medium" : "text-muted-foreground"
                    }`}
                  >
                    {stage.label}
                  </span>
                </div>
                {idx < LIFECYCLE_STAGES.length - 1 && (
                  <div
                    className={`h-[1px] flex-1 mx-1.5 transition-colors ${
                      idx < activeIndex ? "bg-success" : "bg-white/10"
                    }`}
                  />
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* Details Grid: Txn ID, Actor, Hash */}
      <div className="mt-3 grid grid-cols-2 gap-2 text-xs border-t border-border pt-3">
        <div>
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono block">Transaction ID</span>
          <span className="font-mono text-foreground select-all text-[11px] truncate block">
            {transactionId}
          </span>
        </div>
        <div>
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono block">Initiator</span>
          <span className="text-foreground text-[11px] truncate block">{agentName}</span>
        </div>
        <div className="col-span-2">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono block">Auth Signature Hash</span>
          <span className="font-mono text-muted-foreground text-[11px] select-all truncate block">
            {authHash}
          </span>
        </div>
      </div>

      {/* Action Footer */}
      <div className="mt-3 flex items-center justify-between pt-2 border-t border-border">
        <span className="text-[11px] text-muted-foreground">
          Settled via <strong className="text-foreground">{rail}</strong>
        </span>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onViewTrace?.(id)}
          className="h-7 px-2.5 text-xs text-foreground hover:bg-white/[0.04]"
        >
          <ExternalLink className="mr-1.5 h-3 w-3" />
          View Trace
        </Button>
      </div>
    </div>
  );
}
