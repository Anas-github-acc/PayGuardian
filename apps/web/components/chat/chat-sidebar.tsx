"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import { motion } from "motion/react";
import {
  ArrowLeft,
  Bot,
  Clock,
  MessageSquare,
  MoreHorizontal,
  PanelLeft,
  Pin,
  Search,
  SquarePen,
  Trash2,
  X,
} from "lucide-react";
import { cn } from "../../lib/utils";
import { useWorkspaceStore } from "../../app/lib/workspace-store";
import { useChat } from "./chat-context";
import { MandateOverlay } from "./mandate-overlay";

export interface ChatSidebarProps {
  className?: string;
}

export function ChatSidebar({ className = "" }: ChatSidebarProps) {
  const router = useRouter();
  const params = useParams();
  const store = useWorkspaceStore();
  const currentEnv = store.currentEnvironment;
  const {
    conversations,
    isLoading,
    sidebarOpen,
    toggleSidebar,
    pinnedChatIds,
    togglePinChat,
    isPinned,
    deleteConversation,
    mandateOverlayOpen,
    setMandateOverlayOpen,
  } = useChat();

  const activeChatId = typeof params?.chatId === "string" ? params.chatId : null;

  const [searchOpen, setSearchOpen] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [activeMenuId, setActiveMenuId] = React.useState<string | null>(null);

  // Close context menu on outside click
  React.useEffect(() => {
    const handleOutside = () => setActiveMenuId(null);
    if (activeMenuId) {
      window.addEventListener("click", handleOutside);
      return () => window.removeEventListener("click", handleOutside);
    }
  }, [activeMenuId]);

  const filteredConversations = React.useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return conversations;
    return conversations.filter((c) => c.title.toLowerCase().includes(q));
  }, [conversations, searchQuery]);

  const pinnedConversations = React.useMemo(() => {
    return filteredConversations.filter((c) => isPinned(c.id));
  }, [filteredConversations, isPinned]);

  const recentConversations = React.useMemo(() => {
    return filteredConversations.filter((c) => !isPinned(c.id));
  }, [filteredConversations, isPinned]);

  return (
    <>
      <motion.aside
        initial={false}
        animate={{
          width: sidebarOpen ? 260 : 0,
          opacity: sidebarOpen ? 1 : 0,
        }}
        transition={{ duration: 0.25, ease: [0.32, 0.72, 0, 1] }}
        className={cn(
          "flex h-full shrink-0 flex-col overflow-hidden border-r border-zinc-900 bg-zinc-950 text-zinc-300 select-none",
          !sidebarOpen && "pointer-events-none border-r-0",
          className
        )}
      >
        <div className="flex h-full w-[260px] flex-col">
          {/* Top Header */}
          <div className="flex h-14 items-center justify-between px-3.5 border-b border-zinc-900/80">
            <span className="font-semibold text-sm tracking-tight text-white pl-1">
              PayGuardian
            </span>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setSearchOpen((prev) => !prev)}
                title="Search chats"
                className="flex h-8 w-8 items-center justify-center text-zinc-400 hover:text-white transition-colors"
              >
                <Search className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={toggleSidebar}
                title="Close sidebar"
                className="flex h-8 w-8 items-center justify-center text-zinc-400 hover:text-white transition-colors"
              >
                <PanelLeft className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Search Input Bar (Expandable) */}
          {searchOpen && (
            <div className="p-2 border-b border-zinc-900/60 bg-zinc-925">
              <div className="relative flex items-center">
                <Search className="absolute left-2.5 h-3.5 w-3.5 text-zinc-500" />
                <input
                  type="text"
                  autoFocus
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search chats..."
                  className="w-full rounded-md border border-zinc-800 bg-zinc-900 py-1.5 pl-8 pr-7 text-xs text-zinc-200 placeholder-zinc-500 focus:border-zinc-700 focus:outline-none"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    className="absolute right-2 text-zinc-400 hover:text-white"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Primary Navigation Actions */}
          <div className="p-2 space-y-1">
            <button
              type="button"
              onClick={() => router.push("/chat/new")}
              className="flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-sm font-medium text-zinc-200 hover:bg-zinc-900 hover:text-white transition-colors"
            >
              <SquarePen className="h-4 w-4 text-zinc-400" />
              <span>New chat</span>
            </button>

            <button
              type="button"
              onClick={() => router.push("/dashboard?tab=agents")}
              className="flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-sm text-zinc-300 hover:bg-zinc-900 hover:text-white transition-colors"
            >
              <Bot className="h-4 w-4 text-zinc-400" />
              <span>Agents library</span>
            </button>

            <button
              type="button"
              onClick={() => setMandateOverlayOpen(true)}
              className="flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-sm text-zinc-300 hover:bg-zinc-900 hover:text-white transition-colors"
            >
              <Clock className="h-4 w-4 text-zinc-400" />
              <span>Mandate</span>
            </button>
          </div>

          <div className="h-px bg-zinc-900 mx-3 my-1" />

          {/* Scrollable Conversation Groups */}
          <div className="flex-1 overflow-y-auto px-2 py-2 space-y-5">
            {/* Pinned Section */}
            {pinnedConversations.length > 0 && (
              <div>
                <div className="px-2.5 py-1 text-[11px] font-medium text-zinc-500 tracking-wide uppercase">
                  Pinned
                </div>
                <div className="space-y-1 mt-1">
                  {pinnedConversations.map((c) => {
                    const isActive = c.id === activeChatId;
                    return (
                      <div
                        key={c.id}
                        className={cn(
                          "group relative flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors text-left cursor-pointer",
                          isActive
                            ? "bg-zinc-800 text-white font-medium"
                            : "text-zinc-300 hover:bg-zinc-900 hover:text-white"
                        )}
                        onClick={() => router.push(`/chat/${c.id}`)}
                      >
                        <MessageSquare className="h-3.5 w-3.5 shrink-0 text-zinc-400" />
                        <span className="truncate flex-1">{c.title}</span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            togglePinChat(c.id);
                          }}
                          title="Unpin chat"
                          className="text-zinc-300 hover:text-white transition-colors p-1"
                        >
                          <Pin className="h-3.5 w-3.5 fill-current" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Recents Section with generous spacing */}
            <div>
              <div className="px-2.5 py-1 text-[11px] font-medium text-zinc-500 tracking-wide uppercase">
                Recents
              </div>
              <div className="space-y-1 mt-1">
                {recentConversations.length === 0 ? (
                  <div className="px-2.5 py-3 text-xs text-zinc-500">
                    {isLoading ? "Loading chats…" : "No previous conversations."}
                  </div>
                ) : (
                  recentConversations.map((c) => {
                    const isActive = c.id === activeChatId;
                    const isMenuOpen = activeMenuId === c.id;

                    return (
                      <div
                        key={c.id}
                        className={cn(
                          "group relative flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors text-left cursor-pointer",
                          isActive
                            ? "bg-zinc-800 text-white font-medium"
                            : "text-zinc-300 hover:bg-zinc-900 hover:text-white"
                        )}
                        onClick={() => router.push(`/chat/${c.id}`)}
                      >
                        <MessageSquare className="h-3.5 w-3.5 shrink-0 text-zinc-400" />
                        <span className="truncate flex-1">{c.title}</span>

                        {/* Hover Actions: Pin & 3-dots */}
                        <div
                          className={cn(
                            "items-center gap-1 shrink-0 text-zinc-400",
                            isMenuOpen ? "flex" : "hidden group-hover:flex"
                          )}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            type="button"
                            title={isPinned(c.id) ? "Unpin chat" : "Pin chat"}
                            onClick={() => togglePinChat(c.id)}
                            className="hover:text-white p-1 transition-colors"
                          >
                            <Pin
                              className={cn(
                                "h-3.5 w-3.5",
                                isPinned(c.id) && "fill-current text-zinc-200"
                              )}
                            />
                          </button>
                          <button
                            type="button"
                            title="Chat options"
                            onClick={() =>
                              setActiveMenuId((prev) => (prev === c.id ? null : c.id))
                            }
                            className="hover:text-white p-1 transition-colors"
                          >
                            <MoreHorizontal className="h-3.5 w-3.5" />
                          </button>
                        </div>

                        {/* 3-Dot Options Dropdown */}
                        {isMenuOpen && (
                          <div
                            className="absolute right-2 top-9 z-30 w-52 rounded-lg border border-zinc-800 bg-zinc-900 p-1.5 shadow-xl text-xs space-y-1 text-zinc-300"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div className="px-2 py-1 text-[10px] text-zinc-500 font-mono border-b border-zinc-800/80">
                              Updated:{" "}
                              {c.updatedAt
                                ? new Date(c.updatedAt).toLocaleString(undefined, {
                                    month: "short",
                                    day: "numeric",
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })
                                : "Recent"}
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                togglePinChat(c.id);
                                setActiveMenuId(null);
                              }}
                              className="flex w-full items-center gap-2 rounded px-2 py-1.5 hover:bg-zinc-800 hover:text-white text-left transition-colors"
                            >
                              <Pin className="h-3.5 w-3.5" />
                              <span>{isPinned(c.id) ? "Unpin chat" : "Pin to top"}</span>
                            </button>
                            <button
                              type="button"
                              onClick={async () => {
                                setActiveMenuId(null);
                                await deleteConversation(c.id);
                                if (activeChatId === c.id) {
                                  router.push("/chat/new");
                                }
                              }}
                              className="flex w-full items-center gap-2 rounded px-2 py-1.5 hover:bg-zinc-800 text-red-400 hover:text-red-300 text-left transition-colors"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              <span>Delete chat</span>
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          {/* Footer: Back to Dashboard & Environment */}
          <div className="p-2 border-t border-zinc-900 space-y-1">
            <button
              type="button"
              onClick={() => router.push("/dashboard")}
              className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium text-zinc-400 hover:text-white transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Back to Dashboard</span>
            </button>

            <div className="flex items-center justify-between px-2.5 py-1.5 text-[11px] text-zinc-500">
              <span className="truncate">{currentEnv?.name ?? "Sandbox"}</span>
              <span className="font-mono text-zinc-400">{currentEnv?.currency ?? "INR"}</span>
            </div>
          </div>
        </div>
      </motion.aside>

      {/* Mandate Overlay Modal */}
      <MandateOverlay
        open={mandateOverlayOpen}
        onClose={() => setMandateOverlayOpen(false)}
      />
    </>
  );
}
