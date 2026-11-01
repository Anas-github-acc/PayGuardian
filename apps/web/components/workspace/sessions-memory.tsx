"use client";

import * as React from "react";
import {
  Bot,
  Bookmark,
  FolderOpen,
  Info,
  Plus,
  RotateCcw,
} from "lucide-react";
import { workspaceStore } from "../../app/lib/workspace-store";
import {
  INITIAL_SESSIONS,
  INITIAL_MEMORIES,
  type SessionItem,
  type MemoryItem,
} from "./workspace-defaults";
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
  const [sessions, setSessions] = React.useState<SessionItem[]>(INITIAL_SESSIONS);
  const [activeSessionId, setActiveSessionId] = React.useState<string>(
    () => workspaceStore.getState().activeSessionId ?? INITIAL_SESSIONS[0]?.id ?? "sess-goa-01"
  );

  const handleSelectSession = (id: string) => {
    setActiveSessionId(id);
    workspaceStore.setActiveSessionId(id);
    onSelectSession?.(id);
  };

  const handleCreateNewSession = () => {
    const newId = `sess-new-${Date.now()}`;
    const newSession: SessionItem = {
      id: newId,
      title: `Task Session #${sessions.length + 1}`,
      description: "Fresh task session — awaiting operator context.",
      status: "active",
      lastActivity: "Just now",
      agentCount: 1,
    };
    const updated = [newSession, ...sessions];
    setSessions(updated);
    setActiveSessionId(newId);
    workspaceStore.setActiveSessionId(newId);
    // Strict invariant: new session starts pristine with no context inheritance
    workspaceStore.setChatMessages([]);
    onNewSession?.();
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
        <Button variant="outline" size="sm" onClick={handleCreateNewSession}>
          <Plus className="h-3.5 w-3.5" />
          New session
        </Button>
      </div>

      {/* Repo-style card grid */}
      <div
        className={`grid grid-cols-1 gap-4 ${singleColumn ? "" : "sm:grid-cols-2"}`}
      >
        {sessions.map((sess) => {
          const isActive = activeSessionId === sess.id;
          const badge = SESSION_BADGES[sess.status];

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
                <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${SESSION_DOTS[sess.status]}`} />
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
/* Memory — same card pattern, revoked = dashed + line-through         */
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
  singleColumn = false,
  showHeading = true,
}: MemoryVaultContentProps) {
  const [memories, setMemories] = React.useState<MemoryItem[]>(INITIAL_MEMORIES);
  const [activeMemoryTab, setActiveMemoryTab] = React.useState<"all" | "session" | "environment" | "agent">("all");

  const handleUndoMemory = (memId: string) => {
    setMemories((prev) =>
      prev.map((m) => (m.id === memId ? { ...m, isRevoked: true } : m))
    );
  };

  const filteredMemories = memories.filter((m) => {
    if (activeMemoryTab === "all") return true;
    return m.category === activeMemoryTab;
  });

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
          <Badge variant="secondary">{memories.length}</Badge>
          <div className="inline-flex items-center gap-1 rounded-lg border border-border bg-card p-1">
            {MEMORY_TABS.map(({ tab, label }) => {
              const mapTab = tab === "env" ? "environment" : tab === "sess" ? "session" : tab;
              const isCurrent = activeMemoryTab === mapTab;
              return (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveMemoryTab(mapTab as typeof activeMemoryTab)}
                  className={`rounded-md px-2 py-1 text-[11px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring ${
                    isCurrent
                      ? "border border-border bg-secondary text-foreground top-shade"
                      : "border border-transparent text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Card grid */}
      <div
        className={`grid gap-4 ${
          singleColumn ? "grid-cols-1" : "grid-cols-1 sm:grid-cols-2 xl:grid-cols-3"
        }`}
      >
        {filteredMemories.map((mem) => (
          <div
            key={mem.id}
            className={`flex flex-col rounded-lg border p-4 transition-opacity ${
              mem.isRevoked
                ? "border-dashed border-border bg-card/50 opacity-70"
                : "border-border bg-card"
            }`}
          >
            {/* Key + category pill */}
            <div className="flex items-start justify-between gap-3">
              <span
                className={`truncate font-mono text-xs font-medium text-success ${
                  mem.isRevoked ? "line-through" : ""
                }`}
              >
                {mem.key}
              </span>
              {mem.isRevoked ? (
                <Badge variant="revoked">Revoked</Badge>
              ) : (
                <Badge variant="secondary" className="shrink-0 font-mono uppercase">
                  {mem.category}
                </Badge>
              )}
            </div>

            <p
              className={`mt-2 line-clamp-2 text-xs leading-relaxed text-muted-foreground ${
                mem.isRevoked ? "line-through" : ""
              }`}
            >
              {mem.value}
            </p>

            {/* Footer: dot + metadata + forget action */}
            <div className="mt-auto flex items-center justify-between gap-2 border-t border-border pt-3 text-[11px] text-muted-foreground">
              <span className="flex min-w-0 items-center gap-1.5">
                <span aria-hidden className="h-1.5 w-1.5 shrink-0 rounded-full bg-muted-foreground" />
                <span className="truncate">{mem.agentName ?? "Environment"}</span>
                <span aria-hidden>·</span>
                <span className="shrink-0 font-mono">
                  {new Date(mem.savedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                </span>
              </span>
              {!mem.isRevoked && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleUndoMemory(mem.id)}
                  aria-label={`Forget memory ${mem.key}`}
                  title="Forget this memory"
                  className="h-6 w-6 shrink-0 p-0"
                >
                  <RotateCcw className="h-3 w-3" />
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Security invariant notice */}
      <div className="mt-3 flex items-start gap-1.5 rounded-md border border-border bg-secondary/60 p-2.5 text-[11px] leading-relaxed text-muted-foreground">
        <Info className="mt-0.5 h-3 w-3 shrink-0 text-warning" />
        <span>
          <strong className="text-muted-foreground">Security notice:</strong> Memory never grants
          spending permission.
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
