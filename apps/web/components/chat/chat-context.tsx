"use client";

import * as React from "react";
import { useWorkspaceStore } from "../../app/lib/workspace-store";
import { useEnvironments } from "../../lib/api/hooks/use-environments";
import {
  getCachedConversations,
  saveConversation,
  deleteCachedConversation,
  isConversationCached,
  saveMessages,
  type CachedConversation,
  type CachedMessage,
} from "../../lib/chat-cache";

const PINNED_STORAGE_KEY = "pg_pinned_chat_ids";

function isValidUuid(id: unknown): id is string {
  return typeof id === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}

interface ChatContextValue {
  conversations: CachedConversation[];
  activeConversationId: string | null;
  setActiveConversationId: React.Dispatch<React.SetStateAction<string | null>>;
  selectConversation: (id: string) => Promise<void>;
  prefetchConversationOnHover: (convId: string) => Promise<void>;
  isLoading: boolean;
  pinnedChatIds: string[];
  togglePinChat: (id: string) => void;
  isPinned: (id: string) => boolean;
  deleteConversation: (id: string) => Promise<void>;
  refreshConversations: () => Promise<void>;
  upsertConversation: (conversation: CachedConversation) => Promise<void>;
  sidebarOpen: boolean;
  setSidebarOpen: React.Dispatch<React.SetStateAction<boolean>>;
  toggleSidebar: () => void;
  mandateOverlayOpen: boolean;
  setMandateOverlayOpen: React.Dispatch<React.SetStateAction<boolean>>;
}

const ChatContext = React.createContext<ChatContextValue | null>(null);

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001";

