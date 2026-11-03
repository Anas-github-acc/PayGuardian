"use client";

import * as React from "react";
import {
  Bot,
  Bookmark,
  FolderOpen,
  Info,
  Plus,
  RotateCcw,
  AlertCircle,
  RefreshCw,
} from "lucide-react";
import { useWorkspaceStore, workspaceStore } from "../../app/lib/workspace-store";
import { useSessions } from "../../lib/api/hooks/use-sessions";
import { useAgentMemory } from "../../lib/api/hooks/use-agent-memory";
import type { SessionItem } from "../../lib/api/types";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";

/* ------------------------------------------------------------------ */
/* Sessions — Image 3 repo-style cards                                 */
/* ------------------------------------------------------------------ */

const SESSION_BADGES: Record<
  SessionItem["status"],
  { variant: "pending" | "success" | "secondary"; label: string }
> = {
  "waiting for you": { variant: "pending", label: "waiting for you" },
  active: { variant: "success", label: "active" },
  done: { variant: "secondary", label: "done" },
};

const SESSION_DOTS: Record<SessionItem["status"], string> = {
  "waiting for you": "bg-warning",
  active: "bg-success",
  done: "bg-muted-foreground",
};

export interface SessionsGridProps {
  className?: string;
  onSelectSession?: (sessionId: string) => void;
  onNewSession?: () => void;
  /** Single column layout for narrow containers such as a Sheet. */
  singleColumn?: boolean;
}

