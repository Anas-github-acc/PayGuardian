"use client";

import * as React from "react";
import {
  ShieldCheck,
  ShieldAlert,
  Copy,
  Clock,
  Layers,
  Code2,
  AlertTriangle,
  Info,
  RefreshCw,
} from "lucide-react";
import { formatMinorUnits } from "../../app/lib/currency";
import { useWorkspaceStore } from "../../app/lib/workspace-store";
import { VerticalAuthChain } from "./VerticalAuthChain";
import { LifecycleTimeline } from "./LifecycleTimeline";
import { VerificationChecklist } from "./VerificationChecklist";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { usePaymentTrace } from "../../lib/api/hooks/use-payment-trace";

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
  const effectiveTraceId = traceId ?? store.selectedTraceId ?? null;

  const { trace, isLoading, error, isUnavailable, refetch } = usePaymentTrace(
    store.currentEnvironmentId,
    effectiveTraceId,
  );

  const [activeTab, setActiveTab] = React.useState<"chain" | "timeline" | "checklist">("chain");
  const [showRawRecord, setShowRawRecord] = React.useState<boolean>(false);
  const [copiedRecord, setCopiedRecord] = React.useState<boolean>(false);

  const handleCopyRaw = () => {
    if (typeof navigator !== "undefined" && navigator.clipboard && trace?.rawRecord) {
      void navigator.clipboard.writeText(JSON.stringify(trace.rawRecord, null, 2));
      setCopiedRecord(true);
      setTimeout(() => setCopiedRecord(false), 2000);
    }
  };

  // Empty state: no trace selected
  if (!effectiveTraceId) {
    return (
      <div className={`mx-auto w-full max-w-[1200px] px-4 py-8 sm:px-6 lg:px-8 text-foreground ${className}`}>
        <div className="rounded-xl border border-dashed border-zinc-800 bg-zinc-950 p-12 text-center min-h-[380px] flex flex-col items-center justify-center">
          <Layers className="h-10 w-10 text-zinc-600 mb-3" />
          <h3 className="text-base font-semibold text-white">No payment trace selected</h3>
          <p className="mt-1.5 max-w-md text-xs text-zinc-400 leading-relaxed">
            Select any transaction or audit event from the Activity Feed or Approvals queue to inspect its cryptographic authorization chain, mandate policy decisions, and settlement record.
          </p>
          {onClose && (
            <Button
              variant="outline"
              size="sm"
              onClick={onClose}
              className="mt-4 border-zinc-800 bg-zinc-900 text-xs text-zinc-300 hover:text-white"
            >
              Close
            </Button>
          )}
        </div>
      </div>
    );
  }

  // Loading skeleton matching container dimensions without layout shift
  if (isLoading && !trace) {
    return (
      <div className={`mx-auto w-full max-w-[1200px] px-4 py-6 sm:px-6 lg:px-8 space-y-4 text-foreground ${className}`}>
        <div className="h-36 rounded-lg border border-border bg-card/60 animate-pulse" />
        <div className="h-10 w-72 rounded-lg border border-border bg-card/60 animate-pulse" />
        <div className="h-[360px] rounded-lg border border-border bg-card/60 animate-pulse" />
      </div>
    );
  }

  // Error state with retry
  if (error && !trace) {
    return (
      <div className={`mx-auto w-full max-w-[1200px] px-4 py-8 sm:px-6 lg:px-8 text-foreground ${className}`}>
        <div className="rounded-xl border border-red-900/40 bg-red-950/20 p-8 text-center min-h-[320px] flex flex-col items-center justify-center">
          <AlertTriangle className="h-8 w-8 text-red-400 mb-2" />
          <h3 className="text-sm font-semibold text-white">Failed to load payment trace</h3>
          <p className="mt-1 text-xs text-zinc-400 max-w-md">{error.message}</p>
          <div className="mt-4 flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => void refetch()}
              className="border-zinc-800 bg-zinc-900 text-xs text-zinc-300 hover:text-white"
            >
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
              Retry Connection
            </Button>
            {onClose && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onClose}
                className="text-xs text-zinc-400 hover:text-white"
              >
                Close
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Unavailable state: actionId not found in backend
  if (isUnavailable || !trace) {
    return (
      <div className={`mx-auto w-full max-w-[1200px] px-4 py-8 sm:px-6 lg:px-8 text-foreground ${className}`}>
        <div className="rounded-xl border border-dashed border-zinc-800 bg-zinc-950 p-8 text-center min-h-[320px] flex flex-col items-center justify-center">
          <ShieldAlert className="h-8 w-8 text-amber-500/60 mb-2" />
          <h3 className="text-sm font-semibold text-white">Payment Trace Unavailable</h3>
          <p className="mt-1.5 max-w-md text-xs text-zinc-400 leading-relaxed">
            No action record or payment trace exists for &quot;{effectiveTraceId}&quot; in environment &quot;{store.currentEnvironmentId || "default"}&quot;.
          </p>
          <div className="mt-4 flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => void refetch()}
              className="border-zinc-800 bg-zinc-900 text-xs text-zinc-300 hover:text-white"
            >
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
              Retry
            </Button>
            {onClose && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onClose}
                className="text-xs text-zinc-400 hover:text-white"
              >
                Close
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  }

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
                : isPending
                ? "PENDING CONFIRMATION"
                : "EXECUTION FAILED"}
            </Badge>
            <span className="font-mono text-xs text-muted-foreground bg-white/[0.04] px-2 py-0.5 rounded border border-border">
              Rail: {trace.rail}
            </span>
          </div>

          <div className="flex items-center gap-3 font-mono text-xs text-muted-foreground">
            <span>
              Latency: {trace.totalLatencyMs > 0 ? `${trace.totalLatencyMs}ms` : "Unavailable (GAP-TRC-01)"}
            </span>
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
            <span>Lifecycle Stages</span>
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