export function ChatProvider({ children }: { children: React.ReactNode }) {
  const { currentEnvironment, environments } = useEnvironments();
  const currentEnvId = currentEnvironment?.id;

  const [conversations, setConversations] = React.useState<CachedConversation[]>([]);
  const [activeConversationId, setActiveConversationId] = React.useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    const match = window.location.pathname.match(/\/chat\/(.+)/);
    if (!match) return null;
    const id = match[1];
    return id === "new" ? null : id;
  });
  const [isLoading, setIsLoading] = React.useState(false);
  const [sidebarOpen, setSidebarOpen] = React.useState(true);
  const [mandateOverlayOpen, setMandateOverlayOpen] = React.useState(false);
  const [pinnedChatIds, setPinnedChatIds] = React.useState<string[]>([]);
  const hoverFetchTimesRef = React.useRef<Map<string, number>>(new Map());

  // Load pinned IDs from localStorage
  React.useEffect(() => {
    try {
      const stored = localStorage.getItem(PINNED_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          setPinnedChatIds(parsed);
        }
      }
    } catch {
      // ignore
    }
  }, []);

  // Listen to browser navigation (back / forward) to update activeConversationId in-place
  React.useEffect(() => {
    const handlePopState = () => {
      const match = window.location.pathname.match(/\/chat\/([^/?#]+)/);
      const id = match ? (match[1] === "new" ? null : match[1]) : null;
      setActiveConversationId(id);
      window.dispatchEvent(
        new CustomEvent("payguardian:conversation-selected", {
          detail: { conversationId: id },
        })
      );
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const togglePinChat = React.useCallback((id: string) => {
    setPinnedChatIds((prev) => {
      const exists = prev.includes(id);
      const updated = exists ? prev.filter((p) => p !== id) : [id, ...prev];
      try {
        localStorage.setItem(PINNED_STORAGE_KEY, JSON.stringify(updated));
      } catch {
        // ignore
      }
      return updated;
    });
  }, []);

  const isPinned = React.useCallback(
    (id: string) => pinnedChatIds.includes(id),
    [pinnedChatIds]
  );

  const toggleSidebar = React.useCallback(() => {
    setSidebarOpen((prev) => !prev);
  }, []);

  const selectConversation = React.useCallback(async (id: string) => {
    const isNew = id === "new" || !id;
    const targetId = isNew ? null : id;
    setActiveConversationId(targetId);

    if (typeof window !== "undefined") {
      const targetUrl = isNew ? "/chat/new" : `/chat/${id}`;
      if (window.location.pathname !== targetUrl) {
        window.history.pushState(null, "", targetUrl);
      }
      window.dispatchEvent(
        new CustomEvent("payguardian:conversation-selected", {
          detail: { conversationId: targetId },
        })
      );
    }
  }, []);

  const prefetchConversationOnHover = React.useCallback(
    async (convId: string) => {
      if (!convId || convId === "new") return;

      // 20-second debouncing window
      const now = Date.now();
      const lastFetch = hoverFetchTimesRef.current.get(convId) || 0;
      if (now - lastFetch < 20000) {
        return;
      }

      try {
        const alreadyCached = await isConversationCached(convId);
        if (alreadyCached) {
          return;
        }

        // Record timestamp for 20s debouncing
        hoverFetchTimesRef.current.set(convId, now);

        const effectiveEnvId =
          (currentEnvId && isValidUuid(currentEnvId) ? currentEnvId : null) ||
          environments.find((e) => isValidUuid(e.id))?.id ||
          (typeof window !== "undefined" && isValidUuid(localStorage.getItem("payguardian_active_env_id"))
            ? localStorage.getItem("payguardian_active_env_id")
            : null);

        if (!effectiveEnvId) return;

        const res = await fetch(`${API_BASE}/v1/environments/${effectiveEnvId}/conversations/${convId}/messages`, {
          headers: { "x-local-user-id": "local-user" },
        });

        if (res.ok) {
          const data = await res.json();
          const rawMessages = data.messages || [];
          const toCache: CachedMessage[] = rawMessages.map((m: any) => ({
            id: m.id,
            conversationId: convId,
            senderType: m.sender_type === "user" || m.senderType === "user" ? "user" : "assistant",
            content: m.content || "",
            createdAt: m.created_at || m.createdAt || new Date().toISOString(),
          }));
          await saveMessages(convId, toCache);
        }
      } catch (err) {
        console.warn("Hover prefetch error for conversation:", convId, err);
      }
    },
    [currentEnvId, environments],
  );

  const refreshConversations = React.useCallback(async () => {
    const effectiveEnvId =
      (currentEnvId && isValidUuid(currentEnvId) ? currentEnvId : null) ||
      environments.find((e) => isValidUuid(e.id))?.id ||
      (typeof window !== "undefined" && isValidUuid(localStorage.getItem("payguardian_active_env_id"))
        ? localStorage.getItem("payguardian_active_env_id")
        : null);

    if (!effectiveEnvId) return;
    setIsLoading(true);

    try {
      const cached = await getCachedConversations(effectiveEnvId);
      if (cached && cached.length > 0) {
        setConversations(cached);
      }
    } catch (err) {
      console.warn("Could not read cached conversations:", err);
    }

    try {
      const res = await fetch(`${API_BASE}/v1/environments/${effectiveEnvId}/conversations`, {
        headers: { "x-local-user-id": "local-user" },
      });
      if (res.ok) {
        const data = await res.json();
        const list: CachedConversation[] = (data.conversations || []).map((c: any) => ({
          id: c.id,
          environmentId: c.environment_id || c.environmentId || effectiveEnvId,
          title: c.title || "Untitled Conversation",
          updatedAt: c.updated_at || c.updatedAt || new Date().toISOString(),
          metadata: c.metadata,
        }));
        setConversations(list);
        for (const item of list.slice(0, 10)) {
          await saveConversation(item);
        }
      }
    } catch (err) {
      console.warn("API fetch failed, retaining cached chats:", err);
    } finally {
      setIsLoading(false);
    }
  }, [currentEnvId, environments]);

  React.useEffect(() => {
    refreshConversations();
  }, [refreshConversations]);

  const upsertConversation = React.useCallback(
    async (item: CachedConversation) => {
      setConversations((prev) => {
        const index = prev.findIndex((c) => c.id === item.id);
        if (index >= 0) {
          const updated = [...prev];
          updated[index] = item;
          return updated;
        }
        return [item, ...prev];
      });
      await saveConversation(item);
    },
    [],
  );

  const deleteConversation = React.useCallback(
    async (id: string) => {
      setConversations((prev) => prev.filter((c) => c.id !== id));
      setPinnedChatIds((prev) => {
        const updated = prev.filter((p) => p !== id);
        try {
          localStorage.setItem(PINNED_STORAGE_KEY, JSON.stringify(updated));
        } catch {
          // ignore
        }
        return updated;
      });

      await deleteCachedConversation(id);

      if (currentEnvId) {
        try {
          await fetch(`${API_BASE}/v1/environments/${currentEnvId}/conversations/${id}`, {
            method: "DELETE",
            headers: { "x-local-user-id": "local-user" },
          });
        } catch (err) {
          console.warn("API delete failed (retained local delete):", err);
        }
      }
    },
    [currentEnvId],
  );

  return (
    <ChatContext.Provider
      value={{
        conversations,
        activeConversationId,
        setActiveConversationId,
        selectConversation,
        prefetchConversationOnHover,
        isLoading,
        pinnedChatIds,
        togglePinChat,
        isPinned,
        deleteConversation,
        refreshConversations,
        upsertConversation,
        sidebarOpen,
        setSidebarOpen,
        toggleSidebar,
        mandateOverlayOpen,
        setMandateOverlayOpen,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
}

export function useChat() {
  const context = React.useContext(ChatContext);
  if (!context) {
    throw new Error("useChat must be used within a ChatProvider");
  }
  return context;
}
