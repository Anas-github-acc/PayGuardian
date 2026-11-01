"use client";

import * as React from "react";
import {
  ShieldAlert,
  AlertTriangle,
  Info,
  ExternalLink,
  Search,
  Filter,
  Copy,
  Clock,
  Zap,
} from "lucide-react";
import { formatMinorUnits } from "../../app/lib/currency";
import { useWorkspaceStore, workspaceStore } from "../../app/lib/workspace-store";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Badge } from "../ui/badge";
import { DEFAULT_SECURITY_EVENTS, type SecurityEventItem, type SecuritySeverity } from "./types";

export interface SecurityEventLogProps {
  onViewTrace?: (traceId: string) => void;
  className?: string;
}

export function SecurityEventLog({
  onViewTrace,
  className = "",
}: SecurityEventLogProps) {
  const [events, setEvents] = React.useState<SecurityEventItem[]>(DEFAULT_SECURITY_EVENTS);
  const [severityFilter, setSeverityFilter] = React.useState<string>("ALL");
  const [searchQuery, setSearchQuery] = React.useState<string>("");

  const handleViewTrace = (traceId?: string) => {
    if (!traceId) return;
    workspaceStore.setSelectedTraceId(traceId);
    if (onViewTrace) {
      onViewTrace(traceId);
    } else {
      workspaceStore.setActiveNavTab("traces");
    }
  };

  const filteredEvents = React.useMemo(() => {
    return events.filter((evt) => {
      if (severityFilter === "CRITICAL" && evt.severity !== "CRITICAL") return false;
      if (severityFilter === "WARNING" && evt.severity !== "WARNING") return false;
      if (severityFilter === "SIMULATION" && !evt.isSimulation) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchAgent = evt.agentName.toLowerCase().includes(q);
        const matchRule = evt.ruleViolated.toLowerCase().includes(q);
        const matchAction = evt.actionAttempted.toLowerCase().includes(q);
        const matchHash = evt.requestHash?.toLowerCase().includes(q);
        return matchAgent || matchRule || matchAction || matchHash;
      }
      return true;
    });
  }, [events, severityFilter, searchQuery]);

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Header & Filter Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-3">
        <div>
          <h4 className="text-sm font-semibold text-foreground">
            Security Incident & Violation Monitor
          </h4>
          <p className="text-xs text-muted-foreground mt-0.5">
            Audit stream of denied overspends, forged signatures, category violations, and simulation vector triggers.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Severity filter buttons */}
          <div className="inline-flex items-center gap-1 rounded-lg border border-border bg-card p-1 text-xs select-none">
            {["ALL", "CRITICAL", "WARNING", "SIMULATION"].map((sev) => (
              <button
                key={sev}
                type="button"
                onClick={() => setSeverityFilter(sev)}
                className={`rounded px-2.5 py-1 text-xs font-medium transition-all ${
                  severityFilter === sev
                    ? "bg-secondary text-foreground border border-border top-shade"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {sev}
              </button>
            ))}
          </div>

          <div className="relative w-44">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search..."
              className="h-8 pl-8 text-xs bg-card border-border"
            />
          </div>
        </div>
      </div>

      {/* Incident Cards Feed */}
      <div className="space-y-2.5">
        {filteredEvents.length === 0 ? (
          <div className="rounded-lg border border-hairline border-dashed bg-card p-8 text-center text-xs text-muted-foreground">
            No security violations recorded matching current filter.
          </div>
        ) : (
          filteredEvents.map((event) => {
            const isCritical = event.severity === "CRITICAL";
            const isWarning = event.severity === "WARNING";

            return (
              <div
                key={event.id}
                className={`rounded-lg border p-3.5 text-xs transition-colors top-shade ${
                  isCritical
                    ? "border-destructive/30 bg-destructive/5 hover:border-destructive/50"
                    : isWarning
                    ? "border-warning/30 bg-warning/5 hover:border-warning/50"
                    : "border-border bg-card hover:border-border"
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-2">
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={isCritical ? "rejected" : isWarning ? "pending" : "default"}
                      className="text-[10px] py-0 px-2 font-bold"
                    >
                      {event.severity}
                    </Badge>
                    {event.isSimulation && (
                      <span className="rounded bg-warning/20 border border-warning/30 px-1.5 py-[0.05rem] font-mono text-[9px] font-bold text-warning">
                        [SIMULATION]
                      </span>
                    )}
                    <span className="font-semibold text-foreground">{event.ruleViolated}</span>
                  </div>

                  <div className="flex items-center gap-2 font-mono text-[11px] text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    <span>{new Date(event.timestamp).toLocaleTimeString()}</span>
                  </div>
                </div>

                <div className="mt-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <div className="text-xs text-foreground">
                      <span className="text-muted-foreground">Involved Agent:</span>{" "}
                      <strong className="font-medium text-foreground">{event.agentName}</strong>{" "}
                      <span className="text-muted-foreground">({event.agentId})</span>
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      Attempted Action: <span className="font-mono text-foreground">{event.actionAttempted}</span>
                    </div>
                    {event.details && (
                      <p className="mt-1 text-[11px] text-muted-foreground leading-relaxed">
                        {event.details}
                      </p>
                    )}
                  </div>

                  {event.traceId && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleViewTrace(event.traceId)}
                      className="h-7 px-2.5 text-xs text-foreground hover:bg-white/[0.06] shrink-0"
                    >
                      <ExternalLink className="mr-1.5 h-3 w-3" />
                      Forensic Trace
                    </Button>
                  )}
                </div>

                {event.requestHash && (
                  <div className="mt-2 pt-2 border-t border-border flex items-center justify-between text-[10px] font-mono text-muted-foreground">
                    <span>SHA-256: {event.requestHash.slice(0, 16)}...{event.requestHash.slice(-8)}</span>
                    <span className="text-muted-foreground">Gateway Intercept</span>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
