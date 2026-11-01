"use client";

import * as React from "react";
import {
  ShieldAlert,
  ShieldCheck,
  Check,
  X,
  ExternalLink,
  Copy,
  Clock,
  Layers,
  FileCode,
  AlertTriangle,
  ChevronRight,
  Info,
} from "lucide-react";
import { formatMinorUnits } from "../../app/lib/currency";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from "../ui/sheet";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import type { ApprovalItem } from "./types";

export interface ApprovalDetailDrawerProps {
  approval: ApprovalItem | null;
  isOpen: boolean;
  onClose: () => void;
  onApprove: (id: string) => Promise<void> | void;
  onReject: (id: string, reason?: string) => Promise<void> | void;
  onViewTrace?: (traceId: string) => void;
  isProcessing?: boolean;
}

export function ApprovalDetailDrawer({
  approval,
  isOpen,
  onClose,
  onApprove,
  onReject,
  onViewTrace,
  isProcessing = false,
}: ApprovalDetailDrawerProps) {
  const [copiedHash, setCopiedHash] = React.useState(false);
  const [rejecting, setRejecting] = React.useState(false);
  const [rejectionNote, setRejectionNote] = React.useState("");

  if (!approval) return null;

  const isPending = approval.status === "pending";

  const handleCopyHash = () => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      void navigator.clipboard.writeText(approval.requestHash);
      setCopiedHash(true);
      setTimeout(() => setCopiedHash(false), 2000);
    }
  };

  const handleApprove = async () => {
    if (approval.isHardLimitExceeded || !isPending || isProcessing) return;
    await onApprove(approval.id);
    onClose();
  };

  const handleReject = async () => {
    if (!isPending || isProcessing) return;
    await onReject(approval.id, rejectionNote.trim() || undefined);
    setRejecting(false);
    onClose();
  };

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-xl bg-zinc-950 border-l border-zinc-800 p-6 text-white overflow-y-auto">
        <SheetHeader className="mb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Badge
                variant={
                  approval.status === "pending"
                    ? "pending"
                    : approval.status === "approved"
                    ? "active"
                    : "rejected"
                }
                showDot
              >
                {approval.status.toUpperCase()}
              </Badge>
              <span className="font-mono text-xs text-zinc-500">{approval.id}</span>
            </div>
            {onViewTrace && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  onClose();
                  onViewTrace(approval.id);
                }}
                className="h-7 px-2 text-xs border-zinc-800 bg-zinc-900 text-zinc-300 hover:text-white"
              >
                <ExternalLink className="mr-1 h-3 w-3" />
                Trace
              </Button>
            )}
          </div>
          <SheetTitle className="mt-2 text-lg font-bold tracking-tight text-white">
            {approval.purpose}
          </SheetTitle>
          <SheetDescription className="text-xs text-zinc-400">
            Initiated by {approval.agentName} ({approval.action}) at{" "}
            {new Date(approval.createdAt).toLocaleString()}
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-5 text-xs">
          {/* Amount Card */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
            <div className="flex items-baseline justify-between">
              <div>
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono">
                  Requested Payment
                </span>
                <div className="text-2xl font-bold font-mono text-foreground tabular-nums mt-0.5">
                  {formatMinorUnits(approval.amountMinor, approval.currency)}
                </div>
              </div>
              <div className="text-right">
                <span className="text-[10px] uppercase tracking-wider text-zinc-500 font-mono">
                  Remaining Headroom
                </span>
                <div
                  className={`text-base font-bold font-mono tabular-nums mt-0.5 ${
                    approval.remainingBudgetAfterPaymentMinor < 0
                      ? "text-red-400"
                      : "text-blue-400"
                  }`}
                >
                  {formatMinorUnits(
                    Math.max(0, approval.remainingBudgetAfterPaymentMinor),
                    approval.currency
                  )}
                </div>
              </div>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2 border-t border-zinc-800/80 pt-3 text-[11px]">
              <div>
                <span className="text-zinc-500">Merchant:</span>{" "}
                <span className="text-zinc-200 font-medium">{approval.recipient}</span>
              </div>
              <div>
                <span className="text-zinc-500">Category:</span>{" "}
                <span className="text-zinc-300">{approval.merchantCategory}</span>
              </div>
            </div>
          </div>

          {/* Reason for Human Sign-Off */}
          <div className="rounded-xl border border-amber-900/40 bg-amber-950/20 p-3.5">
            <div className="flex items-start gap-2.5">
              <Info className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <div className="font-semibold text-amber-400">Why Sign-Off is Required:</div>
                <p className="mt-1 text-zinc-300 leading-relaxed">
                  {approval.reasonForSignOff}
                </p>
              </div>
            </div>
          </div>

          {/* Hard Limit Exceeded Guardrail */}
          {approval.isHardLimitExceeded && (
            <div className="rounded-xl border border-red-900/40 bg-red-950/20 p-3.5">
              <div className="flex items-start gap-2.5">
                <AlertTriangle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold text-red-400">Hard Mandate Limit Violation</div>
                  <p className="mt-1 text-red-300/90 leading-relaxed">
                    {approval.hardLimitExceededReason ??
                      "The requested amount exceeds the active mandate headroom allocated by the environment root."}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Ancestor Authorization Chain */}
          <div>
            <div className="text-[10px] uppercase tracking-wider text-zinc-500 font-mono mb-2">
              Authorization Propagation Chain
            </div>
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-3 space-y-2">
              {approval.ancestorChain.map((node, idx) => (
                <div key={node.id} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-zinc-800 text-[10px] font-mono text-zinc-400">
                      {idx + 1}
                    </span>
                    <span className="font-medium text-zinc-200">{node.name}</span>
                  </div>
                  <span className="text-[11px] text-zinc-500 font-mono">{node.role}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Cryptographic SHA-256 Parameter Hash */}
          <div>
            <div className="flex items-center justify-between text-[10px] uppercase tracking-wider text-zinc-500 font-mono mb-1.5">
              <span>Request Parameter Hash</span>
              {copiedHash && <span className="text-blue-400 font-sans">Copied</span>}
            </div>
            <div className="relative rounded-lg border border-zinc-800 bg-zinc-900/60 p-2.5 font-mono text-[11px] text-zinc-400 break-all select-all flex items-center justify-between">
              <span>{approval.requestHash}</span>
              <button
                type="button"
                onClick={handleCopyHash}
                aria-label="Copy full request hash"
                className="ml-2 shrink-0 p-1 text-muted-foreground hover:text-foreground"
              >
                <Copy className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* Action Parameters Payload */}
          {approval.parameters && (
            <div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono mb-1.5 flex items-center gap-1.5">
                <FileCode className="h-3 w-3 text-muted-foreground" />
                Action Parameters Payload
              </div>
              <pre className="rounded-md border border-border bg-card p-3 font-mono text-[11px] text-muted-foreground overflow-x-auto leading-relaxed">
                {JSON.stringify(approval.parameters, null, 2)}
              </pre>
            </div>
          )}
        </div>

        {/* Action Decision Footer */}
        {isPending && (
          <SheetFooter className="mt-6 pt-4 border-t border-border">
            {rejecting ? (
              <div className="w-full space-y-3">
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">
                    Rejection Rationale (Dispatched back to agent):
                  </label>
                  <input
                    type="text"
                    value={rejectionNote}
                    onChange={(e) => setRejectionNote(e.target.value)}
                    placeholder="Enter reason for declining..."
                    className="w-full rounded border border-border bg-card px-3 py-2 text-xs text-foreground focus:outline-none focus:border-border"
                  />
                </div>
                <div className="flex items-center justify-end gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setRejecting(false)}
                    className="min-h-[44px] sm:min-h-[32px]"
                  >
                    Back
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={handleReject}
                    disabled={isProcessing}
                    className="min-h-[44px] sm:min-h-[32px] px-4 font-semibold"
                  >
                    Confirm Rejection
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex w-full flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2.5">
                <Button
                  variant="outline"
                  onClick={() => setRejecting(true)}
                  disabled={isProcessing}
                  className="min-h-[44px] sm:min-h-[36px] border-destructive/30 text-destructive hover:bg-destructive/10"
                >
                  <X className="mr-1.5 h-4 w-4" />
                  Reject
                </Button>
                <Button
                  variant="primary"
                  onClick={handleApprove}
                  disabled={approval.isHardLimitExceeded || isProcessing}
                  className="min-h-[44px] sm:min-h-[36px] bg-success hover:bg-success text-black font-semibold"
                >
                  <Check className="mr-1.5 h-4 w-4" />
                  {approval.isHardLimitExceeded ? "Locked (Over Limit)" : "Approve with Passkey"}
                </Button>
              </div>
            )}
          </SheetFooter>
        )}
      </SheetContent>
    </Sheet>
  );
}
