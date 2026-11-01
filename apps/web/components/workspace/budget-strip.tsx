"use client";

import * as React from "react";
import { Wallet } from "lucide-react";
import { formatMinorUnits, calculateAvailableMinor } from "../../app/lib/currency";
import { useWorkspaceStore } from "../../app/lib/workspace-store";
import { Badge } from "../ui/badge";

export interface BudgetStripProps {
  className?: string;
  currency?: string;
  totalLimitMinor?: number;
  spentMinor?: number;
  reservedMinor?: number;
}

export function BudgetStrip({
  className = "",
  currency: propCurrency,
  totalLimitMinor: propLimit,
  spentMinor: propSpent,
  reservedMinor: propReserved,
}: BudgetStripProps) {
  const store = useWorkspaceStore();
  const currentEnv = store.currentEnvironment;

  const currency = propCurrency ?? currentEnv?.currency ?? "USD";
  const limitMinor = propLimit ?? currentEnv?.budgetLimitMinor ?? 1000000;
  const spentMinor = propSpent ?? currentEnv?.spentMinor ?? 245000;
  const reservedMinor = propReserved ?? currentEnv?.reservedMinor ?? 150000;

  // Strict integer minor unit math — ZERO float arithmetic
  const availableMinor = calculateAvailableMinor(limitMinor, spentMinor, reservedMinor);

  const spentPercent = limitMinor > 0 ? Math.min(100, Math.round((spentMinor / limitMinor) * 1000) / 10) : 0;
  const reservedPercent = limitMinor > 0 ? Math.min(100 - spentPercent, Math.round((reservedMinor / limitMinor) * 1000) / 10) : 0;
  const availablePercent = Math.max(0, Math.round((100 - spentPercent - reservedPercent) * 10) / 10);

  return (
    <section
      aria-label="Budget authority"
      className={`rounded-lg border border-border bg-card text-foreground top-shade ${className}`}
    >
      {/* Header row: icon tile + title, environment pill on the right */}
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border bg-secondary text-success">
            <Wallet className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <h3 className="truncate text-sm font-semibold tracking-tight text-foreground">
              Budget authority
            </h3>
            <p className="truncate text-[11px] text-muted-foreground">
              {currentEnv?.name ?? "Travel & Hospitality"}
            </p>
          </div>
        </div>
        <Badge variant="secondary" className="shrink-0 font-mono uppercase">
          {currentEnv?.type ?? "sandbox"}
        </Badge>
      </div>

      <div className="px-4 py-4">
        {/* Big value + suffix */}
        <div className="flex items-baseline gap-1.5">
          <span className="text-2xl font-semibold tabular-nums text-foreground">
            {formatMinorUnits(availableMinor, currency)}
          </span>
          <span className="text-xs text-muted-foreground">available</span>
        </div>

        {/* Delta chip + context */}
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Badge variant={availableMinor > 0 ? "success" : "rejected"} showDot>
            {availablePercent}% free
          </Badge>
          <span className="text-xs text-muted-foreground">
            of {formatMinorUnits(limitMinor, currency)} total limit
          </span>
        </div>

        {/* Key/value rows on a subtly muted background */}
        <dl className="mt-4 overflow-hidden rounded-md border border-border bg-secondary/50">
          <div className="flex items-center justify-between px-3 py-2 text-xs">
            <dt className="text-muted-foreground">Total limit</dt>
            <dd className="font-medium tabular-nums text-foreground">
              {formatMinorUnits(limitMinor, currency)}
            </dd>
          </div>
          <div className="flex items-center justify-between border-t border-border px-3 py-2 text-xs">
            <dt className="text-muted-foreground">Spent ({spentPercent}%)</dt>
            <dd className="font-medium tabular-nums text-foreground">
              {formatMinorUnits(spentMinor, currency)}
            </dd>
          </div>
          <div className="flex items-center justify-between border-t border-border px-3 py-2 text-xs">
            <dt className="text-muted-foreground">Reserved ({reservedPercent}%)</dt>
            <dd className="font-medium tabular-nums text-warning">
              {formatMinorUnits(reservedMinor, currency)}
            </dd>
          </div>
        </dl>

        {/* Segmented capacity bar */}
        <div
          className="mt-4 flex h-2 w-full overflow-hidden rounded-full bg-secondary"
          role="img"
          aria-label={`Spent ${spentPercent}%, reserved ${reservedPercent}%, available ${availablePercent}%`}
        >
          {spentPercent > 0 && (
            <div
              style={{ width: `${spentPercent}%` }}
              className="bg-chart-3 transition-all duration-300"
              title={`Spent: ${formatMinorUnits(spentMinor, currency)} (${spentPercent}%)`}
            />
          )}
          {reservedPercent > 0 && (
            <div
              style={{ width: `${reservedPercent}%` }}
              className="bg-warning transition-all duration-300"
              title={`Reserved: ${formatMinorUnits(reservedMinor, currency)} (${reservedPercent}%)`}
            />
          )}
          {availablePercent > 0 && (
            <div
              style={{ width: `${availablePercent}%` }}
              className="bg-success/70 transition-all duration-300"
              title={`Available: ${formatMinorUnits(availableMinor, currency)} (${availablePercent}%)`}
            />
          )}
        </div>

        <div className="mt-2.5 flex items-center gap-3 text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-chart-3" /> Spent
          </span>
          <span className="flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-warning" /> Reserved
          </span>
          <span className="flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-success/70" /> Available
          </span>
        </div>
      </div>
    </section>
  );
}
