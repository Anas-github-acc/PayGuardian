"use client";

import * as React from "react";
import { Plus, Search } from "lucide-react";
import { cn } from "../../lib/utils";
import { workspaceStore, useWorkspaceStoreSelector } from "../../app/lib/workspace-store";
import { INITIAL_SESSIONS, type SessionItem } from "../workspace/workspace-defaults";

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
 * Ultra-minimal monochrome session history panel without bulky mock descriptions.
 */
export function SessionHistoryPanel({ onClose, className = "" }: SessionHistoryPanelProps) {
  const activeSessionId = useWorkspaceStoreSelector((s) => s.activeSessionId);
  const [sessions, setSessions] = React.useState<SessionItem[]>(INITIAL_SESSIONS);
  const [query, setQuery] = React.useState("");

  const currentId = activeSessionId ?? sessions[0]?.id ?? INITIAL_SESSIONS[0].id;

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return sessions;
    return sessions.filter((s) => s.title.toLowerCase().includes(q));
  }, [sessions, query]);

  const handleNewSession = () => {
    const newId = `sess-new-${Date.now()}`;
    const newSession: SessionItem = {
      id: newId,
      title: `New chat #${sessions.length + 1}`,
      description: "",
      status: "active",
      lastActivity: "Just now",
      agentCount: 1,
    };
    setSessions((prev) => [newSession, ...prev]);
    workspaceStore.setActiveSessionId(newId);
    // Strict invariant: new chat starts with no inherited context
    workspaceStore.setChatMessages([]);
    onClose?.();
  };

  const handleSelectSession = (id: string) => {
    workspaceStore.setActiveSessionId(id);
    onClose?.();
  };

  return (
    <div className={`flex min-h-0 flex-1 flex-col gap-3 pt-3 ${className}`}>
      {/* New chat button */}
      <button
        type="button"
        onClick={handleNewSession}
        className="flex h-8 w-full items-center justify-center gap-1.5 rounded-md border border-zinc-800 bg-zinc-900 px-3 text-xs font-medium text-zinc-200 transition-colors hover:bg-zinc-800 hover:text-white hover:border-zinc-700 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-500"
      >
        <Plus className="h-3.5 w-3.5 text-blue-400" />
        New thread
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

      {/* Session list (compact, title + timestamp only, zero bulky text) */}
      <div className="-mx-1 flex min-h-0 flex-1 flex-col overflow-y-auto px-1 space-y-1">
        {filtered.length === 0 ? (
          <p className="px-2 py-4 text-center text-xs text-zinc-500">No matching threads.</p>
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
                    className={cn("h-1.5 w-1.5 shrink-0 rounded-full", STATUS_DOTS[sess.status])}
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

      {/* Minimal Footer */}
      <div className="border-t border-zinc-800/60 pt-2 text-[10px] text-zinc-500 font-mono">
        Thread isolation · Authority bound to active mandates
      </div>
    </div>
  );
}
