"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  BarChart2,
  ShieldCheck,
  AlertTriangle,
  Loader2,
  Info,
  MoreHorizontal,
  Maximize2,
  Minimize2,
  CheckCircle2,
  TrendingDown,
  ChevronRight,
} from "lucide-react";
import { Badge } from "@/components/ui/badge-2";
import { Button } from "@/components/ui/button-1";
import { Card, CardContent, CardHeader, CardTitle, CardToolbar } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatMinorUnits } from "../../app/lib/currency";
import { cn } from "@/lib/utils";

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
  isMinimized?: boolean;
  onToggleMinimize?: () => void;
  className?: string;
}

export function ProposedBudgetCard({
  mandateId,
  currency = "INR",
  rootBudgetMinor = 1000000,
  totalProposedMinor,
  allocations = [],
  onApprove,
  onDeny,
  isMinimized = false,
  onToggleMinimize,
  className,
}: ProposedBudgetCardProps) {
  const [isApproving, setIsApproving] = React.useState(false);
  const [isDenying, setIsDenying] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  const safeTotal = Math.round(Number(totalProposedMinor) || 0);
  const safeRoot = Math.round(Number(rootBudgetMinor) || 1000000);
  const remainingMinor = Math.max(0, safeRoot - safeTotal);

  const handleApprove = async (e?: React.MouseEvent) => {
    e?.stopPropagation();
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

  const handleDeny = async (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setIsDenying(true);
    setErrorMessage(null);
    try {
      await onDeny();
    } finally {
      setIsDenying(false);
    }
  };

  // 1. Minimized state: sleek floating card in top-right of chat interface
  if (isMinimized) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: -8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: -8 }}
        transition={{ type: "spring", stiffness: 400, damping: 28 }}
        className={cn(
          "w-full max-w-[340px] rounded-xl border border-primary/30 bg-zinc-900/95 backdrop-blur-md shadow-xl shadow-black/50 p-3.5 flex flex-col gap-2.5 transition-all duration-200 hover:border-primary/50",
          className
        )}
      >
        <div className="flex items-center justify-between gap-2">
          <div
            className="flex items-center gap-2 cursor-pointer select-none group min-w-0"
            onClick={onToggleMinimize}
            title="Click to expand proposal"
          >
            <div className="flex size-7 items-center justify-center rounded-lg bg-primary/10 border border-primary/20 text-primary shrink-0">
              <BarChart2 className="size-4 text-primary" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-semibold text-foreground group-hover:text-primary transition-colors truncate">
                  Budget Proposal
                </span>
                <Badge variant="warning" appearance="light" size="xs">
                  Pending
                </Badge>
              </div>
              <div className="text-[10px] text-muted-foreground truncate font-mono">
                Mandate: {mandateId ? `${mandateId.slice(0, 10)}...` : "root"}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <span className="text-sm font-bold font-mono text-foreground tracking-tight">
              {formatMinorUnits(safeTotal, currency)}
            </span>
            {onToggleMinimize && (
              <Button
                variant="dim"
                size="sm"
                mode="icon"
                onClick={onToggleMinimize}
                title="Expand proposal details"
                className="size-7 hover:bg-muted"
              >
                <Maximize2 className="size-3.5" />
              </Button>
            )}
          </div>
        </div>

        {/* Quick Actions in Minimized State */}
        <div className="flex items-center justify-between gap-2 pt-1 border-t border-border/40">
          <span className="text-[11px] text-muted-foreground truncate">
            {allocations.length} specialist{allocations.length !== 1 ? "s" : ""}
          </span>
          <div className="flex items-center gap-1.5">
            <Button
              variant="outline"
              size="sm"
              disabled={isApproving || isDenying}
              onClick={handleDeny}
              className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
            >
              {isDenying ? <Loader2 className="size-3 animate-spin mr-1" /> : null}
              Reject
            </Button>
            <Button
              variant="primary"
              size="sm"
              disabled={isApproving || isDenying}
              onClick={handleApprove}
              className="h-6 px-2.5 text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {isApproving ? <Loader2 className="size-3 animate-spin mr-1" /> : null}
              Approve
            </Button>
          </div>
        </div>
      </motion.div>
    );
  }

  // 2. Full Expanded State: statistic-card-10 rich design
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96, y: 10 }}
      transition={{ type: "spring", stiffness: 350, damping: 26 }}
      className={cn("w-full max-w-xl mx-auto my-2", className)}
    >
      <Card className="w-full border border-border/80 bg-zinc-900/90 shadow-2xl backdrop-blur-md rounded-2xl overflow-hidden">
        {/* Card Header with Icon, Title, and Toolbar */}
        <CardHeader className="border-b border-border/50 py-4 px-5 min-h-auto">
          <CardTitle className="inline-flex items-center gap-2.5 text-base sm:text-lg">
            <div className="flex size-9 items-center justify-center rounded-xl bg-primary/10 border border-primary/20 text-primary">
              <BarChart2 className="size-5 text-primary" />
            </div>
            <div>
              <div className="font-semibold text-foreground tracking-tight leading-snug">
                Proposed Budget Allocation
              </div>
              <div className="text-xs text-muted-foreground font-normal">
                Cryptographic mandate spending proposal
              </div>
            </div>
          </CardTitle>

          <CardToolbar>
            {onToggleMinimize && (
              <Button
                variant="dim"
                size="sm"
                mode="icon"
                onClick={onToggleMinimize}
                title="Minimize proposal to top right"
                className="hover:bg-muted"
              >
                <Minimize2 className="size-4" />
              </Button>
            )}

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="dim" size="sm" mode="icon" className="hover:bg-muted">
                  <MoreHorizontal className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" side="bottom">
                <DropdownMenuItem onClick={onToggleMinimize}>
                  <Minimize2 className="size-4 mr-2" />
                  Minimize to Top Right
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => {
                    navigator.clipboard.writeText(mandateId);
                  }}
                >
                  <ShieldCheck className="size-4 mr-2" />
                  Copy Root Mandate ID
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" onClick={handleDeny}>
                  Reject Proposal
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </CardToolbar>
        </CardHeader>

        {/* Card Content with Total, Trend/Buffer, Specialist Rows, and Actions */}
        <CardContent className="flex flex-col justify-between gap-4 p-5">
          <div className="space-y-3.5">
            {/* Total Proposed Amount */}
            <div className="flex items-baseline gap-2.5">
              <span className="text-3xl sm:text-4xl font-bold font-mono text-foreground tracking-tight">
                {formatMinorUnits(safeTotal, currency)}
              </span>
              <span className="text-xs text-muted-foreground font-mono font-medium leading-none px-2 py-0.5 rounded bg-muted/60 border border-border/40">
                {currency}
              </span>
            </div>

            {/* Revenue Trend / Buffer Badge */}
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="success" appearance="light" className="gap-1.5 font-mono">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="inline-block">
                  <path
                    d="M3 5.5L7 9.5L11 5.5"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                Buffer: {formatMinorUnits(remainingMinor, currency)}
              </Badge>
              <span className="text-xs text-muted-foreground">
                remaining from root ceiling ({formatMinorUnits(safeRoot, currency)})
              </span>
            </div>
          </div>

          {/* Specialist breakdown rows matching StatisticCard10 p-2.5 bg-muted/60 style */}
          <div className="space-y-2">
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider px-1">
              Proposed Specialist Delegations
            </div>
            {allocations.map((item) => {
              const isChild = item.isChild || Boolean(item.parentAgent);
              const itemMinor = Math.round(Number(item.requestedMandateMinor ?? item.quotedCostMinor) || 0);
              return (
                <div
                  key={item.agent}
                  className="p-3 bg-muted/50 hover:bg-muted/70 border border-border/40 flex items-center justify-between rounded-xl transition-colors"
                >
                  <div className="min-w-0 pr-3">
                    <div className="flex items-center gap-1.5 font-medium text-foreground text-sm">
                      {isChild ? <span className="text-amber-400 font-mono text-xs">↳</span> : null}
                      <span className="truncate">{item.role}</span>
                      {isChild ? (
                        <span className="rounded bg-muted px-1.5 py-0.2 font-mono text-[10px] text-muted-foreground">
                          under {item.parentAgent || "Travel"}
                        </span>
                      ) : null}
                    </div>
                    <div className="text-xs text-muted-foreground truncate mt-0.5">
                      {item.reasoning || item.description || `Autonomous ${item.agent} execution`}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-sm sm:text-base font-semibold font-mono text-foreground">
                      {formatMinorUnits(itemMinor, currency)}
                    </span>
                    <div className="text-[10px] text-emerald-400 font-mono">
                      child mandate
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Error Message banner */}
          {errorMessage && (
            <div className="flex items-start gap-2 rounded-xl border border-destructive/50 bg-destructive/10 p-3 text-xs text-destructive">
              <AlertTriangle className="size-4 shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <div className="font-semibold">Mandate Authorization Failed</div>
                <div>{errorMessage}</div>
              </div>
            </div>
          )}

          {/* Security Notice */}
          <div className="flex items-start gap-2 rounded-xl bg-muted/30 p-3 text-xs text-muted-foreground border border-border/50">
            <Info className="size-4 text-primary shrink-0 mt-0.5" />
            <span>
              <strong className="text-foreground">Security Guarantee:</strong> Child mandates remain unissued until you approve. Specialist agents cannot draw funds without signed cryptographic authority.
            </span>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <Button
              variant="outline"
              size="sm"
              disabled={isApproving || isDenying}
              onClick={handleDeny}
              className="border-border bg-background hover:bg-muted text-foreground text-xs"
            >
              {isDenying ? <Loader2 className="mr-1.5 size-3.5 animate-spin" /> : null}
              Reject Proposal
            </Button>

            <Button
              variant="primary"
              size="sm"
              disabled={isApproving || isDenying}
              onClick={handleApprove}
              className="bg-primary hover:bg-primary/90 text-primary-foreground font-medium px-4 text-xs"
            >
              {isApproving ? <Loader2 className="mr-1.5 size-3.5 animate-spin" /> : null}
              Approve & Delegate Mandates
            </Button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
