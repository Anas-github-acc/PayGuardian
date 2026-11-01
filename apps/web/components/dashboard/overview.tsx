"use client";

import * as React from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  Clock,
  ExternalLink,
  ShieldCheck,
  ShieldX,
  Wallet,
} from "lucide-react";
import { cn } from "../../lib/utils";
import { formatMinorUnits } from "../../app/lib/currency";
import { useWorkspaceStore, workspaceStore } from "../../app/lib/workspace-store";
import { useDashboardNavigation } from "../../app/lib/navigation";
import { INITIAL_ACTIVITIES } from "../workspace/workspace-defaults";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";

/* ------------------------------------------------------------------ */
/* Static demo series (fixture data, mirrors the sandbox environment)  */
/* ------------------------------------------------------------------ */

const SPEND_SERIES = [
  { label: "Mon", spent: 32000, reserved: 12000 },
  { label: "Tue", spent: 18000, reserved: 9000 },
  { label: "Wed", spent: 46000, reserved: 21000 },
  { label: "Thu", spent: 51000, reserved: 18000 },
  { label: "Fri", spent: 62000, reserved: 24000 },
  { label: "Sat", spent: 21000, reserved: 15000 },
  { label: "Sun", spent: 15000, reserved: 51000 },
];

const AGENT_AUTHORITY = [
  { label: "Personal", value: 1000000 },
  { label: "Travel", value: 400000 },
  { label: "Hotel", value: 400000 },
  { label: "Food", value: 120000 },
  { label: "Activities", value: 80000 },
];

const MAX_BAR = 1000000;

/* ------------------------------------------------------------------ */
/* Small building blocks                                               */
/* ------------------------------------------------------------------ */

function StatCard({
  label,
  value,
  delta,
  deltaTone = "neutral",
  footnote,
}: {
  label: string;
  value: string;
  delta?: string;
  deltaTone?: "positive" | "negative" | "neutral";
  footnote: string;
}) {
  const toneIcon =
    deltaTone === "positive" ? (
      <ArrowUpRight className="h-3 w-3" />
    ) : deltaTone === "negative" ? (
      <ArrowDownRight className="h-3 w-3" />
    ) : null;

  return (
    <Card className="rounded-none border-0 border-b border-border border-r-0 shadow-none last:border-r-0 sm:border-b-0 sm:border-r sm:last:border-r-0">
      <CardHeader className="pb-3">
        <CardDescription>{label}</CardDescription>
        <div className="text-2xl font-semibold tabular-nums text-foreground">{value}</div>
      </CardHeader>
      <CardContent className="flex items-center gap-1.5 border-t border-border pt-3 pb-4 text-xs">
        {delta && (
          <span
            className={cn(
              "inline-flex items-center gap-0.5 font-medium",
              deltaTone === "positive" && "text-success",
              deltaTone === "negative" && "text-destructive",
              deltaTone === "neutral" && "text-muted-foreground"
            )}
          >
            {toneIcon}
            {delta}
          </span>
        )}
        <span className="text-muted-foreground">{footnote}</span>
      </CardContent>
    </Card>
  );
}

function SpendChart({ currency }: { currency: string }) {
  const max = Math.max(...SPEND_SERIES.map((d) => d.spent + d.reserved));

  return (
    <div className="flex h-[220px] items-end gap-2 sm:gap-3">
      {SPEND_SERIES.map((day) => {
        const spentH = Math.round((day.spent / max) * 180);
        const reservedH = Math.round((day.reserved / max) * 180);
        return (
          <div key={day.label} className="group flex min-w-0 flex-1 flex-col items-center gap-2">
            <span className="text-[10px] text-muted-foreground tabular-nums opacity-0 transition-opacity group-hover:opacity-100">
              {formatMinorUnits(day.spent, currency, { showSymbol: false })}
            </span>
            <div className="flex w-full flex-1 flex-col justify-end gap-0.5">
              <div
                className="w-full rounded-t-sm bg-chart-2/80 transition-colors group-hover:bg-chart-2"
                style={{ height: `${reservedH}px` }}
                title={`Reserved: ${formatMinorUnits(day.reserved, currency)}`}
              />
              <div
                className="w-full rounded-b-sm bg-chart-1 transition-opacity group-hover:opacity-90"
                style={{ height: `${spentH}px` }}
                title={`Spent: ${formatMinorUnits(day.spent, currency)}`}
              />
            </div>
            <span className="text-[11px] text-muted-foreground">{day.label}</span>
          </div>
        );
      })}
    </div>
  );
}

