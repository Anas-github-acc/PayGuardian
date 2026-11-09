"use client";

import * as React from "react";
import {
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  Columns2,
  Inbox,
  Loader2,
  Sparkles,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface SubagentAction {
  id: string;
  label: string;
  status?: "pending" | "running" | "done" | "error";
  time?: string;
  detail?: string;
}

export interface BackgroundInboxItem {
  id: string;
  title: string;
  status: "ready" | "running" | "waiting" | "done" | "error";
  detail?: string;
  time?: string;
  actions?: SubagentAction[];
  agentType?: string;
  model?: string;
}

export interface BackgroundInboxProps
  extends Omit<React.ComponentProps<"section">, "onSelect"> {
  items: BackgroundInboxItem[];
  title?: string;
  onSelect?: (id: string) => void;
  onOpenSplitView?: (item: BackgroundInboxItem) => void;
  selectedId?: string | null;
}

const titleTone: Record<BackgroundInboxItem["status"], string> = {
  ready: "text-foreground",
  done: "text-foreground",
  running: "text-foreground font-medium",
  waiting: "text-muted-foreground/80",
  error: "text-destructive font-medium",
};

function InboxStatus({ status }: Pick<BackgroundInboxItem, "status">) {
  if (status === "ready" || status === "done") {
    return (
      <CheckCircle2
        aria-label="Ready"
        className="size-4 text-emerald-600 transition-transform duration-200 dark:text-emerald-500"
      />
    );
  }
  if (status === "running") {
    return (
      <Loader2
        aria-label="Running"
        className="size-4 animate-spin text-blue-600 dark:text-blue-400"
      />
    );
  }
  if (status === "error") {
    return (
      <X
        aria-label="Error"
        className="size-4 text-destructive"
      />
    );
  }
  return (
    <Clock
      aria-label="Waiting"
      className="size-4 text-muted-foreground/70"
    />
  );
}

function ActionStatus({ status }: { status?: SubagentAction["status"] }) {
  if (status === "done") {
    return <CheckCircle2 className="size-3.5 text-emerald-600 dark:text-emerald-500 shrink-0" />;
  }
  if (status === "running") {
    return <Loader2 className="size-3.5 animate-spin text-blue-600 dark:text-blue-400 shrink-0" />;
  }
  if (status === "error") {
    return <X className="size-3.5 text-destructive shrink-0" />;
  }
  return <div className="size-2 rounded-full bg-muted-foreground/40 shrink-0 mx-0.5" />;
}

export function BackgroundInbox({
  className,
  items,
  title = "Subagents in progress",
  onSelect,
  onOpenSplitView,
  selectedId,
  ...props
}: BackgroundInboxProps) {
  const [expandedIds, setExpandedIds] = React.useState<Record<string, boolean>>({});

  const toggleExpand = React.useCallback((id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setExpandedIds((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  }, []);

  const runningCount = items.filter((i) => i.status === "running").length;
  const readyCount = items.filter((i) => i.status === "ready" || i.status === "done").length;

  return (
    <section
      data-slot="background-inbox"
      aria-label="Subagent workspace"
      className={cn(
        "flex flex-col gap-2 rounded-xl border border-border bg-card/60 p-3 shadow-xs backdrop-blur-xs",
        className
      )}
      {...props}
    >
      <header className="flex items-center gap-2 px-1 py-1">
        <Sparkles className="size-4 text-primary" />
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {title}
        </h3>
        <span
          className={cn(
            "ml-auto rounded-full px-2 py-0.5 text-xs font-mono tabular-nums",
            runningCount > 0
              ? "bg-blue-500/10 text-blue-600 dark:bg-blue-400/15 dark:text-blue-300"
              : readyCount > 0
              ? "bg-emerald-500/10 text-emerald-600 dark:bg-emerald-400/15 dark:text-emerald-300"
              : "bg-muted text-muted-foreground"
          )}
        >
          {runningCount > 0
            ? `${runningCount} active`
            : `${readyCount}/${items.length} done`}
        </span>
      </header>

      {items.length === 0 ? (
        <div className="flex items-center justify-center gap-2 py-6 text-xs text-muted-foreground">
          <Inbox className="size-4 opacity-50" />
          <span>No subagents currently dispatched</span>
        </div>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {items.map((item) => {
            const isExpanded = !!expandedIds[item.id];
            const isSelected = selectedId === item.id;
            const hasActions = (item.actions && item.actions.length > 0) || !!item.detail;

            return (
              <li
                key={item.id}
                className={cn(
                  "group relative rounded-lg border border-border/50 bg-background/50 p-2.5 transition-all duration-150 hover:border-border hover:bg-muted/30",
                  isSelected && "border-primary/50 bg-primary/5",
                  item.status === "running" && "ring-1 ring-blue-500/20"
                )}
              >
                <div className="flex items-start gap-2.5">
                  <span className="flex h-5 shrink-0 items-center mt-0.5">
                    <InboxStatus status={item.status} />
                  </span>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className={cn(
                            "truncate text-xs font-medium cursor-pointer hover:underline",
                            titleTone[item.status]
                          )}
                          onClick={() => {
                            onSelect?.(item.id);
                            if (onOpenSplitView) {
                              onOpenSplitView(item);
                            } else {
                              toggleExpand(item.id);
                            }
                          }}
                        >
                          {item.title}
                        </span>
                        {item.agentType && (
                          <span className="rounded bg-muted px-1.5 py-0.2 text-[10px] font-mono uppercase text-muted-foreground">
                            {item.agentType}
                          </span>
                        )}
                      </div>

                      {item.time && (
                        <span className="shrink-0 font-mono text-[11px] text-muted-foreground/70 tabular-nums">
                          {item.time}
                        </span>
                      )}
                    </div>

                    {item.detail && (
                      <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                        {item.detail}
                      </p>
                    )}

                    {/* Expandable Drawer / Subagent Actions Accordion */}
                    {isExpanded && (
                      <div className="mt-2.5 space-y-2 border-t border-border/40 pt-2 text-xs">
                        {item.actions && item.actions.length > 0 ? (
                          <div className="space-y-1.5">
                            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                              Subagent Steps
                            </span>
                            <ul className="space-y-1 pl-0.5">
                              {item.actions.map((act) => (
                                <li
                                  key={act.id}
                                  className="flex items-start gap-2 text-xs text-foreground/90"
                                >
                                  <span className="mt-0.5">
                                    <ActionStatus status={act.status} />
                                  </span>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-baseline justify-between gap-1">
                                      <span className="font-medium truncate">{act.label}</span>
                                      {act.time && (
                                        <span className="text-[10px] font-mono text-muted-foreground shrink-0">
                                          {act.time}
                                        </span>
                                      )}
                                    </div>
                                    {act.detail && (
                                      <p className="text-[11px] text-muted-foreground font-mono">
                                        {act.detail}
                                      </p>
                                    )}
                                  </div>
                                </li>
                              ))}
                            </ul>
                          </div>
                        ) : null}

                        {onOpenSplitView && (
                          <div className="pt-1 flex items-center justify-end">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onOpenSplitView(item);
                              }}
                              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1 text-xs font-medium text-foreground shadow-2xs hover:bg-muted"
                            >
                              <Columns2 className="size-3.5 text-primary" />
                              <span>Open in Split View</span>
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Actions column: Expand button & Split view button */}
                  <div className="flex items-center gap-1 shrink-0 mt-0.5">
                    {onOpenSplitView && (
                      <button
                        type="button"
                        aria-label="Open subagent in split view"
                        title="Open subagent split view"
                        className="inline-flex size-6 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenSplitView(item);
                        }}
                      >
                        <Columns2 className="size-3.5" />
                      </button>
                    )}

                    {hasActions && (
                      <button
                        type="button"
                        aria-expanded={isExpanded}
                        aria-label={isExpanded ? "Collapse actions" : "Expand actions"}
                        className="inline-flex size-6 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                        onClick={(e) => toggleExpand(item.id, e)}
                      >
                        {isExpanded ? (
                          <ChevronDown className="size-3.5" />
                        ) : (
                          <ChevronRight className="size-3.5" />
                        )}
                      </button>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

export default BackgroundInbox;
