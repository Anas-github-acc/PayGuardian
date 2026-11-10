"use client";

import * as React from "react";
import {
  AllCommunityModule,
  ModuleRegistry,
  type ColDef,
  type GridApi,
  type GridReadyEvent,
  type ICellRendererParams,
  themeQuartz,
} from "ag-grid-community";
import { AgGridReact } from "ag-grid-react";
import { Search, RefreshCw, ExternalLink, Shield, AlertCircle, History, CheckCircle2, Clock, GitCommit } from "lucide-react";
import type { AgentDto, MandateDto, LedgerAccountDto } from "@payguardian/contracts";
import { formatMinorUnits } from "../../app/lib/currency";
import { cn } from "../../lib/utils";
import { useWorkspaceStore } from "../../app/lib/workspace-store";
import { apiClient } from "../../lib/api/client";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "../ui/sheet";
import { type MandateRow } from "./types";

ModuleRegistry.registerModules([AllCommunityModule]);

export interface MandatesTableProps {
  environmentId?: string;
  onRevokeMandate?: (mandateId: string, agentName: string) => void;
  onSelectMandate?: (mandateId: string) => void;
  onViewTrace?: (traceId: string) => void;
  className?: string;
}

export function MandatesTable({
  environmentId,
  onRevokeMandate,
  onSelectMandate,
  onViewTrace,
  className = "",
}: MandatesTableProps) {
  const store = useWorkspaceStore();
  const activeEnv = store.currentEnvironment;
  const activeEnvId = environmentId ?? activeEnv?.id ?? store.currentEnvironmentId;

  const [mandates, setMandates] = React.useState<MandateRow[]>([]);
  const [searchQuery, setSearchQuery] = React.useState<string>("");
  const [statusFilter, setStatusFilter] = React.useState<string>("active");
  const [selectedSeriesId, setSelectedSeriesId] = React.useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = React.useState<boolean>(false);
  const gridApiRef = React.useRef<GridApi<MandateRow> | null>(null);

  // Fetch dynamic mandates and assigned agents from API for the active environment
  const fetchMandates = React.useCallback(async () => {
    if (!activeEnvId) {
      setMandates([]);
      return;
    }

    setIsRefreshing(true);
    try {
      const [mandatesList, agentsList, accountsList] = await Promise.all([
        apiClient.mandates.list(activeEnvId).catch(() => [] as MandateDto[]),
        apiClient.agents.list(activeEnvId).catch(() => [] as AgentDto[]),
        apiClient.ledger.listAccounts(activeEnvId).catch(() => [] as LedgerAccountDto[]),
      ]);

      const agentById = new Map<string, AgentDto>();
      for (const a of agentsList) {
        agentById.set(a.id, a);
      }

      const mandateById = new Map<string, MandateDto>();
      for (const m of mandatesList) {
        mandateById.set(m.id, m);
      }

      const accountByMandate = new Map<string, LedgerAccountDto>();
      for (const acc of accountsList) {
        accountByMandate.set(acc.mandateId, acc);
      }

      const rows: MandateRow[] = [];

      // 1. Map existing dynamic mandates for this environment
      for (const m of mandatesList) {
        const agent = agentById.get(m.holderAgentId);
        const parentMandate = m.parentMandateId ? mandateById.get(m.parentMandateId) : null;
        const parentAgent = parentMandate ? agentById.get(parentMandate.holderAgentId) : null;
        const account = accountByMandate.get(m.id);

        const budgetLimitMinor = typeof m.budgetLimitMinor === "number" ? m.budgetLimitMinor : 0;
        const allocatedMinor = typeof m.allocatedMinor === "number" ? m.allocatedMinor : 0;
        const spentMinor = account ? account.capturedMinor : typeof m.spentMinor === "number" ? m.spentMinor : 0;
        const reservedMinor = account ? account.reservedMinor : typeof m.reservedMinor === "number" ? m.reservedMinor : 0;
        const availableMinor = Math.max(0, budgetLimitMinor - allocatedMinor - spentMinor - reservedMinor);

        const isRoot = !m.parentMandateId || !agent?.parentAgentId || agent?.kind === "root";
        const agentName =
          agent?.name ||
          (isRoot
            ? activeEnv?.name
              ? `${activeEnv.name} Orchestrator`
              : "Main Orchestrator"
            : "Specialist Subagent");
        const role: "orchestrator" | "subagent" = isRoot ? "orchestrator" : "subagent";
        const parentAgentName = parentAgent?.name || (isRoot ? "Lead Operator (You)" : "Main Orchestrator");

        rows.push({
          id: String(m.id),
          holderAgentId: String(m.holderAgentId),
          agentName,
          role,
          parentMandateId: m.parentMandateId ? String(m.parentMandateId) : null,
          parentAgentName,
          budgetLimitMinor,
          allocatedMinor,
          spentMinor,
          reservedMinor,
          availableMinor,
          currency: String(m.currency || activeEnv?.currency || "USD"),
          state: (m.state as MandateRow["state"]) || "active",
          expiresAt: String(m.expiresAt || activeEnv?.expiresAt || new Date().toISOString()),
          canDelegate: Boolean(m.canDelegate),
          maxDelegationDepth:
            typeof m.maxDelegationDepth === "number" ? m.maxDelegationDepth : isRoot ? 2 : 0,
          permittedActions:
            Array.isArray(m.permittedActions) && m.permittedActions.length > 0
              ? (m.permittedActions as string[])
              : ["*"],
          mandateSeriesId: m.mandateSeriesId ? String(m.mandateSeriesId) : String(m.id),
          version: typeof m.version === "number" ? m.version : 1,
          previousMandateId: m.previousMandateId ? String(m.previousMandateId) : null,
          supersededAt: m.supersededAt ? String(m.supersededAt) : null,
          createdAt: m.createdAt ? String(m.createdAt) : undefined,
        });
      }

      // 2. Ensure every agent & subagent assigned to this environment is dynamically represented
      const rootMandate = mandatesList.find((m) => !m.parentMandateId);
      const rootAgent = agentsList.find((a) => !a.parentAgentId || a.kind === "root");

      for (const agent of agentsList) {
        const alreadyHasMandate = rows.some((r) => r.holderAgentId === agent.id);
        if (!alreadyHasMandate) {
          const isRoot = !agent.parentAgentId || agent.kind === "root";
          rows.push({
            id: `unfunded-${agent.id}`,
            holderAgentId: agent.id,
            agentName: agent.name,
            role: isRoot ? "orchestrator" : "subagent",
            parentMandateId: isRoot ? null : rootMandate?.id ?? null,
            parentAgentName: isRoot ? "Lead Operator (You)" : rootAgent?.name ?? "Main Orchestrator",
            budgetLimitMinor: 0,
            allocatedMinor: 0,
            spentMinor: 0,
            reservedMinor: 0,
            availableMinor: 0,
            currency: String(activeEnv?.currency || "USD"),
            state: agent.status === "revoked" ? "revoked" : "active",
            expiresAt: String(activeEnv?.expiresAt || new Date().toISOString()),
            canDelegate: isRoot,
            maxDelegationDepth: isRoot ? 1 : 0,
            permittedActions: ["*"],
            mandateSeriesId: `unfunded-${agent.id}`,
            version: 1,
            previousMandateId: null,
            supersededAt: null,
            createdAt: new Date().toISOString(),
          });
        }
      }

      setMandates(rows);
    } catch {
      // In case of error, preserve existing or empty state without fake mock overrides
    } finally {
      setIsRefreshing(false);
    }
  }, [activeEnvId, activeEnv]);

  React.useEffect(() => {
    void fetchMandates();
  }, [fetchMandates]);

  // Group all mandates by series to track version lineage
  const versionsBySeries = React.useMemo(() => {
    const map = new Map<string, MandateRow[]>();
    for (const m of mandates) {
      const sId = m.mandateSeriesId || m.id;
      const list = map.get(sId) ?? [];
      list.push(m);
      map.set(sId, list);
    }
    for (const list of map.values()) {
      list.sort((a, b) => (b.version ?? 1) - (a.version ?? 1));
    }
    return map;
  }, [mandates]);

  const selectedSeriesMandates = React.useMemo(() => {
    if (!selectedSeriesId) return [];
    return versionsBySeries.get(selectedSeriesId) ?? [];
  }, [selectedSeriesId, versionsBySeries]);

  const activeSeriesMandate = React.useMemo(() => {
    return selectedSeriesMandates.find((m) => m.state === "active") ?? selectedSeriesMandates[0];
  }, [selectedSeriesMandates]);

  // Column definitions for AG Grid: all text left-aligned, only amounts right-aligned.
  const columnDefs = React.useMemo<ColDef<MandateRow>[]>(() => {
    return [
      {
        field: "agentName",
        headerName: "Agent / Holder",
        flex: 1.3,
        minWidth: 120,
        cellRenderer: (params: ICellRendererParams<MandateRow>) => {
          if (!params.data) return null;
          return (
            <div className="flex h-full items-center gap-2">
              <span className="truncate font-medium text-foreground">{params.data.agentName}</span>
              <span className="shrink-0 text-[11px] text-muted-foreground">{params.data.role}</span>
            </div>
          );
        },
      },
      {
        field: "parentAgentName",
        headerName: "Parent Authority",
        flex: 1.0,
        minWidth: 100,
        cellRenderer: (params: ICellRendererParams<MandateRow>) => {
          if (!params.data) return null;
          return (
            <span className="block truncate text-muted-foreground">
              {params.data.parentAgentName}
            </span>
          );
        },
      },
      {
        field: "state",
        headerName: "Status",
        width: 85,
        minWidth: 75,
        cellRenderer: (params: ICellRendererParams<MandateRow>) => {
          if (!params.data) return null;
          const state = params.data.state;
          const tone =
            state === "active"
              ? "text-success"
              : state === "revoked"
                ? "text-destructive"
                : state === "superseded"
                  ? "text-amber-500/90"
                  : "text-muted-foreground";
          return (
            <span className={cn("inline-flex items-center gap-1.5 text-xs font-medium capitalize", tone)}>
              <span className="h-1.5 w-1.5 rounded-full bg-current" />
              {state}
            </span>
          );
        },
      },
      {
        field: "version",
        headerName: "Version",
        width: 65,
        minWidth: 55,
        cellRenderer: (params: ICellRendererParams<MandateRow>) => {
          if (!params.data) return null;
          const item = params.data;
          const seriesId = item.mandateSeriesId || item.id;
          const versionNum = item.version ?? 1;

          return (
            <div className="flex h-full items-center">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedSeriesId(seriesId);
                }}
                className={cn(
                  "font-mono text-xs cursor-pointer transition-colors",
                  item.state === "superseded"
                    ? "text-muted-foreground/50 line-through"
                    : "text-muted-foreground hover:text-foreground"
                )}
                title={`Version ${versionNum}. Click to view history.`}
              >
                v{versionNum}
              </button>
            </div>
          );
        },
      },
      {
        field: "budgetLimitMinor",
        headerName: "Limit",
        flex: 0.9,
        minWidth: 80,
        headerClass: "numeric-header",
        cellClass: "numeric-cell",
        valueFormatter: (params) =>
          formatMinorUnits(params.value ?? 0, params.data?.currency ?? "USD"),
      },
      {
        field: "spentMinor",
        headerName: "Spent",
        width: 75,
        minWidth: 65,
        headerClass: "numeric-header",
        cellClass: "numeric-cell",
        cellRenderer: (params: ICellRendererParams<MandateRow>) => {
          if (!params.data) return null;
          return (
            <span className="text-muted-foreground">
              {formatMinorUnits(params.data.spentMinor, params.data.currency)}
            </span>
          );
        },
      },
      {
        field: "reservedMinor",
        headerName: "Reserved",
        width: 75,
        minWidth: 65,
        headerClass: "numeric-header",
        cellClass: "numeric-cell",
        valueFormatter: (params) =>
          formatMinorUnits(params.value ?? 0, params.data?.currency ?? "USD"),
      },
      {
        field: "availableMinor",
        headerName: "Available",
        flex: 0.9,
        minWidth: 80,
        headerClass: "numeric-header",
        cellClass: "numeric-cell",
        valueFormatter: (params) =>
          formatMinorUnits(params.value ?? 0, params.data?.currency ?? "USD"),
      },
      {
        field: "expiresAt",
        headerName: "Expires",
        width: 85,
        minWidth: 80,
        cellRenderer: (params: ICellRendererParams<MandateRow>) => {
          if (!params.data) return null;
          return (
            <div className="flex h-full items-center">
              <span className="truncate text-xs tabular-nums text-muted-foreground">
                {new Date(params.data.expiresAt).toLocaleDateString()}
              </span>
            </div>
          );
        },
      },
      {
        headerName: "Actions",
        width: 85,
        minWidth: 75,
        sortable: false,
        filter: false,
        cellRenderer: (params: ICellRendererParams<MandateRow>) => {
          if (!params.data) return null;
          const item = params.data;
          const isActive = item.state === "active";

          return (
            <div className="flex h-full items-center gap-1">
              {isActive && onRevokeMandate && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRevokeMandate(item.id, item.agentName);
                  }}
                  className="h-6 px-1.5 text-[11px] text-destructive hover:bg-destructive/10 hover:text-destructive cursor-pointer"
                  title="Revoke mandate"
                >
                  Revoke
                </Button>
              )}
              {onViewTrace && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={(e) => {
                    e.stopPropagation();
                    onViewTrace(item.id);
                  }}
                  className="h-6 w-6 text-muted-foreground hover:text-foreground cursor-pointer"
                  title="Open Payment Link / View Trace"
                  aria-label="View Trace"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          );
        },
      },
    ];
  }, [onRevokeMandate, onViewTrace, versionsBySeries]);

  // Filtered rows
  const filteredRows = React.useMemo(() => {
    return mandates.filter((m) => {
      if (statusFilter !== "all" && m.state !== statusFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = m.agentName.toLowerCase().includes(q);
        const matchesParent = m.parentAgentName.toLowerCase().includes(q);
        const matchesId = m.id.toLowerCase().includes(q);
        const matchesSeries = m.mandateSeriesId?.toLowerCase().includes(q);
        return matchesName || matchesParent || matchesId || Boolean(matchesSeries);
      }
      return true;
    });
  }, [mandates, statusFilter, searchQuery]);

  function onGridReady(params: GridReadyEvent<MandateRow>) {
    gridApiRef.current = params.api;
    params.api.sizeColumnsToFit();
  }

  React.useEffect(() => {
    function handleResize() {
      gridApiRef.current?.sizeColumnsToFit();
    }
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  React.useEffect(() => {
    if (gridApiRef.current) {
      gridApiRef.current.sizeColumnsToFit();
    }
  }, [filteredRows.length]);

  return (
    <div className={`mx-auto w-full max-w-[1200px] space-y-4 ${className}`}>
      {/* Page header: title + description + actions */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Mandates</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Delegated spending authority held by each agent, with versioned lineage, live limits, and audit tracking.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative w-full sm:w-56">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search mandates..."
              className="h-8 pl-8 text-xs bg-card border-border"
            />
          </div>

          <Button
            variant="outline"
            size="icon"
            onClick={() => void fetchMandates()}
            disabled={isRefreshing}
            aria-label="Refresh mandates"
            className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {/* Toolbar: status filter + count */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex items-center gap-0.5 rounded-md border border-border bg-card p-0.5 select-none">
          {["active", "all", "superseded", "revoked"].map((status) => (
            <Button
              key={status}
              variant={statusFilter === status ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setStatusFilter(status)}
              className="h-6 px-2 text-[11px] capitalize"
            >
              {status}
            </Button>
          ))}
        </div>

        <span className="text-xs text-muted-foreground">
          {filteredRows.length} {filteredRows.length === 1 ? "mandate" : "mandates"}
        </span>
      </div>

      {/* AG Grid Container (auto-height: grid fits rows + pagination) */}
      {mandates.length === 0 && !isRefreshing ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card/40 py-12 text-center">
          <Shield className="h-9 w-9 text-muted-foreground/60 mb-2" />
          <p className="text-sm font-medium text-foreground">No mandates configured</p>
          <p className="text-xs text-muted-foreground max-w-sm mt-1">
            This environment has no spending mandates issued yet. Attach an agent or initialize a root mandate in the Workspace to establish authority.
          </p>
        </div>
      ) : (
        <div className="ag-theme-quartz-dark w-full rounded-lg overflow-x-auto border border-border">
          <AgGridReact<MandateRow>
            rowData={filteredRows}
            columnDefs={columnDefs}
            onGridReady={onGridReady}
            onFirstDataRendered={(params) => params.api.sizeColumnsToFit()}
            onGridSizeChanged={(params) => params.api.sizeColumnsToFit()}
            domLayout="autoHeight"
            autoSizeStrategy={{ type: "fitGridWidth" }}
            onRowClicked={(event) => {
              if (event.data && onSelectMandate) {
                onSelectMandate(event.data.id);
              }
            }}
            pagination={true}
            paginationPageSize={10}
            paginationPageSizeSelector={[10, 25, 50]}
            animateRows={false}
            theme={themeQuartz}
          />
        </div>
      )}

      {/* Mandate Version Lineage & History Drawer */}
      <Sheet open={!!selectedSeriesId} onOpenChange={(open) => !open && setSelectedSeriesId(null)}>
        <SheetContent side="right" className="w-full sm:max-w-lg bg-card border-border overflow-y-auto p-6 text-foreground">
          {selectedSeriesMandates.length > 0 && (
            <div className="space-y-6">
              <SheetHeader className="text-left space-y-1">
                <div className="flex items-center gap-2">
                  <span className="p-1 rounded bg-primary/10 text-primary">
                    <History className="h-4 w-4" />
                  </span>
                  <SheetTitle className="text-base font-semibold text-foreground">
                    Mandate Lineage: {activeSeriesMandate?.agentName}
                  </SheetTitle>
                </div>
                <SheetDescription className="text-xs text-muted-foreground">
                  Audit trail of spending authority versions and top-up allocations for this mandate series:
                  <span className="font-mono ml-1 text-foreground/80">{selectedSeriesId?.slice(0, 8)}...</span>
                </SheetDescription>
              </SheetHeader>

              {/* Series Overview Card */}
              <div className="rounded-lg border border-border bg-secondary/30 p-3.5 space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Role / Authority</span>
                  <div className="flex items-center gap-1.5">
                    <span className="font-medium text-foreground capitalize">{activeSeriesMandate?.role}</span>
                    <span className="text-muted-foreground">via</span>
                    <span className="font-medium text-foreground">{activeSeriesMandate?.parentAgentName}</span>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 border-t border-border/60 pt-3">
                  <div>
                    <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Active Limit</div>
                    <div className="font-mono text-xs font-semibold text-foreground">
                      {formatMinorUnits(activeSeriesMandate?.budgetLimitMinor ?? 0, activeSeriesMandate?.currency ?? "USD")}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Spent</div>
                    <div className="font-mono text-xs font-semibold text-muted-foreground">
                      {formatMinorUnits(activeSeriesMandate?.spentMinor ?? 0, activeSeriesMandate?.currency ?? "USD")}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Available</div>
                    <div className="font-mono text-xs font-semibold text-success">
                      {formatMinorUnits(activeSeriesMandate?.availableMinor ?? 0, activeSeriesMandate?.currency ?? "USD")}
                    </div>
                  </div>
                </div>
              </div>

              {/* Timeline of versions */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Version Lineage ({selectedSeriesMandates.length} {selectedSeriesMandates.length === 1 ? "Version" : "Versions"})
                  </h4>
                </div>

                <div className="relative border-l border-border/80 ml-3.5 pl-5 space-y-5">
                  {selectedSeriesMandates.map((item, idx) => {
                    const isCurrent = item.state === "active";
                    const prevItem = selectedSeriesMandates[idx + 1];
                    const incrementalDelta = prevItem ? item.budgetLimitMinor - prevItem.budgetLimitMinor : 0;

                    return (
                      <div key={item.id} className="relative group">
                        {/* Timeline dot */}
                        <div
                          className={cn(
                            "absolute -left-[27px] top-1.5 h-3.5 w-3.5 rounded-full border-2 border-background",
                            isCurrent ? "bg-success ring-2 ring-success/20" : "bg-muted-foreground/60"
                          )}
                        />

                        {/* Version Item Card */}
                        <div
                          className={cn(
                            "rounded-lg border p-3 text-xs space-y-2.5 transition-colors",
                            isCurrent
                              ? "border-primary/40 bg-primary/5 shadow-sm"
                              : "border-border/70 bg-card/60 opacity-80 hover:opacity-100"
                          )}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-bold text-foreground">v{item.version ?? 1}</span>
                              <span
                                className={cn(
                                  "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
                                  isCurrent
                                    ? "bg-success/15 text-success"
                                    : item.state === "revoked"
                                      ? "bg-destructive/15 text-destructive"
                                      : "bg-muted text-muted-foreground"
                                )}
                              >
                                {item.state}
                              </span>
                            </div>

                            <span className="text-[11px] text-muted-foreground font-mono">
                              {item.createdAt ? new Date(item.createdAt).toLocaleDateString() : ""}
                            </span>
                          </div>

                          <div className="flex items-baseline justify-between border-t border-border/40 pt-2">
                            <div>
                              <span className="text-muted-foreground text-[11px]">Cumulative Limit: </span>
                              <span className="font-mono font-semibold text-foreground">
                                {formatMinorUnits(item.budgetLimitMinor, item.currency)}
                              </span>
                            </div>
                            {incrementalDelta > 0 && (
                              <span className="text-[11px] font-mono font-semibold text-primary">
                                +{formatMinorUnits(incrementalDelta, item.currency)} Top-up
                              </span>
                            )}
                          </div>

                          {item.previousMandateId && (
                            <div className="text-[10px] text-muted-foreground font-mono">
                              <span>Predecessor: </span>
                              <span className="truncate">{item.previousMandateId.slice(0, 8)}...</span>
                            </div>
                          )}

                          {item.supersededAt && (
                            <div className="text-[10px] text-amber-500/80">
                              Superseded on {new Date(item.supersededAt).toLocaleString()}
                            </div>
                          )}

                          {item.permittedActions && item.permittedActions.length > 0 && (
                            <div className="flex flex-wrap gap-1 pt-1">
                              {item.permittedActions.slice(0, 4).map((action) => (
                                <span
                                  key={action}
                                  className="rounded border border-border bg-secondary/80 px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground"
                                >
                                  {action}
                                </span>
                              ))}
                              {item.permittedActions.length > 4 && (
                                <span className="text-[10px] text-muted-foreground self-center">
                                  +{item.permittedActions.length - 4} more
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