function AuthorityBars({ currency }: { currency: string }) {
  return (
    <div className="space-y-3">
      {AGENT_AUTHORITY.map((agent) => (
        <div key={agent.label} className="flex items-center gap-3">
          <span className="w-20 shrink-0 truncate text-xs text-muted-foreground">{agent.label}</span>
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-secondary">
            <div
              className="h-full rounded-full bg-chart-1"
              style={{ width: `${Math.round((agent.value / MAX_BAR) * 100)}%` }}
            />
          </div>
          <span className="w-20 shrink-0 text-right text-xs tabular-nums text-foreground">
            {formatMinorUnits(agent.value, currency, { showSymbol: false })}
          </span>
        </div>
      ))}
      <p className="pt-1 text-[11px] text-muted-foreground">
        Root mandate <span className="font-mono text-foreground">man-root-9081</span> · every child
        allocation narrows the parent&rsquo;s authority.
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Overview                                                            */
/* ------------------------------------------------------------------ */

export interface OverviewProps {
  className?: string;
}

export function Overview({ className = "" }: OverviewProps) {
  const { currentEnvironment } = useWorkspaceStore();
  const { navigateTab } = useDashboardNavigation();

  const currency = currentEnvironment?.currency ?? "USD";
  const limit = currentEnvironment?.budgetLimitMinor ?? 1000000;
  const spent = currentEnvironment?.spentMinor ?? 245000;
  const reserved = currentEnvironment?.reservedMinor ?? 150000;
  const available = Math.max(0, limit - spent - reserved);
  const pending = currentEnvironment?.pendingApprovalsCount ?? 0;

  const spentPct = limit > 0 ? Math.round((spent / limit) * 100) : 0;
  const reservedPct = limit > 0 ? Math.round((reserved / limit) * 100) : 0;
  const availablePct = Math.max(0, 100 - spentPct - reservedPct);

  const recentActions = INITIAL_ACTIVITIES.filter((a) => !a.isSimulation).slice(0, 5);

  return (
    <div className={`theme-mono flex-1 overflow-y-auto bg-background ${className}`}>
      <div className="mx-auto w-full max-w-[1200px] px-4 py-6 sm:px-6 lg:px-8">
        {/* Row 1: Stat Cards */}
        <div className="grid grid-cols-1 border border-border bg-card sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Active agents"
            value={String(currentEnvironment?.agentCount ?? 4)}
            delta="+1"
            deltaTone="positive"
            footnote="vs last week"
          />
          <StatCard
            label="Authority delegated"
            value={formatMinorUnits(limit, currency)}
            delta={`${formatMinorUnits(available, currency, { showSymbol: false })} available`}
            footnote="of total limit"
          />
          <StatCard
            label="Spend this week"
            value={formatMinorUnits(spent, currency)}
            delta="+12.4%"
            deltaTone="positive"
            footnote="vs last week"
          />
          <StatCard
            label="Pending approvals"
            value={String(pending)}
            delta={pending > 0 ? "Action needed" : "All clear"}
            deltaTone={pending > 0 ? "negative" : "positive"}
            footnote="waiting for you"
          />
        </div>

        {/* Row 2: Charts */}
        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-5">
          <Card className="lg:col-span-3">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Spend velocity</CardTitle>
                <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-chart-1" />
                    Spent
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-chart-2/80" />
                    Reserved
                  </span>
                </div>
              </div>
              <CardDescription>Daily spend and reservations, last 7 days.</CardDescription>
            </CardHeader>
            <CardContent>
              <SpendChart currency={currency} />
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Authority by agent</CardTitle>
              <CardDescription>Allocated budget per agent, in environment currency.</CardDescription>
            </CardHeader>
            <CardContent>
              <AuthorityBars currency={currency} />
            </CardContent>
          </Card>
        </div>

        {/* Row 3: Recent actions + health + activity */}
        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Recent protected actions */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Recent protected actions</CardTitle>
              <CardDescription>Gateway-verified payments, delegations and blocks.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-y border-border text-left text-muted-foreground">
                    <th className="px-5 py-2.5 font-medium">Agent</th>
                    <th className="px-5 py-2.5 font-medium">Action</th>
                    <th className="px-5 py-2.5 text-right font-medium">Amount</th>
                    <th className="px-5 py-2.5 font-medium">Status</th>
                    <th className="px-5 py-2.5" />
                  </tr>
                </thead>
                <tbody>
                  {recentActions.map((action) => {
                    const traceId = action.traceId;
                    return (
                    <tr key={action.id} className="border-b border-border/60 last:border-b-0">
                      <td className="whitespace-nowrap px-5 py-3 font-medium text-foreground">
                        {action.actorName}
                      </td>
                      <td className="max-w-[260px] truncate px-5 py-3 text-muted-foreground">
                        {action.action}
                      </td>
                      <td className="whitespace-nowrap px-5 py-3 text-right tabular-nums text-foreground">
                        {action.amountMinor ? formatMinorUnits(action.amountMinor, action.currency ?? currency) : "—"}
                      </td>
                      <td className="px-5 py-3">
                        <Badge
                          variant={action.outcome === "denied" ? "rejected" : action.outcome === "pending" ? "pending" : "success"}
                        >
                          {action.outcome}
                        </Badge>
                      </td>
                      <td className="px-5 py-3 text-right">
                        {traceId && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-xs"
                            onClick={() => {
                              workspaceStore.setSelectedTraceId(traceId);
                              navigateTab("traces");
                            }}
                          >
                            Trace
                            <ExternalLink className="ml-1 h-3 w-3" />
                          </Button>
                        )}
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </CardContent>
          </Card>

          {/* Right column: health + activity */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Authority health</CardTitle>
                <CardDescription>
                  {pending > 0
                    ? `${pending} request${pending > 1 ? "s" : ""} waiting for your approval.`
                    : "Nothing urgent needs your attention."}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex h-2 overflow-hidden rounded-full bg-secondary" role="img" aria-label={`Spent ${spentPct}%, reserved ${reservedPct}%, available ${availablePct}%`}>
                  <div className="bg-chart-3" style={{ width: `${spentPct}%` }} />
                  <div className="bg-chart-2/80" style={{ width: `${reservedPct}%` }} />
                  <div className="bg-success/70" style={{ width: `${availablePct}%` }} />
                </div>
                <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                  <span className="tabular-nums">{spentPct}% spent</span>
                  <span className="tabular-nums">{reservedPct}% reserved</span>
                  <span className="tabular-nums">{availablePct}% available</span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full text-xs"
                  onClick={() => navigateTab("approvals")}
                >
                  Review approvals
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Activity</CardTitle>
                <CardDescription>Latest verified events in this environment.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 p-5 pt-1">
                {INITIAL_ACTIVITIES.slice(0, 4).map((item) => (
                  <div key={item.id} className="flex items-start gap-3">
                    <div
                      className={cn(
                        "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border",
                        item.outcome === "denied"
                          ? "border-destructive/30 bg-destructive/10 text-destructive"
                          : "border-border bg-secondary text-muted-foreground"
                      )}
                    >
                      {item.outcome === "denied" ? (
                        <ShieldX className="h-3.5 w-3.5" />
                      ) : item.amountMinor ? (
                        <Wallet className="h-3.5 w-3.5" />
                      ) : (
                        <ShieldCheck className="h-3.5 w-3.5" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-medium text-foreground">{item.action}</p>
                      <p className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {item.actorName} · {item.timestamp}
                      </p>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
