"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Brain,
  CreditCard,
  History,
  Hotel,
  Info,
  Square,
  Sparkles,
  Wallet,
  X,
  ChevronRight,
  Layers,
  ExternalLink,
  CheckCircle2,
  Clock,
  Loader2,
  AlertCircle,
  Database,
  PanelLeft,
  PanelLeftOpen,
  PanelLeftClose,
} from "lucide-react";
import { useWorkspaceStore } from "../../app/lib/workspace-store";
import { useDashboardNavigation } from "../../app/lib/navigation";
import { Button } from "../ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "../ui/sheet";
import { AIComposer, type AIComposerSubmission } from "./ai-composer";
import { SessionHistoryPanel } from "./session-history";
import { useChat } from "./chat-context";
import { AgentProgress } from "../ui/agent-progress";
import {
  ReasoningThread,
  type ThreadMessage,
  type ThreadStep,
} from "../ui/reasoning-thread";
import {
  BackgroundInbox,
  type BackgroundInboxItem,
} from "../ui/background-inbox";
import { OAuthConsentCard } from "../ui/oauth-consent-card";
import { useAdaptiveStream } from "../../lib/adaptive-stream";
import {
  saveConversation,
  saveMessages,
  getCachedMessages,
  type CachedMessage,
} from "../../lib/chat-cache";
import { ContextWindowDialog } from "./context-window-dialog";
import { ProposedBudgetCard, type ProposedAllocationItem } from "./proposed-budget-card";

export interface AssistantViewProps {
  conversationIdFromUrl?: string;
  className?: string;
  onViewTrace?: (traceId?: string) => void;
}

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001";

interface SubagentProgressState {
  id: string;
  title: string;
  status: "ready" | "running" | "waiting";
  time?: string;
  detail?: string;
  actions?: Array<{
    id: string;
    label: string;
    status: "done" | "running" | "error" | "pending";
    time?: string;
    detail?: string;
  }>;
  streamText?: string;
}

interface PendingApprovalData {
  id: string;
  clientName: string;
  productName: string;
  action: string;
  amountMinor: number;
  currency: string;
  mandateId: string;
  type?: string;
  proposedAllocations?: ProposedAllocationItem[];
  rootBudgetMinor?: number;
}

