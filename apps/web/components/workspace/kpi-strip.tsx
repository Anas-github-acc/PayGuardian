"use client";

import * as React from "react";
import { formatMinorUnits, calculateAvailableMinor } from "../../app/lib/currency";
import { useWorkspaceStore } from "../../app/lib/workspace-store";

export interface KpiStripProps {
  className?: string;
  totalLimitMinor?: number;
  spentMinor?: number;
  reservedMinor?: number;
  currency?: string;
  rootAgentCount?: number;
}

export function KpiStrip({
  className = "",
  totalLimitMinor: propLimit,
  spentMinor: propSpent,
  reservedMinor: propReserved,
  currency: propCurrency,
  rootAgentCount = 1,
}: KpiStripProps) {
  const store = useWorkspaceStore();
  const env = store.currentEnvironment;

  const currency = propCurrency ?? env?.currency ?? "USD";
  const limitMinor = propLimit ?? env?.budgetLimitMinor ?? 0;
  const spentMinor = propSpent ?? env?.spentMinor ?? 0;
  const reservedMinor = propReserved ?? env?.reservedMinor ?? 0;

  const availableMinor = calculateAvailableMinor(limitMinor, spentMinor, reservedMinor);

  const spentPercent =
    limitMinor > 0 ? Math.min(100, Math.round((spentMinor / limitMinor) * 1000) / 10) : 0;
  const reservedPercent =
    limitMinor > 0
      ? Math.min(100 - spentPercent, Math.round((reservedMinor / limitMinor) * 1000) / 10)
      : 0;
  const availablePercent = Math.max(
    0,
    Math.round((100 - spentPercent - reservedPercent) * 10) / 10,
  );

  return (
    <section
      aria-label="Authority and Budget Metrics"
      className={`grid grid-cols-2 gap-px rounded-xl border border-zinc-800 bg-zinc-900/60 p-px shadow-sm sm:grid-cols-4 ${className}`}
    >
      {/* 1. Total authority */}
      <div className="flex flex-col justify-between rounded-l-lg bg-zinc-950 p-4 sm:p-5">
        <span className="text-xs font-normal text-zinc-400">Total authority</span>
        <div className="mt-2">
          <div className="text-2xl font-bold tracking-tight text-white tabular-nums">
            {formatMinorUnits(limitMinor, currency)}
          </div>
          <p className="mt-1 text-xs text-zinc-400">
            {rootAgentCount} root agent{rootAgentCount === 1 ? "" : "s"}
          </p>
        </div>
      </div>

      {/* 2. Spent */}
      <div className="flex flex-col justify-between bg-zinc-950 p-4 sm:p-5">
        <span className="text-xs font-normal text-zinc-400">Spent</span>
        <div className="mt-2">
          <div className="text-2xl font-bold tracking-tight text-zinc-100 tabular-nums">
            {formatMinorUnits(spentMinor, currency)}
          </div>
          <p className="mt-1 text-xs text-zinc-400">{spentPercent}% utilized</p>
        </div>
      </div>

      {/* 3. Reserved (Orange semantic highlight) */}
      <div className="flex flex-col justify-between bg-zinc-950 p-4 sm:p-5">
        <span className="text-xs font-normal text-zinc-400">Reserved</span>
        <div className="mt-2">
          <div className="text-2xl font-bold tracking-tight text-orange-400 tabular-nums">
            {formatMinorUnits(reservedMinor, currency)}
          </div>
          <p className="mt-1 text-xs text-zinc-400">{reservedPercent}% on hold</p>
        </div>
      </div>

      {/* 4. Available */}
      <div className="flex flex-col justify-between rounded-r-lg bg-zinc-950 p-4 sm:p-5">
        <span className="text-xs font-normal text-zinc-400">Available</span>
        <div className="mt-2">
          <div className="text-2xl font-bold tracking-tight text-white tabular-nums">
            {formatMinorUnits(availableMinor, currency)}
          </div>
          <p className="mt-1 text-xs text-zinc-400">{availablePercent}% remaining</p>
        </div>
      </div>
    </section>
  );
}
