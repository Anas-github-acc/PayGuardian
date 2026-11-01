"use client";

import * as React from "react";
import {
  ShieldCheck,
  ShieldAlert,
  GitCommit,
  ExternalLink,
  Copy,
  Clock,
  Layers,
  Code2,
  AlertTriangle,
  ArrowRight,
  Info,
  Check,
} from "lucide-react";
import { formatMinorUnits } from "../../app/lib/currency";
import { useWorkspaceStore } from "../../app/lib/workspace-store";
import { VerticalAuthChain } from "./VerticalAuthChain";
import { LifecycleTimeline } from "./LifecycleTimeline";
import { VerificationChecklist } from "./VerificationChecklist";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { DEFAULT_TRACES, type PaymentTrace } from "./types";

export interface PaymentTraceViewProps {
  traceId?: string | null;
  onClose?: () => void;
  className?: string;
}

export function PaymentTraceView({
  traceId,
  onClose,
  className = "",
}: PaymentTraceViewProps) {
  const store = useWorkspaceStore();
  const effectiveTraceId = traceId ?? store.selectedTraceId ?? "trace-pay-9018";

  // Look up trace from default fixtures or dynamically fallback
  const trace: PaymentTrace =
    DEFAULT_TRACES[effectiveTraceId] ??
    DEFAULT_TRACES["trace-pay-9018"] ??
    Object.values(DEFAULT_TRACES)[0];

  const [activeTab, setActiveTab] = React.useState<"chain" | "timeline" | "checklist">("chain");
  const [showRawRecord, setShowRawRecord] = React.useState<boolean>(false);
  const [copiedRecord, setCopiedRecord] = React.useState<boolean>(false);

  const handleCopyRaw = () => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      void navigator.clipboard.writeText(JSON.stringify(trace.rawRecord, null, 2));
      setCopiedRecord(true);
      setTimeout(() => setCopiedRecord(false), 2000);
    }
  };

  const isCompleted = trace.status === "completed";
  const isRejected = trace.status === "rejected";
  const isPending = trace.status === "pending_capture" || trace.status === "authorized";

  return (
    <div className={`mx-auto w-full max-w-[1200px] px-4 py-6 sm:px-6 lg:px-8 space-y-4 text-foreground ${className}`}>
      {/* Top Headline Banner */}
      <div className="rounded-lg border border-border bg-card p-4 top-shade">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-xs text-muted-foreground">{trace.id}</span>
            <Badge
              variant={isCompleted ? "authorized" : isRejected ? "rejected" : "pending"}
              showDot
            >
              {trace.status === "completed"
                ? "SETTLED & VERIFIED"
                : trace.status === "rejected"
                ? "GATEWAY REJECTED"
                : "PENDING CONFIRMATION"}
            </Badge>
            <span className="font-mono text-xs text-muted-foreground bg-white/[0.04] px-2 py-0.5 rounded border border-border">
              Rail: {trace.rail}
            </span>
          </div>

          <div className="flex items-center gap-3 font-mono text-xs text-muted-foreground">
            <span>Latency: {trace.totalLatencyMs}ms</span>
            {onClose && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onClose}
                className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
              >
                Close Trace
              </Button>
            )}
          </div>
        </div>

        {/* Amount & Recipient Summary */}
        <div className="mt-3 flex flex-col sm:flex-row sm:items-start justify-between gap-3">
          <div>
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono">
              Merchant / Recipient
            </span>
            <h3 className="text-base font-bold text-foreground tracking-tight">
              {trace.recipient}
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {trace.merchantCategory} &bull; Requested by {trace.requestingAgent.name}
            </p>
          </div>

          <div className="sm:text-right">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono">
              Transaction Amount
            </span>
            <div className="text-2xl font-bold font-mono text-success tabular-nums">
              {formatMinorUnits(trace.amountMinor, trace.currency)}
            </div>
            {trace.transactionId && (
              <span className="font-mono text-[11px] text-muted-foreground block mt-0.5">
                Txn: {trace.transactionId}
              </span>
            )}
          </div>
        </div>

        {/* Uncertain State Notice */}
        {(trace.uncertainStateNotice || trace.status === "pending_capture") && (
          <div className="mt-3 rounded-md border border-warning/30 bg-warning/10 p-3 text-xs">
            <div className="flex items-start gap-2.5">
              <Info className="h-4 w-4 text-warning shrink-0 mt-0.5" />
              <div>
                <strong className="font-semibold text-warning">Uncertain State Notice: </strong>
                <span className="text-foreground">
                  {trace.uncertainStateNotice ??
                    "Waiting for confirmation from payment provider. The money is held in reservation, not spent."}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Navigation Tabs & Developer Mode Toggle */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-2">
        <div className="inline-flex items-center gap-1 rounded-lg border border-border bg-card p-1 text-xs select-none">
          <button
            type="button"
            onClick={() => setActiveTab("chain")}
            className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
              activeTab === "chain"
                ? "bg-secondary text-foreground border border-border top-shade"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Layers className="h-3.5 w-3.5 text-success" />
            <span>Authorization Chain</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("timeline")}
            className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
              activeTab === "timeline"
                ? "bg-secondary text-foreground border border-border top-shade"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Clock className="h-3.5 w-3.5 text-warning" />
            <span>Lifecycle Stages (5)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("checklist")}
            className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
              activeTab === "checklist"
                ? "bg-secondary text-foreground border border-border top-shade"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <ShieldCheck className="h-3.5 w-3.5 text-success" />
            <span>Verification Matrix</span>
          </button>
        </div>

        {/* Developer Mode Raw Record Toggle */}
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowRawRecord(!showRawRecord)}
          className={`h-8 text-xs font-mono transition-colors ${
            showRawRecord ? "bg-white/[0.08] text-foreground" : "text-muted-foreground"
          }`}
        >
          <Code2 className="mr-1.5 h-3.5 w-3.5" />
          {showRawRecord ? "Hide Raw Record" : "Developer Mode (Raw Record)"}
        </Button>
      </div>

      {/* Raw Record Drawer (Developer Mode) */}
      {showRawRecord && (
        <div className="rounded-lg border border-border bg-card p-4 animate-in fade-in duration-150">
          <div className="flex items-center justify-between border-b border-border pb-2 mb-3">
            <span className="text-[11px] font-mono text-muted-foreground uppercase tracking-wider">
              Cryptographic Gateway JSON Payload & Hashes
            </span>
            <div className="flex items-center gap-2">
              {copiedRecord && (
                <span className="text-[11px] text-success font-sans">Copied to clipboard</span>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCopyRaw}
                className="h-7 text-xs text-muted-foreground hover:text-foreground"
              >
                <Copy className="mr-1.5 h-3 w-3" />
                Copy JSON
              </Button>
            </div>
          </div>
          <pre className="font-mono text-xs text-success overflow-x-auto max-h-80 leading-relaxed select-all">
            {JSON.stringify(trace.rawRecord, null, 2)}
          </pre>
        </div>
      )}

      {/* Active Tab View */}
      <div className="pt-2">
        {activeTab === "chain" && <VerticalAuthChain nodes={trace.authChain} />}
        {activeTab === "timeline" && <LifecycleTimeline stages={trace.stages} />}
        {activeTab === "checklist" && <VerificationChecklist checks={trace.checklist} />}
      </div>
    </div>
  );
}
