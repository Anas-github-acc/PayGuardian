"use client";

import * as React from "react";
import { Plus, Search, RefreshCw, MessageSquare, Database } from "lucide-react";
import { cn } from "../../lib/utils";
import { useWorkspaceStore } from "../../app/lib/workspace-store";
import {
  getCachedConversations,
  saveConversation,
  type CachedConversation,
} from "../../lib/chat-cache";
import { getAuthHeaders } from "../../lib/api/client";

export interface SessionHistoryPanelProps {
  /** Closes the hosting Sheet after a selection/new-chat action. */
  onClose?: () => void;
  onSelectConversation?: (conversationId: string) => void;
  onNewConversation?: () => void;
  activeConversationId?: string | null;
  className?: string;
}

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001";

export function SessionHistoryPanel({
  onClose,
  onSelectConversation,
  onNewConversation,
  activeConversationId,
  className = "",
}: SessionHistoryPanelProps) {
  const store = useWorkspaceStore();
  const currentEnv = store.currentEnvironment;

  const [conversations, setConversations] = React.useState<CachedConversation[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [isFromCache, setIsFromCache] = React.useState(false);

  // Load from IndexedDB cache first, then sync with API
  const loadConversations = React.useCallback(async () => {
    if (!currentEnv?.id) return;
    setIsLoading(true);

    // 1. Instant load from IndexedDB (up to 10 previous conversations)
    try {
      const cached = await getCachedConversations(currentEnv.id);
      if (cached && cached.length > 0) {
        setConversations(cached);
        setIsFromCache(true);
      }
    } catch (err) {
      console.warn("IndexedDB read error:", err);
    }

    // 2. Fetch fresh list from API and update cache
    try {
      const res = await fetch(`${API_BASE}/v1/environments/${currentEnv.id}/conversations`, {
        headers: getAuthHeaders(),
      });

      if (res.ok) {
        const data = await res.json();
        const list: CachedConversation[] = (data.conversations || []).map((c: any) => ({
          id: c.id,
          environmentId: c.environment_id || c.environmentId,
          title: c.title || "Untitled Conversation",
          updatedAt: c.updated_at || c.updatedAt || new Date().toISOString(),
          metadata: c.metadata,
        }));

        setConversations(list);
        setIsFromCache(false);

        // Cache the latest 10
        for (const item of list.slice(0, 10)) {
          await saveConversation(item);
        }
      }
    } catch (err) {
      console.warn("API fetch error for conversations, keeping IndexedDB cache:", err);
    } finally {
      setIsLoading(false);
    }
  }, [currentEnv?.id]);

  React.useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return conversations;
    return conversations.filter((c) => c.title.toLowerCase().includes(q));
  }, [conversations, query]);

  return (
    <div className={cn("flex h-full flex-col gap-4 pt-4", className)}>
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => {
            onNewConversation?.();
            onClose?.();
          }}
          className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-blue-500 shadow-sm"
        >
          <Plus className="h-4 w-4" />
          <span>New Chat</span>
        </button>
        <button
          type="button"
          onClick={loadConversations}
          title="Refresh conversations"
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900 text-zinc-400 hover:text-white"
        >
          <RefreshCw className={cn("h-3.5 w-3.5", isLoading && "animate-spin")} />
        </button>
      </div>

      <div className="relative">
        <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-zinc-500" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter recent chats..."
          className="w-full rounded-lg border border-zinc-800 bg-zinc-900/80 py-1.5 pl-8 pr-3 text-xs text-zinc-200 placeholder-zinc-500 focus:border-zinc-700 focus:outline-none"
        />
      </div>

      <div className="flex items-center gap-1.5 px-1 text-[11px] text-zinc-500">
        <Database className="h-3 w-3 text-zinc-400" />
        <span>IndexedDB Cache (Last 10 chats)</span>
        {isFromCache && <span className="ml-auto text-[10px] text-emerald-500 font-mono">Offline-ready</span>}
      </div>

      <div className="flex-1 overflow-y-auto space-y-1">
        {filtered.length === 0 ? (
          <div className="p-4 text-center text-xs text-zinc-500">
            {isLoading ? "Loading chats..." : "No recent conversations."}
          </div>
        ) : (
          filtered.slice(0, 10).map((c) => {
            const isActive = c.id === activeConversationId;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => {
                  onSelectConversation?.(c.id);
                  onClose?.();
                }}
                className={cn(
                  "flex w-full flex-col items-start gap-1 rounded-lg px-3 py-2 text-left text-xs transition-colors",
                  isActive
                    ? "bg-zinc-800 text-white font-medium border border-zinc-700"
                    : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200 border border-transparent",
                )}
              >
                <div className="flex w-full items-center gap-2">
                  <MessageSquare className="h-3.5 w-3.5 shrink-0 text-blue-400" />
                  <span className="truncate">{c.title}</span>
                </div>
                <span className="text-[10px] text-zinc-500 pl-5.5">
                  {new Date(c.updatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </span>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
