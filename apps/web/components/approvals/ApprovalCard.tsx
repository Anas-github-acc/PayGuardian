"use client";

import * as React from "react";
import {
  CheckCircle2,
  Clock,
  X,
  AlertTriangle,
  ChevronRight,
  SlidersHorizontal,
} from "lucide-react";
import { formatMinorUnits } from "../../app/lib/currency";
import type { ApprovalItem } from "./types";

export interface ApprovalCardProps {
  approval: ApprovalItem;
  onApprove: (id: string) => Promise<void> | void;
  onReject: (id: string, reason?: string) => Promise<void> | void;
  onViewTrace?: (traceId: string) => void;
  onOpenDetails?: (approval: ApprovalItem) => void;
  onAmendLimit?: (mandateId: string) => void;
  isProcessing?: boolean;
  className?: string;
}

function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(diffMs)) return "just now";
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function ApprovalCard({
  approval,
  onApprove,
  onReject,
  onViewTrace,
  onOpenDetails,
  onAmendLimit,
  isProcessing = false,
  className = "",
}: ApprovalCardProps) {
  const [rejecting, setRejecting] = React.useState(false);
  const [rejectionNote, setRejectionNote] = React.useState("");

  const isPending = approval.status === "pending";
  const isApproved = approval.status === "approved";
  const isRejected = approval.status === "rejected";
  const isExpired = approval.status === "expired";

  // Expiry countdown for pending requests
  const [timeLeft, setTimeLeft] = React.useState<string>("");

  React.useEffect(() => {
    function updateCountdown() {
      if (!approval.expiresAt) return;
      const diff = new Date(approval.expiresAt).getTime() - Date.now();
      if (diff <= 0) {
        setTimeLeft("Expired");
      } else {
        const mins = Math.floor(diff / 60000);
        const secs = Math.floor((diff % 60000) / 1000);
        if (mins > 60) {
          const hours = Math.floor(mins / 60);
          setTimeLeft(`${hours}h ${mins % 60}m`);
        } else {
          setTimeLeft(`${mins}m ${secs}s`);
        }
      }
    }
    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [approval.expiresAt]);

  const canApprove = approval.allowedActions
    ? approval.allowedActions.includes("approve")
    : !approval.isHardLimitExceeded && isPending;
  const canReject = approval.allowedActions
    ? approval.allowedActions.includes("reject")
    : isPending;

  const handleOpenDetails = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    onOpenDetails?.(approval);
  };

  const handleApprove = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!canApprove || isProcessing) return;
    await onApprove(approval.id);
  };

  const handleDenyClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!canReject || isProcessing) return;
    setRejecting(true);
  };

  const handleConfirmReject = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!canReject || isProcessing) return;
    await onReject(approval.id, rejectionNote.trim() || undefined);
    setRejecting(false);
  };

  // Status icon tile
  const tileClass = isPending
    ? "border-amber-900/50 bg-amber-950/40 text-amber-400"
    : isApproved
      ? "border-blue-900/50 bg-blue-950/40 text-blue-400"
      : isRejected
        ? "border-red-900/50 bg-red-950/40 text-red-400"
        : "border-zinc-800 bg-zinc-900 text-zinc-500";
  const TileIcon = isPending ? Clock : isApproved ? CheckCircle2 : isRejected ? X : Clock;

  return (
    <article
      aria-label={`Approval request for ${approval.purpose}`}
      onClick={handleOpenDetails}
      className={`cursor-pointer rounded-xl border p-4 text-white transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-700 shadow-sm ${
        isRejected
          ? "border-red-900/40 bg-red-950/20 hover:bg-red-950/30"
          : "border-zinc-800 bg-zinc-950 hover:bg-zinc-900/60"
      } ${className}`}
    >
      {/* Mobile: icon + content stack, actions on their own row.
          sm+: display:contents restores the original icon | content | actions row. */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:gap-3">
        <div className="flex min-w-0 items-start gap-3 sm:contents">
          {/* Status icon tile */}
          <span
            aria-hidden
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border ${tileClass}`}
          >
            <TileIcon className="h-4 w-4" />
          </span>

          {/* Title + subtitle */}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="line-clamp-2 text-xs font-semibold text-white sm:truncate">
                {approval.agentName}
                <span className="text-zinc-600"> · </span>
                {approval.purpose}
              </span>
              {isPending && timeLeft && (
                <span className="rounded-md border border-amber-900/60 bg-amber-950/40 px-2 py-0.5 text-[10px] font-mono text-amber-400 shrink-0">
                  {timeLeft === "Expired" ? "expired" : `expires in ${timeLeft}`}
                </span>
              )}
              {isApproved && (
                <span className="rounded-md border border-blue-900/60 bg-blue-950/40 px-2 py-0.5 text-[10px] font-mono text-blue-400 shrink-0">
                  approved
                </span>
              )}
              {isExpired && (
                <span className="rounded-md border border-zinc-800 bg-zinc-900 px-2 py-0.5 text-[10px] font-mono text-zinc-400 shrink-0">
                  expired
                </span>
              )}
            </div>

            {/* Muted subtitle: amount · reason · time (wraps on mobile) */}
            <p className="mt-1 text-[11px] text-zinc-400 sm:truncate">
              <span className="font-mono font-medium text-white">
                {formatMinorUnits(approval.amountMinor, approval.currency)}
              </span>
              <span aria-hidden className="text-zinc-600">
                {" "}
                ·{" "}
              </span>
              {approval.reasonForSignOff}
              <span aria-hidden className="text-zinc-600">
                {" "}
                ·{" "}
              </span>
              <span className="font-mono text-zinc-500">{relativeTime(approval.createdAt)}</span>
            </p>

            {/* Outcome notes for decided requests */}
            {isApproved && approval.approvedBy && (
              <p className="mt-1 text-[11px] text-zinc-400 sm:truncate">
                Decided by {approval.approvedBy}
                {approval.approvedAt && ` at ${new Date(approval.approvedAt).toLocaleTimeString()}`}
              </p>
            )}
            {isRejected && approval.rejectionReason && (
              <p className="mt-1 line-clamp-2 text-[11px] text-red-400 font-mono">
                {approval.rejectionReason}
              </p>
            )}

            {/* Hard limit guardrail */}
            {isPending && approval.isHardLimitExceeded && (
              <div className="mt-2 flex flex-wrap items-center gap-2 rounded-lg border border-red-900/40 bg-red-950/20 px-3 py-2">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-red-400" />
                <span className="min-w-0 flex-1 text-[11px] leading-snug text-red-300">
                  {approval.hardLimitExceededReason ??
                    "Exceeds ancestor mandate budget — approval locked until the limit is amended."}
                </span>
                {onAmendLimit && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onAmendLimit(approval.mandateId);
                    }}
                    className="h-7 shrink-0 rounded-md border border-red-900/60 bg-red-950 px-2.5 text-[11px] text-red-400 hover:bg-red-900/40 transition-colors flex items-center gap-1.5"
                  >
                    <SlidersHorizontal className="h-3 w-3" />
                    Amend limit
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Trailing actions — own row (right-aligned) on mobile */}
        <div
          className="flex shrink-0 flex-wrap items-center justify-end gap-2 self-end sm:self-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {isPending && !rejecting && (
            <>
              <button
                type="button"
                onClick={handleDenyClick}
                disabled={!canReject || isProcessing}
                className="h-8 px-3 rounded-lg border border-zinc-800 bg-zinc-900 text-xs font-medium text-zinc-300 hover:bg-zinc-800 hover:text-white transition-colors flex items-center gap-1"
              >
                <X className="h-3.5 w-3.5" />
                Deny
              </button>
              <button
                type="button"
                onClick={handleApprove}
                disabled={!canApprove || isProcessing}
                className="h-8 px-3.5 rounded-lg bg-blue-600 text-xs font-medium text-white hover:bg-blue-500 transition-colors shadow-sm disabled:opacity-50 flex items-center gap-1.5"
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                Approve
              </button>
            </>
          )}
          {!isPending && onViewTrace && (
            <button
              type="button"
              onClick={() => onViewTrace(approval.id)}
              className="h-8 px-3 rounded-lg border border-zinc-800 bg-zinc-900/80 text-xs font-medium text-zinc-300 hover:bg-zinc-800 hover:text-white transition-colors"
            >
              Trace
            </button>
          )}
          <ChevronRight aria-hidden className="h-4 w-4 shrink-0 text-zinc-500" />
        </div>
      </div>

      {/* Inline rejection note flow */}
      {isPending && rejecting && (
        <div
          className="mt-3 rounded-lg border border-zinc-800 bg-zinc-900/60 p-3"
          onClick={(e) => e.stopPropagation()}
        >
          <label
            htmlFor={`reject-note-${approval.id}`}
            className="mb-1.5 block text-[11px] font-medium text-zinc-400"
          >
            Rejection reason (optional note sent back to the agent):
          </label>
          <input
            id={`reject-note-${approval.id}`}
            type="text"
            value={rejectionNote}
            onChange={(e) => setRejectionNote(e.target.value)}
            placeholder="e.g. Rate too expensive, please re-book economy class"
            className="h-8 w-full rounded-lg border border-zinc-800 bg-zinc-900 px-2.5 text-xs text-zinc-200 placeholder:text-zinc-500 focus:border-red-500 focus:outline-none"
          />
          <div className="mt-2.5 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setRejecting(false)}
              disabled={isProcessing}
              className="h-8 px-3 rounded-lg border border-zinc-800 bg-zinc-900 text-xs text-zinc-400 hover:text-white"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirmReject}
              disabled={isProcessing}
              className="h-8 px-3.5 rounded-lg bg-red-600 text-xs font-medium text-white hover:bg-red-500 transition-colors"
            >
              Confirm denial
            </button>
          </div>
        </div>
      )}
    </article>
  );
}
