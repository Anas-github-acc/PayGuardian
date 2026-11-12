"use client";

import * as React from "react";
import { Shield, RefreshCw, Bot } from "lucide-react";
import { Card, CardContent } from "../ui/card";
import { formatMinorUnits } from "../../app/lib/currency";
import { apiClient } from "../../lib/api/client";
import {
  getCachedMandates,
  saveCachedMandates,
  type CachedMandateRow,
} from "../../lib/mandate-cache";
import { cn } from "../../lib/utils";

export interface MandateCardTableProps {
  environmentId?: string | null;
  environmentName?: string;
  currency?: string;
  className?: string;
}

export function MandateCardTable({
  environmentId,
  environmentName = "Sandbox",
  currency = "INR",
  className,
}: MandateCardTableProps) {
  const [mandates, setMandates] = React.useState<CachedMandateRow[]>([]);
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const [isFromCache, setIsFromCache] = React.useState(false);

  // Load from cache on mount
  React.useEffect(() => {
    if (!environmentId) return;
    const cached = getCachedMandates(environmentId);
    if (cached.length > 0) {
      setMandates(cached);
      setIsFromCache(true);
    }
  }, [environmentId]);

  // Fetch fresh values from API and update cache
  const fetchMandates = React.useCallback(async () => {
    if (!environmentId) return;
    setIsRefreshing(true);

    try {
      const [mandatesList, agentsList, accountsList] = await Promise.all([
        apiClient.mandates.list(environmentId).catch(() => []),
        apiClient.agents.list(environmentId).catch(() => []),
        apiClient.ledger.listAccounts(environmentId).catch(() => []),
      ]);

      const agentById = new Map(agentsList.map((a) => [a.id, a]));
      const accountByMandate = new Map(accountsList.map((acc) => [acc.mandateId, acc]));

      const rows: CachedMandateRow[] = [];

      // Filter out superseded versions and deduplicate by series
      const activeMandates = mandatesList.filter(
        (m) => m.state !== "superseded" && !m.supersededAt,
      );

      const latestSeriesMandates = new Map<string, (typeof mandatesList)[0]>();
      for (const m of activeMandates) {
        const sKey = m.mandateSeriesId || `${m.parentMandateId ?? "root"}_${m.holderAgentId}`;
        const existing = latestSeriesMandates.get(sKey);
        if (!existing || (m.version ?? 1) > (existing.version ?? 1)) {
          latestSeriesMandates.set(sKey, m);
        }
      }

      for (const m of latestSeriesMandates.values()) {
        const agent = agentById.get(m.holderAgentId);
        const account = accountByMandate.get(m.id);

        const budgetLimitMinor = typeof m.budgetLimitMinor === "number" ? m.budgetLimitMinor : 0;
        const allocatedMinor = typeof m.allocatedMinor === "number" ? m.allocatedMinor : 0;
        const spentMinor = account
          ? account.capturedMinor
          : typeof m.spentMinor === "number"
            ? m.spentMinor
            : 0;
        const reservedMinor = account
          ? account.reservedMinor
          : typeof m.reservedMinor === "number"
            ? m.reservedMinor
            : 0;
        const availableMinor = Math.max(
          0,
          budgetLimitMinor - allocatedMinor - spentMinor - reservedMinor,
        );

        const isRoot = !m.parentMandateId || !agent?.parentAgentId || agent?.kind === "root";
        const agentName =
          agent?.name ||
          (isRoot
            ? environmentName
              ? `${environmentName} Orchestrator`
              : "Main Orchestrator"
            : "Specialist Subagent");

        rows.push({
          id: String(m.id),
          holderAgentId: String(m.holderAgentId),
          agentName,
          role: isRoot ? "orchestrator" : "subagent",
          budgetLimitMinor,
          spentMinor,
          reservedMinor,
          availableMinor,
          currency: String(m.currency || currency),
          updatedAt: new Date().toISOString(),
        });
      }

      for (const agent of agentsList) {
        const alreadyHas = rows.some((r) => r.holderAgentId === agent.id);
        if (!alreadyHas) {
          const isRoot = !agent.parentAgentId || agent.kind === "root";
          rows.push({
            id: `unfunded-${agent.id}`,
            holderAgentId: agent.id,
            agentName: agent.name,
            role: isRoot ? "orchestrator" : "subagent",
            budgetLimitMinor: 0,
            spentMinor: 0,
            reservedMinor: 0,
            availableMinor: 0,
            currency,
            updatedAt: new Date().toISOString(),
          });
        }
      }

      setMandates(rows);
      setIsFromCache(false);
      saveCachedMandates(environmentId, rows);
    } catch (err) {
      console.warn("Could not fetch fresh mandates, using cache:", err);
    } finally {
      setIsRefreshing(false);
    }
  }, [environmentId, environmentName, currency]);

  React.useEffect(() => {
    if (environmentId) {
      void fetchMandates();
    }
  }, [environmentId, fetchMandates]);

  return (
    <Card
      className={cn(
        "w-full p-0 border border-border bg-card text-card-foreground shadow-sm rounded-lg overflow-hidden",
        className,
      )}
    >
      <CardContent className="p-0">
        {/* Header - follows Card pattern: border-b px-4 py-3 */}
        <div className="border-b border-border px-4 py-3 flex items-center justify-between shrink-0 bg-card">
          <div className="flex items-center gap-2 text-muted-foreground [&_svg]:size-4">
            <Shield aria-hidden="true" className="size-4 shrink-0" />
            <span className="font-medium text-foreground text-sm">Active Spending Mandates</span>
            <span className="text-xs text-muted-foreground font-mono">/</span>
            <span className="text-xs text-muted-foreground font-mono">
              {environmentName} ({currency})
            </span>
          </div>

          <button
            type="button"
            onClick={fetchMandates}
            disabled={isRefreshing}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md border border-border bg-background hover:bg-muted text-foreground transition-colors cursor-pointer disabled:opacity-50 shadow-sm"
          >
            <RefreshCw
              aria-hidden="true"
              className={cn(
                "size-3 shrink-0 text-muted-foreground",
                isRefreshing && "animate-spin",
              )}
            />
            <span>Sync</span>
          </button>
        </div>

        {/* Content Body - follows same rule: space-y-3 p-4 */}
        <div className="space-y-3 p-4">
          <p className="text-muted-foreground text-sm leading-relaxed">
            Cryptographic spending envelopes for this environment. Only authorized agents can
            reserve and execute payments within their designated ceilings.
          </p>

          {/* Current Available Budget (Root Agent) */}
          {(() => {
            const rootMandate = mandates.find((m) => m.role === "orchestrator") ?? mandates[0];
            const rootAvailableMinor = rootMandate ? rootMandate.availableMinor : 0;
            const rootLimitMinor = rootMandate ? rootMandate.budgetLimitMinor : 0;
            const rootSpentMinor = rootMandate ? rootMandate.spentMinor : 0;
            const rootReservedMinor = rootMandate ? rootMandate.reservedMinor : 0;

            return (
              <div className="rounded-lg border border-border bg-card p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
                <div>
                  <div className="text-xs text-muted-foreground font-medium">
                    Current Available Budget
                  </div>
                  <div className="text-lg font-bold font-mono text-foreground mt-0.5">
                    {formatMinorUnits(rootAvailableMinor, currency)}
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">
                    Root Orchestrator ({rootMandate?.agentName ?? "Main Orchestrator"})
                  </div>
                </div>
                <div className="flex items-center gap-3 text-xs font-mono border-t sm:border-t-0 sm:border-l border-border pt-2 sm:pt-0 sm:pl-3">
                  <div>
                    <span className="text-muted-foreground text-[10px] block">Limit</span>
                    <span className="text-foreground font-medium">
                      {formatMinorUnits(rootLimitMinor, currency)}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-[10px] block">Spent</span>
                    <span className="text-muted-foreground">
                      {formatMinorUnits(rootSpentMinor, currency)}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-[10px] block">Reserved</span>
                    <span className="text-muted-foreground">
                      {formatMinorUnits(rootReservedMinor, currency)}
                    </span>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Complete Table with only Agent, Limit, Spent, Reserved, Available */}
          <div className="border border-border rounded-lg overflow-hidden bg-card">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-border text-xs text-muted-foreground">
                  <th className="py-2.5 px-4 font-normal">Agent</th>
                  <th className="py-2.5 px-4 font-normal text-right">Limit</th>
                  <th className="py-2.5 px-4 font-normal text-right">Spent</th>
                  <th className="py-2.5 px-4 font-normal text-right">Reserved</th>
                  <th className="py-2.5 px-4 font-normal text-right">Available</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border text-xs">
                {mandates.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-muted-foreground">
                      No spending mandates registered for this environment.
                    </td>
                  </tr>
                ) : (
                  mandates.map((row) => (
                    <tr key={row.id} className="hover:bg-muted/30 transition-colors">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <Bot className="size-3.5 text-muted-foreground shrink-0" />
                          <div className="flex flex-col">
                            <span className="font-medium text-foreground text-sm">
                              {row.agentName}
                            </span>
                            <span className="text-[11px] text-muted-foreground capitalize">
                              {row.role}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-sm text-foreground">
                        {formatMinorUnits(row.budgetLimitMinor, row.currency)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-sm text-muted-foreground">
                        {formatMinorUnits(row.spentMinor, row.currency)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-sm text-muted-foreground">
                        {formatMinorUnits(row.reservedMinor, row.currency)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-sm font-medium text-foreground">
                        {formatMinorUnits(row.availableMinor, row.currency)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Footer - follows Pattern link style */}
          <div className="flex items-center justify-between pt-1">
            <span className="text-xs text-muted-foreground font-mono">
              {isFromCache ? "Cached · " : ""}
              {mandates.length} agent mandate{mandates.length === 1 ? "" : "s"} tracked
            </span>
            <button
              type="button"
              onClick={fetchMandates}
              disabled={isRefreshing}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border border-border bg-background hover:bg-muted text-foreground transition-colors cursor-pointer disabled:opacity-50 shadow-sm"
            >
              <RefreshCw
                aria-hidden="true"
                className={cn(
                  "size-3 shrink-0 text-muted-foreground",
                  isRefreshing && "animate-spin",
                )}
              />
              <span>Sync latest ledger</span>
            </button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
