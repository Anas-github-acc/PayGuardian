"use client";

import * as React from "react";
import { Plus, Search, Info, AlertCircle, RefreshCw } from "lucide-react";
import { cn } from "../../lib/utils";
import {
  useWorkspaceStore,
  workspaceStore,
  useWorkspaceStoreSelector,
} from "../../app/lib/workspace-store";
import { useSessions } from "../../lib/api/hooks/use-sessions";
import type { SessionItem } from "../../lib/api/types";

const STATUS_DOTS: Record<SessionItem["status"], string> = {
  "waiting for you": "bg-amber-500",
  active: "bg-blue-500",
  done: "bg-zinc-600",
};

export interface SessionHistoryPanelProps {
  /** Closes the hosting Sheet after a selection/new-chat action. */
  onClose?: () => void;
  className?: string;
}

/**
 * Minimal session history panel wired to live backend sessions with GAP-SESS-01 notice.
 */
export function SessionHistoryPanel({ onClose, className = "" }: SessionHistoryPanelProps) {
  const store = useWorkspaceStore();
  const currentEnv = store.currentEnvironment;
  const activeSessionId = useWorkspaceStoreSelector((s) => s.activeSessionId);

  // Live backend hook fetching /v1/environments/:id/sessions
  const { sessions, isLoading, error, createSession, refetch } = useSessions(currentEnv?.id);

  const [query, setQuery] = React.useState("");
  const [isCreating, setIsCreating] = React.useState(false);
  const [creationError, setCreationError] = React.useState<string | null>(null);

  const currentId = activeSessionId ?? sessions[0]?.id;

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return sessions;
    return sessions.filter((s) => s.title.toLowerCase().includes(q));
  }, [sessions, query]);

  const handleNewSession = async () => {
    if (!currentEnv?.id) {
      setCreationError("No active environment selected.");
      return;
    }

    setIsCreating(true);
    setCreationError(null);

    try {
      const title = `New thread #${sessions.length + 1}`;
      const purpose = "Operator chat session";

      // Real sequential backend command: POST /v1/environments/:id/sessions
      const created = await createSession({
        title,
        purpose,
        context: { description: purpose },
      });

      // Update UI strictly upon confirmed server response
      workspaceStore.setActiveSessionId(created.id);
      // Invariant: Session history persistence unavailable on gateway (GAP-SESS-01) -> start pristine thread
      workspaceStore.setChatMessages([]);
      onClose?.();
    } catch (err) {
      setCreationError(
        err instanceof Error ? err.message : "Failed to create session on backend gateway."
      );
    } finally {
      setIsCreating(false);
    }
  };

  const handleSelectSession = (id: string) => {
    workspaceStore.setActiveSessionId(id);
    // Invariant: Gateway does not persist session message history (GAP-SESS-01) -> start pristine thread
    workspaceStore.setChatMessages([]);
    onClose?.();
  };

  return (
    <div className={`flex min-h-0 flex-1 flex-col gap-3 pt-3 ${className}`}>
      {/* Explicit notice about missing message history on Gateway */}
      <div className="rounded-md border border-amber-900/40 bg-amber-950/20 p-2.5 text-[11px] text-amber-300 flex items-start gap-2">
        <Info className="h-3.5 w-3.5 text-amber-400 shrink-0 mt-0.5" />
        <span className="leading-snug">
          Session history persistence unavailable on gateway; starting new thread (
          <span className="font-mono text-zinc-300">GAP-SESS-01</span>).
        </span>
      </div>

      {creationError && (
        <div className="flex items-center gap-2 rounded-md border border-destructive/20 bg-destructive/10 p-2 text-xs text-destructive">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          <span>{creationError}</span>
        </div>
      )}

      {/* New chat button */}
      <button
        type="button"
        onClick={handleNewSession}
        disabled={isCreating || isLoading}
        className="flex h-8 w-full items-center justify-center gap-1.5 rounded-md border border-zinc-800 bg-zinc-900 px-3 text-xs font-medium text-zinc-200 transition-colors hover:bg-zinc-800 hover:text-white hover:border-zinc-700 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <Plus className="h-3.5 w-3.5 text-blue-400" />
        {isCreating ? "Creating on gateway…" : "New thread"}
      </button>

      {/* Search box */}
      <div className="flex h-7 items-center gap-2 rounded-md border border-zinc-800/80 bg-zinc-900/60 px-2.5 focus-within:border-zinc-700">
        <Search className="h-3 w-3 shrink-0 text-zinc-500" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter threads…"
          autoComplete="off"
          aria-label="Search sessions"
          className="w-full border-none bg-transparent text-xs text-zinc-200 placeholder:text-zinc-500 focus:outline-none"
        />
      </div>

      {/* Loading Skeleton */}
      {isLoading && (
        <div className="space-y-1 py-2 animate-pulse" aria-label="Loading threads skeleton">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="flex h-8 w-full items-center justify-between rounded-md bg-zinc-900/60 px-2.5"
            >
              <div className="h-3 w-28 rounded bg-zinc-800" />
              <div className="h-2.5 w-10 rounded bg-zinc-800" />
            </div>
          ))}
        </div>
      )}

      {/* Error state with retry */}
      {!isLoading && error && (
        <div className="rounded-md border border-red-900/30 bg-red-950/20 p-3 text-center text-xs text-red-400">
          <p className="text-[11px]">{error.message || "Failed to load sessions."}</p>
          <button
            type="button"
            onClick={() => void refetch()}
            className="mt-2 inline-flex items-center gap-1 text-[11px] text-zinc-300 hover:underline"
          >
            <RefreshCw className="h-3 w-3" /> Retry
          </button>
        </div>
      )}

      {/* Session list */}
      {!isLoading && !error && (
        <div className="-mx-1 flex min-h-0 flex-1 flex-col overflow-y-auto px-1 space-y-1">
          {filtered.length === 0 ? (
            <p className="px-2 py-4 text-center text-xs text-zinc-500">
              {query ? "No matching threads." : "No threads recorded."}
            </p>
          ) : (
            filtered.map((sess) => {
              const isActive = currentId === sess.id;
              return (
                <button
                  key={sess.id}
                  type="button"
                  onClick={() => handleSelectSession(sess.id)}
                  aria-current={isActive ? "true" : undefined}
                  className={cn(
                    "group flex w-full items-center justify-between gap-2.5 rounded-md px-2.5 py-2 text-left transition-colors border focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-500",
                    isActive
                      ? "bg-zinc-900 border-zinc-700/80 text-white"
                      : "border-transparent text-zinc-400 hover:bg-zinc-900/70 hover:border-zinc-800 hover:text-zinc-200"
                  )}
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <span
                      aria-hidden
                      className={cn("h-1.5 w-1.5 shrink-0 rounded-full", STATUS_DOTS[sess.status] ?? "bg-blue-500")}
                    />
                    <span className="truncate text-xs font-medium leading-none">
                      {sess.title}
                    </span>
                  </div>
                  <span className="shrink-0 font-mono text-[10px] text-zinc-500">
                    {sess.lastActivity}
                  </span>
                </button>
              );
            })
          )}
        </div>
      )}

      {/* Minimal Footer */}
      <div className="border-t border-zinc-800/60 pt-2 text-[10px] text-zinc-500 font-mono">
        Thread isolation · Authority bound to active mandates
      </div>
    </div>
  );
}
