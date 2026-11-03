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
import { Search, RefreshCw, ExternalLink, Copy, AlertTriangle } from "lucide-react";
import { formatMinorUnits } from "../../app/lib/currency";
import { useWorkspaceStore, workspaceStore } from "../../app/lib/workspace-store";
import { useActivityFeed } from "../../lib/api/hooks/use-activity-feed";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { cn } from "../../lib/utils";
import type { ActivityAuditRow } from "./types";

ModuleRegistry.registerModules([AllCommunityModule]);

export interface ActivityAuditTableProps {
  environmentId?: string;
  onViewTrace?: (traceId: string) => void;
  className?: string;
}

export function ActivityAuditTable({
  environmentId,
  onViewTrace,
  className = "",
}: ActivityAuditTableProps) {
  const store = useWorkspaceStore();
  const activeEnvId = environmentId ?? store.currentEnvironmentId ?? "env-sandbox-travel-01";

  const [filterType, setFilterType] = React.useState<"all" | "denied" | "payments" | "approvals">("all");
  const [searchQuery, setSearchQuery] = React.useState<string>("");
  const [isLivePolling, setIsLivePolling] = React.useState<boolean>(true);

  const {
    rawEvents,
    isLoading,
    error,
    refetch,
  } = useActivityFeed(activeEnvId, {
    pollingIntervalMs: isLivePolling ? 3000 : 0,
    limit: 100,
  });

  const gridApiRef = React.useRef<GridApi<ActivityAuditRow> | null>(null);

  // Map raw backend AuditEventDto[] into ActivityAuditRow[] without mock fixtures
  const events: ActivityAuditRow[] = React.useMemo(() => {
    return rawEvents.map((raw) => {
      const payload = (raw.payload ?? {}) as Record<string, unknown>;
      const rawAmount = typeof payload.amountMinor === "number" ? payload.amountMinor : payload.amount_minor;
      const amountMinor = typeof rawAmount === "number" ? rawAmount : undefined;
      const currency = typeof payload.currency === "string" ? payload.currency : "USD";

      let actorName = raw.actorType === "user" ? "You (Operator)" : "Autonomous Agent";
      if (raw.actorId) {
        actorName = `Agent (${raw.actorId.slice(0, 8)})`;
      }

      return {
        id: String(raw.id),
        actionId: String(raw.actionId || raw.id || "act-unknown"),
        environmentId: String(raw.environmentId || activeEnvId),
        eventType: String(raw.eventType || "system.event"),
        actorType: (raw.actorType as ActivityAuditRow["actorType"]) || "agent",
        actorId: String(raw.actorId || "agent-unknown"),
        actorName,
        amountMinor,
        currency,
        outcome: (raw.outcome as ActivityAuditRow["outcome"]) || "success",
        reasonCode: (raw.reasonCode as string) || null,
        eventHash: String(raw.eventHash || "0x0000000000000000"),
        previousHash: (raw.previousHash as string) || null,
        createdAt: String(raw.createdAt || new Date().toISOString()),
        isSimulation: Boolean(payload.isSimulation),
        payload,
      };
    });
  }, [rawEvents, activeEnvId]);

  const handleCopyHash = (hash: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      void navigator.clipboard.writeText(hash);
    }
  };

  const handleViewTrace = (actionId: string) => {
    workspaceStore.setSelectedTraceId(actionId);
    if (onViewTrace) {
      onViewTrace(actionId);
    } else {
      workspaceStore.setActiveNavTab("traces");
    }
  };

  // AG Grid Column Definitions: all text left-aligned, only amounts right-aligned.
  const columnDefs = React.useMemo<ColDef<ActivityAuditRow>[]>(() => {
    return [
      {
        field: "createdAt",
        headerName: "Timestamp",
        width: 110,
        minWidth: 110,
        cellRenderer: (params: ICellRendererParams<ActivityAuditRow>) => {
          if (!params.data) return null;
          return (
            <div className="flex h-full items-center">
              <span className="truncate text-xs tabular-nums text-muted-foreground">
                {new Date(params.data.createdAt).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                })}
              </span>
            </div>
          );
        },
      },
      {
        field: "actorName",
        headerName: "Actor",
        flex: 1.3,
        minWidth: 140,
        cellRenderer: (params: ICellRendererParams<ActivityAuditRow>) => {
          if (!params.data) return null;
          return (
            <div className="flex h-full items-center gap-1.5">
              <span className="truncate font-medium text-foreground">{params.data.actorName}</span>
              {params.data.isSimulation && (
                <span className="shrink-0 rounded border border-border px-1 py-px text-[10px] text-muted-foreground">
                  SIM
                </span>
              )}
            </div>
          );
        },
      },
      {
        field: "eventType",
        headerName: "Event Type",
        flex: 1.4,
        minWidth: 170,
        cellRenderer: (params: ICellRendererParams<ActivityAuditRow>) => {
          if (!params.data) return null;
          return (
            <div className="flex h-full items-center">
              <span className="min-w-0 truncate text-xs text-foreground">
                {params.data.eventType}
              </span>
            </div>
          );
        },
      },
      {
        field: "amountMinor",
        headerName: "Amount",
        flex: 1,
        minWidth: 100,
        headerClass: "numeric-header",
        cellClass: "numeric-cell",
        valueFormatter: (params) =>
          params.value === undefined || params.value === null
            ? "—"
            : formatMinorUnits(params.value, params.data?.currency || "USD"),
      },
      {
        field: "outcome",
        headerName: "Outcome",
        width: 110,
        minWidth: 110,
        cellRenderer: (params: ICellRendererParams<ActivityAuditRow>) => {
          if (!params.data) return null;
          const outcome = params.data.outcome;
          const tone =
            outcome === "success"
              ? "text-success"
              : outcome === "denied" || outcome === "failure"
                ? "text-destructive"
                : "text-muted-foreground";
          return (
            <span className={cn("inline-flex items-center gap-1.5 text-xs font-medium capitalize", tone)}>
              <span className="h-1.5 w-1.5 rounded-full bg-current" />
              {outcome}
            </span>
          );
        },
      },
      {
        field: "reasonCode",
        headerName: "Reason",
        flex: 1.1,
        minWidth: 130,
        cellRenderer: (params: ICellRendererParams<ActivityAuditRow>) => {
          if (!params.data || !params.data.reasonCode) return "—";
          return (
            <span className="block truncate text-[11px] text-muted-foreground">
              {params.data.reasonCode}
            </span>
          );
        },
      },
      {
        field: "eventHash",
        headerName: "Record SHA-256",
        flex: 1.2,
        minWidth: 160,
        cellRenderer: (params: ICellRendererParams<ActivityAuditRow>) => {
          if (!params.data || !params.data.eventHash) return null;
          const hash = params.data.eventHash;
          const short = `${hash.slice(0, 8)}...${hash.slice(-6)}`;
          return (
            <div className="flex h-full items-center gap-1.5">
              <span className="truncate text-[11px] text-muted-foreground">{short}</span>
              <Button
                variant="ghost"
                size="icon"
                onClick={(e) => handleCopyHash(hash, e)}
                className="h-5 w-5 shrink-0 text-muted-foreground hover:text-foreground"
                aria-label="Copy SHA-256 hash"
              >
                <Copy className="h-3 w-3" />
              </Button>
            </div>
          );
        },
      },
      {
        headerName: "Trace",
        width: 70,
        minWidth: 70,
        sortable: false,
        filter: false,
        cellRenderer: (params: ICellRendererParams<ActivityAuditRow>) => {
          if (!params.data) return null;
          const id = params.data.actionId || params.data.id;
          return (
            <Button
              variant="ghost"
              size="icon"
              onClick={(e) => {
                e.stopPropagation();
                handleViewTrace(id);
              }}
              className="h-6 w-6 text-muted-foreground hover:text-foreground"
              aria-label="Inspect Payment Trace"
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </Button>
          );
        },
      },
    ];
  }, [onViewTrace]);

  // Filtered rows
  const filteredRows = React.useMemo(() => {
    return events.filter((evt) => {
      // Type filter
      if (filterType === "denied" && evt.outcome !== "denied") return false;
      if (filterType === "payments" && !evt.eventType.includes("payment")) return false;
      if (filterType === "approvals" && !evt.eventType.includes("approval")) return false;

      // Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesActor = evt.actorName.toLowerCase().includes(q);
        const matchesType = evt.eventType.toLowerCase().includes(q);
        const matchesHash = evt.eventHash.toLowerCase().includes(q);
        const matchesAction = evt.actionId.toLowerCase().includes(q);
        return matchesActor || matchesType || matchesHash || matchesAction;
      }
      return true;
    });
  }, [events, filterType, searchQuery]);

  function onGridReady(params: GridReadyEvent<ActivityAuditRow>) {
    gridApiRef.current = params.api;
  }

  return (
    <div className={`mx-auto w-full max-w-[1200px] space-y-4 ${className}`}>
      {/* Page header: title + description + actions */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Activity</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Append-only audit trail of agent actions, approvals, and cryptographic payment records.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative w-full sm:w-56">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search audit events..."
              className="h-8 pl-8 text-xs bg-card border-border"
            />
          </div>

          <Button
            variant="outline"
            size="icon"
            onClick={() => void refetch()}
            disabled={isLoading}
            aria-label="Refresh activity events"
            className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {/* Toolbar: type filter + live polling toggle */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex items-center gap-0.5 rounded-md border border-border bg-card p-0.5 select-none">
          {(
            [
              { id: "all", label: "All Events" },
              { id: "denied", label: "Denied Only" },
              { id: "payments", label: "Payments" },
              { id: "approvals", label: "Approvals" },
            ] as const
          ).map((t) => (
            <Button
              key={t.id}
              variant={filterType === t.id ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setFilterType(t.id)}
              className="h-6 px-2 text-[11px]"
            >
              {t.label}
            </Button>
          ))}
        </div>

        {/* 3-Second Live Polling Toggle */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsLivePolling(!isLivePolling)}
          aria-pressed={isLivePolling}
          className={`h-7 border px-2.5 text-[11px] ${
            isLivePolling
              ? "border-success/30 bg-success/10 text-success hover:bg-success/15 hover:text-success"
              : "border-border text-muted-foreground"
          }`}
        >
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              isLivePolling ? "bg-success animate-pulse" : "bg-muted-foreground"
            }`}
          />
          <span>{isLivePolling ? "Live 3s Polling" : "Polling Paused"}</span>
        </Button>
      </div>

      {/* AG Grid Container or Fallback States */}
      {isLoading && events.length === 0 ? (
        <div className="w-full rounded-lg border border-border bg-card p-6 space-y-3 animate-pulse">
          <div className="h-8 bg-zinc-800/60 rounded" />
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-10 bg-zinc-800/40 rounded" />
          ))}
        </div>
      ) : !isLoading && error && events.length === 0 ? (
        <div className="w-full rounded-lg border border-border bg-card p-8 flex flex-col items-center justify-center text-center">
          <AlertTriangle className="h-8 w-8 text-amber-500 mb-2" />
          <p className="text-sm font-semibold text-foreground">Failed to load activity audit trail</p>
          <p className="text-xs text-muted-foreground mt-1 max-w-md">{error.message}</p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void refetch()}
            className="mt-4 text-xs border-zinc-800 hover:bg-zinc-800"
          >
            <RefreshCw className="h-3 w-3 mr-1.5" />
            Retry Connection
          </Button>
        </div>
      ) : !isLoading && !error && events.length === 0 ? (
        <div className="w-full rounded-lg border border-border bg-card p-8 flex flex-col items-center justify-center text-center text-muted-foreground">
          <p className="text-sm">No activity recorded yet for this environment.</p>
        </div>
      ) : (
        <div className="ag-theme-quartz-dark w-full rounded-lg overflow-hidden border border-border">
          <AgGridReact<ActivityAuditRow>
            rowData={filteredRows}
            columnDefs={columnDefs}
            onGridReady={onGridReady}
            rowSelection={{ mode: "singleRow" }}
            domLayout="autoHeight"
            onRowClicked={(event) => {
              if (event.data) {
                handleViewTrace(event.data.actionId || event.data.id);
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
    </div>
  );
}
