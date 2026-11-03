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
import type { AgentNodeData } from "../../app/lib/workspace-store";
import { useDashboardNavigation } from "../../app/lib/navigation";
import { useWorkspaceGraph } from "../../lib/api/hooks/use-workspace-graph";
import { useActivityFeed } from "../../lib/api/hooks/use-activity-feed";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";

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

function SpendChart() {
  return (
    <div className="flex h-[220px] flex-col items-center justify-center rounded border border-dashed border-border bg-muted/20 p-6 text-center">
      <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Clock className="h-4 w-4" />
      </div>
      <p className="text-xs font-medium text-foreground">Spend velocity analytics unavailable</p>
      <p className="mt-1 max-w-[320px] text-[11px] text-muted-foreground">
        7-day historical spend velocity endpoint is pending backend implementation (Contract Gap GAP-SPEND-01).
      </p>
    </div>
  );
}

function AuthorityBars({ nodes, currency }: { nodes: AgentNodeData[]; currency: string }) {
  if (nodes.length === 0) {
    return (
      <div className="flex h-[180px] flex-col items-center justify-center rounded border border-dashed border-border p-4 text-center">
        <p className="text-xs text-muted-foreground">No agents provisioned in this environment.</p>
      </div>
    );
  }

  const maxBar = Math.max(...nodes.map((n) => n.allocatedMinor), 1);

  return (
    <div className="space-y-3">
      {nodes.map((agent) => (
        <div key={agent.id} className="flex items-center gap-3">
          <span className="w-24 shrink-0 truncate text-xs text-muted-foreground" title={agent.name}>
            {agent.name}
          </span>
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-secondary">
            <div
              className="h-full rounded-full bg-chart-1"
              style={{ width: `${Math.min(100, Math.round((agent.allocatedMinor / maxBar) * 100))}%` }}
            />
          </div>
          <span className="w-20 shrink-0 text-right text-xs tabular-nums text-foreground">
            {formatMinorUnits(agent.allocatedMinor, currency, { showSymbol: false })}
          </span>
        </div>
      ))}
      <p className="pt-1 text-[11px] text-muted-foreground">
        Every child allocation narrows the parent&rsquo;s authority boundary.
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

  const { nodes } = useWorkspaceGraph(currentEnvironment?.id);
  const { activities } = useActivityFeed(currentEnvironment?.id);

  const currency = currentEnvironment?.currency ?? "USD";
  const limit = currentEnvironment?.budgetLimitMinor ?? 0;
  const spent = currentEnvironment?.spentMinor ?? 0;
  const reserved = currentEnvironment?.reservedMinor ?? 0;
  const available = Math.max(0, limit - spent - reserved);
  const pending = currentEnvironment?.pendingApprovalsCount ?? 0;
  const activeAgentCount = nodes.filter((n) => n.status === "active").length || currentEnvironment?.agentCount || 0;

  const spentPct = limit > 0 ? Math.round((spent / limit) * 100) : 0;
  const reservedPct = limit > 0 ? Math.round((reserved / limit) * 100) : 0;
  const availablePct = Math.max(0, 100 - spentPct - reservedPct);

  const recentActions = activities.filter((a) => !a.isSimulation).slice(0, 5);

  return (
    <div className={`theme-mono flex-1 overflow-y-auto bg-background ${className}`}>
      <div className="mx-auto w-full max-w-[1200px] px-4 py-6 sm:px-6 lg:px-8">
        {/* Row 1: Stat Cards */}
        <div className="grid grid-cols-1 border border-border bg-card sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Active agents"
            value={String(activeAgentCount)}
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
              <SpendChart />
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Authority by agent</CardTitle>
              <CardDescription>Allocated budget per agent, in environment currency.</CardDescription>
            </CardHeader>
            <CardContent>
              <AuthorityBars nodes={nodes} currency={currency} />
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
                  {recentActions.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-xs text-muted-foreground">
                        No recent protected actions recorded in this environment.
                      </td>
                    </tr>
                  ) : (
                    recentActions.map((action) => {
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
                    })
                  )}
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
                {activities.length === 0 ? (
                  <p className="py-6 text-center text-xs text-muted-foreground">
                    No recent events recorded in this environment.
                  </p>
                ) : (
                  activities.slice(0, 4).map((item) => (
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
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
