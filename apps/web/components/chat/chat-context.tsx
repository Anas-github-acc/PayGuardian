"use client";

import * as React from "react";
import { useWorkspaceStore } from "../../app/lib/workspace-store";
import {
  getCachedConversations,
  saveConversation,
  deleteCachedConversation,
  type CachedConversation,
} from "../../lib/chat-cache";

const PINNED_STORAGE_KEY = "pg_pinned_chat_ids";

interface ChatContextValue {
  conversations: CachedConversation[];
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
  const store = useWorkspaceStore();
  const currentEnv = store.currentEnvironment;
  const currentEnvId = currentEnv?.id;

  const [conversations, setConversations] = React.useState<CachedConversation[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [sidebarOpen, setSidebarOpen] = React.useState(true);
  const [mandateOverlayOpen, setMandateOverlayOpen] = React.useState(false);
  const [pinnedChatIds, setPinnedChatIds] = React.useState<string[]>([]);

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

  const refreshConversations = React.useCallback(async () => {
    if (!currentEnvId) return;
    setIsLoading(true);

    try {
      const cached = await getCachedConversations(currentEnvId);
      if (cached && cached.length > 0) {
        setConversations(cached);
      }
    } catch (err) {
      console.warn("Could not read cached conversations:", err);
    }

    try {
      const res = await fetch(`${API_BASE}/v1/environments/${currentEnvId}/conversations`, {
        headers: { "x-local-user-id": "local-user" },
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
        for (const item of list.slice(0, 10)) {
          await saveConversation(item);
        }
      }
    } catch (err) {
      console.warn("API fetch failed, retaining cached chats:", err);
    } finally {
      setIsLoading(false);
    }
  }, [currentEnvId]);

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