export function AssistantView({
  conversationIdFromUrl,
  className = "",
  onViewTrace,
}: AssistantViewProps) {
  const router = useRouter();
  const store = useWorkspaceStore();
  const currentEnv = store.currentEnvironment;
  const currentEnvId = currentEnv?.id;

  // Persistent sidebar controls & conversation manager from ChatProvider
  const { sidebarOpen, setSidebarOpen, upsertConversation } = useChat();

  // Active conversation & runs
  const [activeConversationId, setActiveConversationId] = React.useState<string | null>(
    conversationIdFromUrl && conversationIdFromUrl !== "new" ? conversationIdFromUrl : null
  );
  const [activeRunId, setActiveRunId] = React.useState<string | null>(null);

  // Thread messages for ReasoningThread
  const [threadMessages, setThreadMessages] = React.useState<ThreadMessage[]>([]);
  const [isStreaming, setIsStreaming] = React.useState(false);
  const [currentProgressLabel, setCurrentProgressLabel] = React.useState<string>("Processing");

  // Subagents list & progress
  const [subagents, setSubagents] = React.useState<SubagentProgressState[]>([]);
  const [selectedSubagentId, setSelectedSubagentId] = React.useState<string | null>(null);

  // Pending user approval state
  const [pendingApproval, setPendingApproval] = React.useState<PendingApprovalData | null>(null);

  // Context window modal
  const [contextWindowOpen, setContextWindowOpen] = React.useState(false);
  const [activeModelId, setActiveModelId] = React.useState<string>("free/gpt-6-luna");

  // Scroll container and auto-scroll tracking refs
  const messagesContainerRef = React.useRef<HTMLDivElement>(null);
  const messagesEndRef = React.useRef<HTMLDivElement>(null);
  const isNearBottomRef = React.useRef(true);
  const eventSourceRef = React.useRef<EventSource | null>(null);
  const lastEventIdRef = React.useRef<string | null>(null);

  // Dedicated container-level scroll-to-bottom
  const scrollToBottom = React.useCallback((behavior: ScrollBehavior = "smooth") => {
    const container = messagesContainerRef.current;
    if (!container) return;
    container.scrollTo({
      top: container.scrollHeight,
      behavior,
    });
  }, []);

  // Track if user has manually scrolled away from the bottom
  const handleContainerScroll = React.useCallback(() => {
    const container = messagesContainerRef.current;
    if (!container) return;
    const threshold = 120;
    const isNear =
      container.scrollHeight - container.scrollTop - container.clientHeight <= threshold;
    isNearBottomRef.current = isNear;
  }, []);

  // Auto-scroll when messages, streaming tokens, or subagents arrive (only if already near bottom)
  React.useEffect(() => {
    if (isStreaming) {
      if (isNearBottomRef.current) {
        scrollToBottom("smooth");
      }
    } else {
      if (isNearBottomRef.current) {
        scrollToBottom("auto");
      }
    }
  }, [threadMessages, subagents, isStreaming, scrollToBottom]);

  // Track the most recently requested fetch ID to prevent race conditions / stale updates
  const activeFetchIdRef = React.useRef<string | null>(null);

  // Load conversation messages from IndexedDB cache and gateway API with stale response protection
  const loadConversation = React.useCallback(
    async (convId: string) => {
      activeFetchIdRef.current = convId;
      setActiveConversationId(convId);
      setSubagents([]);
      setSelectedSubagentId(null);
      setPendingApproval(null);

      // 1. Instant load from IndexedDB
      try {
        const cached = await getCachedMessages(convId);
        // Ignore stale response if user navigated away
        if (activeFetchIdRef.current !== convId) return;
        if (cached && cached.length > 0) {
          const mapped: ThreadMessage[] = cached.map((m) =>
            m.senderType === "user" || (m as any).role === "user"
              ? { id: m.id, role: "user", text: m.content }
              : { id: m.id, role: "assistant", text: m.content },
          );
          setThreadMessages(mapped);
          isNearBottomRef.current = true;
          requestAnimationFrame(() => scrollToBottom("auto"));
        } else {
          setThreadMessages([]);
        }
      } catch (err) {
        console.warn("Could not read cached messages:", err);
      }

      // 2. Fetch fresh messages from API
      if (currentEnvId) {
        try {
          const res = await fetch(
            `${API_BASE}/v1/environments/${currentEnvId}/conversations/${convId}/messages`,
            {
              headers: { "x-local-user-id": "local-user" },
            },
          );
          // Check stale response
          if (activeFetchIdRef.current !== convId) return;

          if (res.ok) {
            const data = await res.json();
            // Check stale response
            if (activeFetchIdRef.current !== convId) return;

            const rawMsgs = data.messages || [];
            if (rawMsgs.length > 0) {
              const msgs: ThreadMessage[] = rawMsgs.map((m: any) =>
                m.role === "user" || m.sender_type === "user" || m.senderType === "user"
                  ? { id: m.id, role: "user", text: m.content }
                  : { id: m.id, role: "assistant", text: m.content },
              );
              setThreadMessages(msgs);
              isNearBottomRef.current = true;
              requestAnimationFrame(() => scrollToBottom("auto"));

              // Save to IndexedDB
              const toCache: CachedMessage[] = rawMsgs.map((m: any) => ({
                id: m.id,
                conversationId: convId,
                senderType: m.role === "user" || m.sender_type === "user" || m.senderType === "user" ? "user" : "assistant",
                content: m.content,
                createdAt: m.created_at || m.createdAt || new Date().toISOString(),
              }));
              await saveMessages(convId, toCache);
            }
          }
        } catch (err) {
          console.warn("Failed to fetch messages from API, using cached:", err);
        }
      }
    },
    [currentEnvId],
  );

  // Single source of truth: load conversation strictly based on route URL parameter
  React.useEffect(() => {
    isNearBottomRef.current = true;
    if (!conversationIdFromUrl || conversationIdFromUrl === "new") {
      activeFetchIdRef.current = null;
      setActiveConversationId(null);
      setThreadMessages([]);
      setSubagents([]);
      setSelectedSubagentId(null);
      setPendingApproval(null);
      return;
    }

    loadConversation(conversationIdFromUrl);
  }, [conversationIdFromUrl, loadConversation]);

  // SSE Stream Connection with automatic reconnect & Last-Event-ID recovery
  const connectSSE = React.useCallback(
    (runId: string) => {
      if (!currentEnvId) return;

      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }

      const tokenParam = "local-user";
      const lastIdParam = lastEventIdRef.current ? `&lastEventId=${lastEventIdRef.current}` : "";
      const streamUrl = `${API_BASE}/v1/environments/${currentEnvId}/runs/${runId}/stream?localUserId=${encodeURIComponent(
        tokenParam,
      )}&token=${encodeURIComponent(tokenParam)}${lastIdParam}`;

      const es = new EventSource(streamUrl);
      eventSourceRef.current = es;

      es.onmessage = (event) => {
        if (!event.data) return;
        try {
          const parsed = JSON.parse(event.data);
          if (event.lastEventId) {
            lastEventIdRef.current = event.lastEventId;
          }
          handleSSEEvent(event.type || parsed.event, parsed);
        } catch {
          // ignore parsing error
        }
      };

      // Custom event listeners
      const eventTypes = [
        "run.started",
        "task.created",
        "agent.started",
        "agent.progress",
        "tool.started",
        "tool.completed",
        "agent.output",
        "task.completed",
        "task.failed",
        "approval.requested",
        "run.completed",
      ];

      for (const evType of eventTypes) {
        es.addEventListener(evType, (event: any) => {
          if (event.lastEventId) {
            lastEventIdRef.current = event.lastEventId;
          }
          try {
            const data = JSON.parse(event.data);
            handleSSEEvent(evType, data);
          } catch {
            // ignore
          }
        });
      }

      es.onerror = () => {
        // If run already completed, close cleanly without logging reconnection warnings
        if (eventSourceRef.current?.readyState === EventSource.CLOSED) {
          return;
        }
      };
    },
    [currentEnvId],
  );

  // Dispatch incoming SSE events to thread & subagents
  const handleSSEEvent = (eventType: string, payload: any) => {
    switch (eventType) {
      case "run.started":
        setIsStreaming(true);
        setCurrentProgressLabel("Thinking… Planning task execution");
        break;

      case "task.created": {
        const agentKey = payload.agentId || payload.agent;
        if (agentKey && agentKey !== "personal") {
          setCurrentProgressLabel(`Thinking… Formulated task for ${agentKey.charAt(0).toUpperCase() + agentKey.slice(1)} specialist`);
          setSubagents((prev) => {
            if (prev.some((s) => s.id === agentKey)) return prev;
            const isMerchant = agentKey.toLowerCase().includes("merchant");
            const title = isMerchant
              ? "MerchantAttach Specialist"
              : `${agentKey.charAt(0).toUpperCase() + agentKey.slice(1)} Specialist`;
            return [
              ...prev,
              {
                id: agentKey,
                title,
                status: "waiting",
                time: isMerchant ? "~3m simulation" : "Queued",
                detail: payload.description || "Subagent delegated by Main Orchestrator",
                actions: [],
              },
            ];
          });
        }
        break;
      }

      case "agent.started": {
        const agentKey = payload.agentId || payload.agent;
        if (agentKey && agentKey !== "personal") {
          setCurrentProgressLabel(`Thinking… ${agentKey.charAt(0).toUpperCase() + agentKey.slice(1)} specialist researching quotes`);
          setSubagents((prev) =>
            prev.map((s) =>
              s.id === agentKey
                ? { ...s, status: "running", time: "Active", detail: payload.message || s.detail }
                : s,
            ),
          );
        } else {
          setCurrentProgressLabel("Thinking… Personal Agent orchestrating");
        }
        break;
      }

      case "agent.progress": {
        if (payload.message) {
          const rawMsg = String(payload.message).trim();
          const cleanMsg = rawMsg.toLowerCase().startsWith("thinking")
            ? rawMsg
            : `Thinking… ${rawMsg}`;
          setCurrentProgressLabel(cleanMsg);
        }
        const agentKey = payload.agentId || payload.agent;
        if (agentKey && agentKey !== "personal") {
          setSubagents((prev) =>
            prev.map((s) =>
              s.id === agentKey
                ? {
                    ...s,
                    detail: payload.message,
                    actions: [
                      ...(s.actions || []),
                      {
                        id: `act-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
                        label: payload.message,
                        status: "running",
                        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
                      },
                    ],
                  }
                : s,
            ),
          );
        }
        break;
      }

      case "tool.started": {
        setCurrentProgressLabel(`Thinking… Verifying authority (${payload.tool || "gateway check"})`);
        const agentKey = payload.agentId || payload.agent;
        if (agentKey && agentKey !== "personal") {
          setSubagents((prev) =>
            prev.map((s) =>
              s.id === agentKey
                ? {
                    ...s,
                    actions: [
                      ...(s.actions || []),
                      {
                        id: `tool-${payload.tool || Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
                        label: `Tool: ${payload.tool || "Gateway check"}`,
                        status: "running",
                        detail: JSON.stringify(payload.parameters || {}),
                      },
                    ],
                  }
                : s,
            ),
          );
        }
        break;
      }

      case "tool.completed": {
        setCurrentProgressLabel("Thinking… Authority checks verified");
        const agentKey = payload.agentId || payload.agent;
        if (agentKey && agentKey !== "personal") {
          setSubagents((prev) =>
            prev.map((s) =>
              s.id === agentKey
                ? {
                    ...s,
                    actions: (s.actions || []).map((a) =>
                      a.label.includes(payload.tool || "")
                        ? { ...a, status: "done", detail: JSON.stringify(payload.result || "Success") }
                        : a,
                    ),
                  }
                : s,
            ),
          );
        }
        break;
      }

      case "approval.requested":
        setPendingApproval({
          id: payload.approvalId || `appr-${Date.now()}`,
          clientName: payload.agentId ? `${payload.agentId} Agent` : "Specialist Agent",
          productName: "PayGuardian Gateway",
          action: payload.action || "action.execute",
          amountMinor: payload.amountMinor || 0,
          currency: payload.currency || "USD",
          mandateId: payload.mandateId || "",
          type: payload.type || (payload.proposedAllocations ? "budget_proposal" : "action_approval"),
          proposedAllocations: payload.proposedAllocations,
          rootBudgetMinor: payload.rootBudgetMinor || currentEnv?.budgetLimitMinor,
        });
        break;

      case "agent.output": {
        setCurrentProgressLabel("Thinking… Synthesizing coordinated response");
        const textChunk = payload.text ?? payload.output ?? payload.finalResponse ?? payload.content ?? "";
        const agentKey = payload.agentId || payload.agent;
        if (agentKey && agentKey !== "personal") {
          // Accumulate subagent streaming output for split-screen inspection
          setSubagents((prev) =>
            prev.map((s) =>
              s.id === agentKey
                ? {
                    ...s,
                    status: "running",
                    streamText: (s.streamText || "") + textChunk,
                  }
                : s,
            ),
          );
        } else {
          // Main agent output stream
          setThreadMessages((prev) => {
            const last = prev[prev.length - 1];
            if (last && last.role === "assistant" && last.streaming) {
              // If textChunk is identical to last.text or last.text already contains it, ignore to prevent duplicate
              if (textChunk === last.text || (last.text && last.text.includes(textChunk))) {
                return prev;
              }
              // If textChunk is a full replacement that starts with or is longer than last.text
              if (textChunk.startsWith(last.text) || !last.text) {
                return [
                  ...prev.slice(0, -1),
                  { ...last, text: textChunk },
                ];
              }
              // If payload is a streaming delta chunk
              if (payload.isDelta) {
                return [
                  ...prev.slice(0, -1),
                  { ...last, text: last.text + textChunk },
                ];
              }
              // Full text replacement
              return [
                ...prev.slice(0, -1),
                { ...last, text: textChunk },
              ];
            }
            return [
              ...prev,
              {
                id: `asst-${Date.now()}`,
                role: "assistant",
                text: textChunk,
                streaming: true,
              },
            ];
          });
        }
        break;
      }

      case "task.completed": {
        const agentKey = payload.agentId || payload.agent;
        if (agentKey && agentKey !== "personal") {
          setSubagents((prev) =>
            prev.map((s) =>
              s.id === agentKey ? { ...s, status: "ready", time: "Completed" } : s,
            ),
          );
        }
        break;
      }

      case "run.completed": {
        setIsStreaming(false);
        const finalTxt = payload.finalResponse ?? payload.output ?? payload.text ?? "";
        setThreadMessages((prev) => {
          const updated = prev.map((m) =>
            m.role === "assistant"
              ? { ...m, text: finalTxt ? finalTxt : m.text, streaming: false }
              : m,
          );
          if (activeConversationId) {
            const toCache: CachedMessage[] = updated.map((m) => ({
              id: m.id,
              conversationId: activeConversationId,
              senderType: m.role === "user" ? "user" : "assistant",
              content: m.text,
              createdAt: new Date().toISOString(),
            }));
            saveMessages(activeConversationId, toCache).catch(() => {});
          }
          return updated;
        });
        if (eventSourceRef.current) {
          eventSourceRef.current.close();
        }
        break;
      }
    }
  };

  React.useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, []);

  // Send message handler with model and mode parameters
  const handleSendMessage = async (submission: AIComposerSubmission) => {
    const text = submission.prompt.trim();
    if (!text || isStreaming || !currentEnvId) return;

    if (submission.modelId) {
      setActiveModelId(submission.modelId);
    }

    // 1. Append user message to thread immediately
    const userMsgId = `usr-${Date.now()}`;
    const userMsg: ThreadMessage = {
      id: userMsgId,
      role: "user",
      text,
    };

    setThreadMessages((prev) => [...prev, userMsg]);
    setIsStreaming(true);
    isNearBottomRef.current = true;
    requestAnimationFrame(() => scrollToBottom("smooth"));
    setCurrentProgressLabel("Thinking… Initializing Personal Agent");
    setSubagents([]);
    setPendingApproval(null);

    // Placeholder assistant message with streaming state
    const assistantMsgId = `asst-${Date.now()}`;
    setThreadMessages((prev) => [
      ...prev,
      {
        id: assistantMsgId,
        role: "assistant",
        text: "",
        streaming: true,
      },
    ]);

    try {
      // Create conversation if none active
      let convId = activeConversationId;
      if (!convId) {
        const createConvRes = await fetch(`${API_BASE}/v1/environments/${currentEnvId}/conversations`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-local-user-id": "local-user",
          },
          body: JSON.stringify({
            title: text.slice(0, 36) + (text.length > 36 ? "..." : ""),
            metadata: { model: submission.modelId, mode: submission.mode },
          }),
        });

        if (createConvRes.ok) {
          const convData = await createConvRes.json();
          convId = convData.conversation.id;
          setActiveConversationId(convId);
          if (typeof window !== "undefined") {
            window.history.replaceState(null, "", `/chat/${convId}`);
          }
          await upsertConversation({
            id: convId!,
            environmentId: currentEnvId,
            title: convData.conversation.title || text.slice(0, 30),
            updatedAt: new Date().toISOString(),
          });
        } else {
          const errData = await createConvRes.json().catch(() => ({}));
          throw new Error(errData.message || "Failed to create conversation with gateway");
        }
      }

      // Submit user message with model & mode metadata to gateway
      const msgRes = await fetch(
        `${API_BASE}/v1/environments/${currentEnvId}/conversations/${convId}/messages`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-local-user-id": "local-user",
          },
          body: JSON.stringify({
            content: text,
            metadata: {
              model: submission.modelId,
              mode: submission.mode,
              effort: submission.effort,
            },
          }),
        },
      );

      if (msgRes.ok) {
        const result = await msgRes.json();
        setActiveRunId(result.runId);
        lastEventIdRef.current = null;
        connectSSE(result.runId);
      } else {
        const errData = await msgRes.json().catch(() => ({}));
        throw new Error(errData.message || "Failed to submit message to gateway");
      }
    } catch (err: any) {
      setIsStreaming(false);
      setThreadMessages((prev) =>
        prev.map((m) =>
          m.id === assistantMsgId
            ? { ...m, text: `Error: ${err.message || "Could not reach gateway"}`, streaming: false }
            : m,
        ),
      );
    }
  };

  const selectedSubagent = subagents.find((s) => s.id === selectedSubagentId);

  return (
    <div className={`relative flex min-w-0 flex-1 flex-col h-full overflow-hidden bg-zinc-950 ${className}`}>
      {/* Top action bar: standard flex header, never covering messages */}
      <div className="flex h-14 shrink-0 items-center justify-between border-b border-zinc-900 bg-zinc-950/90 backdrop-blur-md px-4 sm:px-6 z-10">
          <div className="flex items-center gap-2.5">
            {!sidebarOpen && (
              <button
                type="button"
                onClick={() => setSidebarOpen(true)}
                title="Open sidebar"
                className="flex h-8 w-8 items-center justify-center text-zinc-400 hover:text-white transition-colors"
              >
                <PanelLeft className="h-4 w-4" />
              </button>
            )}

            <button
              type="button"
              onClick={() => router.push("/dashboard")}
              className="flex items-center gap-1.5 text-xs font-medium text-zinc-400 hover:text-white transition-colors px-1 py-1"
              title="Return to Dashboard"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Dashboard</span>
            </button>

            <div className="h-4 w-px bg-zinc-800 mx-1" />

            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold tracking-tight text-white">Main Agent Chat</span>
              <span className="rounded-full bg-zinc-900 px-2 py-0.5 text-[10px] font-medium text-zinc-400 border border-zinc-800">
                LangGraph Personal
              </span>
            </div>
          </div>

          {/* Context Window button */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setContextWindowOpen(true)}
              title="View Chat Context Window"
              className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white transition-colors px-2 py-1"
            >
              <Layers className="h-3.5 w-3.5" />
              <span>Context Window</span>
            </button>
          </div>
        </div>

        {/* Main chat layout with optional split-screen for subagent inspection */}
        <div className="relative flex flex-1 min-h-0 divide-x divide-zinc-900 overflow-hidden">
          {/* Left Side: Main Agent Chat Thread */}
          <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
            {/* Only messages should scroll */}
            <div
              ref={messagesContainerRef}
              onScroll={handleContainerScroll}
              className="flex-1 min-h-0 overflow-y-auto"
            >
              <div className="mx-auto flex w-full max-w-3xl flex-col px-4 pt-6 pb-6 sm:px-6 space-y-6">
              {threadMessages.length === 0 ? (
                <div className="my-auto flex flex-col items-center justify-center py-16 text-center">
                  <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl border border-zinc-800 bg-zinc-900 text-white shadow-sm">
                    <Brain className="h-5 w-5 text-blue-400" />
                  </div>
                  <h2 className="text-lg font-semibold tracking-tight text-white">Personal Agent Orchestrator</h2>
                  <p className="mt-1.5 max-w-sm text-xs leading-relaxed text-zinc-400">
                    Plans and delegates tasks to Travel, Hotel, and Food subagents through the PayGuardian Gateway.
                  </p>
                </div>
              ) : (
                <ReasoningThread messages={threadMessages} className="w-full max-w-full" />
              )}

            {/* Pending Approval / Proposed Budget Allocation Component (Option A) */}
            {pendingApproval && (
              <div className="pt-2">
                {pendingApproval.type === "budget_proposal" && pendingApproval.proposedAllocations && pendingApproval.proposedAllocations.length > 0 ? (
                  <ProposedBudgetCard
                    id={pendingApproval.id}
                    mandateId={pendingApproval.mandateId}
                    currency={pendingApproval.currency}
                    rootBudgetMinor={pendingApproval.rootBudgetMinor ?? currentEnv?.budgetLimitMinor ?? 1000000}
                    totalProposedMinor={pendingApproval.amountMinor}
                    allocations={pendingApproval.proposedAllocations}
                    onApprove={async () => {
                      // Execute real signed child mandate delegation on the Gateway for approved specialists
                      if (currentEnvId && pendingApproval.mandateId) {
                        try {
                          for (const alloc of pendingApproval.proposedAllocations || []) {
                            await fetch(`${API_BASE}/v1/mandates/${pendingApproval.mandateId}/delegations`, {
                              method: "POST",
                              headers: {
                                "Content-Type": "application/json",
                                "x-local-user-id": "local-user",
                              },
                              body: JSON.stringify({
                                holderAgentId: alloc.agent,
                                budgetLimitMinor: alloc.requestedMandateMinor,
                                currency: pendingApproval.currency,
                                permittedActions: alloc.capabilities,
                              }),
                            });
                          }
                        } catch (err) {
                          console.warn("Failed to create child mandates:", err);
                        }
                      }
                      setPendingApproval(null);
                      await handleSendMessage({
                        prompt: "okay delegate",
                        mode: "Delegate",
                        modelId: activeModelId,
                        modelName: "Default Model",
                        effort: "Medium",
                        autoMode: true,
                        attachedFiles: [],
                        files: [],
                      });
                    }}
                    onDeny={async () => {
                      setPendingApproval(null);
                      await handleSendMessage({
                        prompt: "I reject the proposed budget allocation. Do not proceed.",
                        mode: "Ask",
                        modelId: activeModelId,
                        modelName: "Default Model",
                        effort: "Medium",
                        autoMode: true,
                        attachedFiles: [],
                        files: [],
                      });
                    }}
                  />
                ) : (
                  <OAuthConsentCard
                    clientName={pendingApproval.clientName}
                    productName={pendingApproval.productName}
                    action={pendingApproval.action}
                    amountMinor={pendingApproval.amountMinor}
                    currency={pendingApproval.currency}
                    mandateId={pendingApproval.mandateId}
                    redirectUri="PayGuardian Ledger Authority"
                    email="operator@payguardian.local"
                    onApprove={async () => {
                      setPendingApproval(null);
                      await handleSendMessage({
                        prompt: "okay delegate",
                        mode: "Delegate",
                        modelId: activeModelId,
                        modelName: "Default Model",
                        effort: "Medium",
                        autoMode: true,
                        attachedFiles: [],
                        files: [],
                      });
                    }}
                    onDeny={async () => {
                      setPendingApproval(null);
                      await handleSendMessage({
                        prompt: "I reject the proposed budget allocation. Do not proceed.",
                        mode: "Ask",
                        modelId: activeModelId,
                        modelName: "Default Model",
                        effort: "Medium",
                        autoMode: true,
                        attachedFiles: [],
                        files: [],
                      });
                    }}
                  />
                )}
              </div>
            )}

            {/* Subagents Progress Box beneath Main Agent */}
            {subagents.length > 0 && (
              <div className="pt-2">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-medium text-zinc-400">Delegated Subagents</span>
                  <span className="text-[11px] text-zinc-500 font-mono">
                    {subagents.filter((s) => s.status === "ready").length}/{subagents.length} done
                  </span>
                </div>
                <BackgroundInbox
                  items={subagents}
                  onOpenSplitView={(item) => setSelectedSubagentId(item.id)}
                />
              </div>
            )}

            {/* Single Transparent Responding Loader with AgentProgress (Stop button moved to chatbox) */}
            {isStreaming && (
              <div className="flex items-center py-1.5 px-1 bg-transparent border-0 text-zinc-300">
                <AgentProgress label={currentProgressLabel} />
              </div>
            )}

                <div ref={messagesEndRef} />
              </div>
            </div>

            {/* Composer always stays at the bottom */}
            <div className="shrink-0 bg-gradient-to-t from-zinc-950 via-zinc-950/95 to-transparent px-4 pb-6 pt-2 sm:px-6">
              <AIComposer
                disabled={isStreaming}
                isStreaming={isStreaming}
                onStop={() => {
                  setIsStreaming(false);
                  if (eventSourceRef.current) eventSourceRef.current.close();
                }}
                onSubmit={handleSendMessage}
                className="mx-auto w-full max-w-3xl"
              />
            </div>
          </div>

        {/* Right Side: Split Screen Window for Subagent Inspection */}
        {selectedSubagent && (
          <div className="flex w-1/2 min-h-0 flex-col bg-zinc-925 border-l border-zinc-850">
            {/* Breadcrumb Header */}
            <div className="flex h-12 shrink-0 items-center justify-between border-b border-zinc-850 px-4">
              <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-zinc-400">
                <span className="hover:text-zinc-200">Main Orchestrator</span>
                <ChevronRight className="h-3 w-3 text-zinc-600" />
                <span className="font-medium text-white">{selectedSubagent.title}</span>
              </nav>
              <button
                type="button"
                onClick={() => setSelectedSubagentId(null)}
                className="flex h-7 w-7 items-center justify-center rounded-md text-zinc-400 hover:bg-zinc-800 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Subagent Content Body */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              <div className="rounded-xl border border-zinc-800 bg-zinc-900/80 p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {selectedSubagent.status === "running" ? (
                      <Loader2 className="h-4 w-4 animate-spin text-blue-400" />
                    ) : selectedSubagent.status === "ready" ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                    ) : (
                      <Clock className="h-4 w-4 text-zinc-500" />
                    )}
                    <h4 className="text-sm font-semibold text-white">{selectedSubagent.title}</h4>
                  </div>
                  <span className="text-xs font-mono text-zinc-400">{selectedSubagent.time || "Active"}</span>
                </div>
                <p className="mt-2 text-xs text-zinc-400">{selectedSubagent.detail}</p>
              </div>

              {/* Subagent Streaming Output */}
              <div>
                <h5 className="mb-2 text-xs font-medium text-zinc-400">Subagent Output</h5>
                <div className="rounded-xl border border-zinc-850 bg-black/50 p-4 font-mono text-xs leading-relaxed text-zinc-300 min-h-[140px] whitespace-pre-wrap">
                  {selectedSubagent.streamText ? (
                    selectedSubagent.streamText
                  ) : (
                    <span className="text-zinc-600">Waiting for subagent thoughts and actions...</span>
                  )}
                </div>
              </div>

              {/* Step Actions History */}
              {selectedSubagent.actions && selectedSubagent.actions.length > 0 && (
                <div>
                  <h5 className="mb-2 text-xs font-medium text-zinc-400">Execution Actions</h5>
                  <div className="space-y-2">
                    {selectedSubagent.actions.map((act) => (
                      <div
                        key={act.id}
                        className="rounded-lg border border-zinc-850 bg-zinc-900/40 p-2.5 text-xs flex flex-col gap-1"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-zinc-200">{act.label}</span>
                          <span className="text-[10px] text-zinc-500 font-mono">{act.time}</span>
                        </div>
                        {act.detail && (
                          <div className="rounded bg-zinc-950 p-1.5 font-mono text-[11px] text-zinc-400 truncate">
                            {act.detail}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <ContextWindowDialog
        open={contextWindowOpen}
        onOpenChange={setContextWindowOpen}
        conversationId={activeConversationId}
        environmentId={currentEnvId}
        environmentCurrency={currentEnv?.currency ?? "INR"}
        environmentBudgetLimitMinor={currentEnv?.budgetLimitMinor ?? 1000000}
        activeModel={activeModelId}
        threadMessages={threadMessages}
        subagents={subagents}
        activeRunId={activeRunId}
      />
    </div>
  );
}