export function SessionsGrid({
  className = "",
  onSelectSession,
  onNewSession,
  singleColumn = false,
}: SessionsGridProps) {
  const store = useWorkspaceStore();
  const currentEnv = store.currentEnvironment;

  // Live backend hook fetching /v1/environments/:id/sessions
  const { sessions, isLoading, error, createSession, refetch } = useSessions(currentEnv?.id);

  const [activeSessionId, setActiveSessionId] = React.useState<string | null>(
    () => workspaceStore.getState().activeSessionId
  );
  const [isCreating, setIsCreating] = React.useState(false);
  const [creationError, setCreationError] = React.useState<string | null>(null);

  // Sync activeSessionId from store or first session
  React.useEffect(() => {
    const storeId = workspaceStore.getState().activeSessionId;
    if (storeId) {
      setActiveSessionId(storeId);
    } else if (sessions.length > 0) {
      setActiveSessionId(sessions[0].id);
      workspaceStore.setActiveSessionId(sessions[0].id);
    }
  }, [sessions]);

  const handleSelectSession = (id: string) => {
    setActiveSessionId(id);
    workspaceStore.setActiveSessionId(id);
    // Invariant: Session history persistence unavailable on gateway (GAP-SESS-01), start pristine thread
    workspaceStore.setChatMessages([]);
    onSelectSession?.(id);
  };

  const handleCreateNewSession = async () => {
    if (!currentEnv?.id) {
      setCreationError("No active environment selected.");
      return;
    }

    setIsCreating(true);
    setCreationError(null);

    try {
      const title = `Task Session #${sessions.length + 1}`;
      const purpose = "Fresh task session — awaiting operator context.";

      // Real sequential backend command: POST /v1/environments/:id/sessions
      const created = await createSession({
        title,
        purpose,
        context: { description: purpose },
      });

      // Update UI state strictly upon confirmed server response
      setActiveSessionId(created.id);
      workspaceStore.setActiveSessionId(created.id);
      workspaceStore.setChatMessages([]);
      onNewSession?.();
    } catch (err) {
      setCreationError(
        err instanceof Error ? err.message : "Failed to create session on backend gateway."
      );
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <section aria-label="Sessions" className={className}>
      {/* Section header */}
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h2 className="flex items-center gap-2 text-sm font-semibold tracking-tight text-foreground">
            <FolderOpen className="h-4 w-4 text-muted-foreground" />
            Sessions
          </h2>
          <Badge variant="secondary">{sessions.length}</Badge>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleCreateNewSession}
          disabled={isCreating || isLoading}
          className="h-8 text-xs"
        >
          <Plus className="h-3.5 w-3.5 mr-1" />
          {isCreating ? "Creating…" : "New session"}
        </Button>
      </div>

      {/* Explicit notice: Session history persistence missing on gateway (GAP-SESS-01) */}
      <div className="mb-4 rounded-md border border-border bg-secondary/80 p-3 text-xs text-muted-foreground flex items-center gap-2">
        <Info className="h-4 w-4 text-warning shrink-0" />
        <span className="leading-snug">
          Session history persistence unavailable on gateway; starting new thread (
          <span className="font-mono text-[11px] text-foreground">GAP-SESS-01</span>).
        </span>
      </div>

      {creationError && (
        <div className="mb-4 flex items-center gap-2 rounded-md border border-destructive/20 bg-destructive/10 p-2.5 text-xs text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{creationError}</span>
        </div>
      )}

      {/* Loading Skeleton */}
      {isLoading && (
        <div
          className={`grid grid-cols-1 gap-4 ${singleColumn ? "" : "sm:grid-cols-2"} animate-pulse`}
          aria-label="Loading sessions skeleton"
        >
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="rounded-lg border border-border bg-card p-4 space-y-3">
              <div className="flex justify-between items-start">
                <div className="h-9 w-9 rounded-md bg-muted/60" />
                <div className="h-5 w-20 rounded bg-muted/50" />
              </div>
              <div className="h-4 w-3/4 rounded bg-muted/60" />
              <div className="h-8 w-full rounded bg-muted/30" />
              <div className="border-t border-border pt-3 flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-muted/40" />
                <div className="h-3 w-16 rounded bg-muted/40" />
                <div className="h-3 w-12 rounded bg-muted/40" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Error State with Retry */}
      {!isLoading && error && (
        <div className="flex flex-col items-center justify-center rounded-lg border border-destructive/30 bg-destructive/5 p-6 text-center">
          <AlertCircle className="h-8 w-8 text-destructive mb-2" />
          <h4 className="text-sm font-semibold text-foreground">Failed to load sessions</h4>
          <p className="mt-1 text-xs text-muted-foreground max-w-sm">
            {error.message || "Could not retrieve sessions from gateway."}
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void refetch()}
            className="mt-3 h-7 text-xs inline-flex items-center gap-1.5"
          >
            <RefreshCw className="h-3 w-3" />
            Retry
          </Button>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && !error && sessions.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-card/40 p-8 text-center">
          <Bot className="h-9 w-9 text-muted-foreground mb-2" />
          <h4 className="text-sm font-semibold text-foreground">No active sessions</h4>
          <p className="mt-1 text-xs text-muted-foreground max-w-xs">
            No task sessions initialized in this environment. Click &apos;New session&apos; to create an
            autonomous thread.
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={handleCreateNewSession}
            disabled={isCreating}
            className="mt-4 h-7 text-xs"
          >
            <Plus className="h-3.5 w-3.5 mr-1" />
            Initialize session
          </Button>
        </div>
      )}

      {/* Repo-style card grid */}
      {!isLoading && !error && sessions.length > 0 && (
        <div className={`grid grid-cols-1 gap-4 ${singleColumn ? "" : "sm:grid-cols-2"}`}>
          {sessions.map((sess) => {
            const isActive = activeSessionId === sess.id;
            const badge = SESSION_BADGES[sess.status] ?? SESSION_BADGES.active;

            return (
              <div
                key={sess.id}
                role="button"
                tabIndex={0}
                aria-pressed={isActive}
                onClick={() => handleSelectSession(sess.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    handleSelectSession(sess.id);
                  }
                }}
                className={`cursor-pointer rounded-lg border p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring ${
                  isActive
                    ? "border-ring bg-secondary top-shade"
                    : "border-border bg-card hover:bg-secondary/50"
                }`}
              >
                {/* Icon tile + title + status pill */}
                <div className="flex items-start justify-between gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border bg-secondary text-muted-foreground">
                    <Bot className="h-4 w-4" />
                  </span>
                  <Badge variant={badge.variant} showDot>
                    {badge.label}
                  </Badge>
                </div>

                <div className="mt-3 truncate text-sm font-medium text-foreground">
                  {sess.title}
                </div>
                <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                  {sess.description ?? "Autonomous task session with delegated agent authority."}
                </p>

                {/* Footer: dot + metadata */}
                <div className="mt-3 flex items-center gap-1.5 border-t border-border pt-3 text-[11px] text-muted-foreground">
                  <span
                    aria-hidden
                    className={`h-1.5 w-1.5 rounded-full ${SESSION_DOTS[sess.status] ?? "bg-success"}`}
                  />
                  <span>{sess.lastActivity}</span>
                  <span aria-hidden>·</span>
                  <span>
                    {sess.agentCount} agent{sess.agentCount === 1 ? "" : "s"}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* SessionsPanel — sheet-friendly standalone sessions list             */
/* ------------------------------------------------------------------ */

export function SessionsPanel({ className = "" }: SessionsGridProps) {
  return (
    <SessionsGrid
      singleColumn
      className={`flex min-h-0 flex-1 flex-col overflow-y-auto ${className}`}
    />
  );
}

/* ------------------------------------------------------------------ */
/* Memory — R2: Memory Vault Unavailable container (GAP-MEM-01)        */
/* ------------------------------------------------------------------ */

const MEMORY_TABS = [
  { tab: "all", label: "All" },
  { tab: "env", label: "Env" },
  { tab: "sess", label: "Session" },
  { tab: "agent", label: "Agent" },
] as const;

export interface MemoryVaultContentProps {
  className?: string;
  /** Single column layout for narrow containers such as a Sheet. */
  singleColumn?: boolean;
  /** Hide the inline heading when a Sheet header already shows it. */
  showHeading?: boolean;
}

export function MemoryVaultContent({
  className = "",
  showHeading = true,
}: MemoryVaultContentProps) {
  const store = useWorkspaceStore();
  const currentEnv = store.currentEnvironment;

  // Wire to useAgentMemory hook
  const { isUnavailable, reason } = useAgentMemory(currentEnv?.id);

  const [activeMemoryTab, setActiveMemoryTab] = React.useState<"all" | "session" | "environment" | "agent">("all");

  return (
    <div className={className}>
      {/* Toolbar: optional heading + category filter pills */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        {showHeading && (
          <h2 className="flex items-center gap-2 text-sm font-semibold tracking-tight text-foreground">
            <Bookmark className="h-4 w-4 text-muted-foreground" />
            Memory vault
          </h2>
        )}
        <div className="flex items-center gap-2">
          <Badge variant="secondary">0</Badge>
          <div className="inline-flex items-center gap-1 rounded-lg border border-border bg-card p-1 opacity-60">
            {MEMORY_TABS.map(({ tab, label }) => {
              const mapTab = tab === "env" ? "environment" : tab === "sess" ? "session" : tab;
              const isCurrent = activeMemoryTab === mapTab;
              return (
                <button
                  key={tab}
                  type="button"
                  disabled
                  onClick={() => setActiveMemoryTab(mapTab as typeof activeMemoryTab)}
                  className={`rounded-md px-2 py-1 text-[11px] font-medium transition-colors cursor-not-allowed ${
                    isCurrent
                      ? "border border-border bg-secondary text-foreground"
                      : "border border-transparent text-muted-foreground"
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* R2: Explicit Memory Vault Unavailable Container */}
      {isUnavailable && (
        <div className="flex flex-col items-center justify-center rounded-lg border border-warning/30 bg-card p-8 text-center">
          <Bookmark className="h-10 w-10 text-warning mb-3 opacity-80" />
          <h3 className="text-sm font-semibold text-foreground">
            Memory Vault Unavailable: Persistent backend storage for agent memories is not yet implemented
          </h3>
          <p className="mt-2 max-w-md text-xs leading-relaxed text-muted-foreground">
            {reason}
          </p>
          <div className="mt-4 rounded border border-border bg-secondary/60 px-3 py-1.5 font-mono text-[11px] text-muted-foreground">
            Tracking in docs/gaps.md &bull; GAP-MEM-01 &bull; public.memories
          </div>
          <div className="mt-4">
            <Button variant="outline" size="sm" disabled className="h-7 text-xs opacity-50 cursor-not-allowed">
              <RotateCcw className="mr-1 h-3 w-3" />
              Forget Actions Disabled
            </Button>
          </div>
        </div>
      )}

      {/* Security invariant notice */}
      <div className="mt-4 flex items-start gap-1.5 rounded-md border border-border bg-secondary/60 p-2.5 text-[11px] leading-relaxed text-muted-foreground">
        <Info className="mt-0.5 h-3 w-3 shrink-0 text-warning" />
        <span>
          <strong className="text-foreground">Security notice:</strong> Memory never grants
          spending permission. Authority can only be granted via signed cryptographic mandates.
        </span>
      </div>
    </div>
  );
}

export interface MemoryGridProps {
  className?: string;
}

export function MemoryGrid({ className = "" }: MemoryGridProps) {
  return (
    <section aria-label="Memory vault" className={className}>
      <MemoryVaultContent />
    </section>
  );
}
