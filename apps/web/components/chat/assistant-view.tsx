"use client";

import * as React from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { AnimatePresence } from "framer-motion";
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
  Shield,
  BookOpen,
} from "lucide-react";
import { cn } from "../../lib/utils";
import { useWorkspaceStore, workspaceStore } from "../../app/lib/workspace-store";
import { useDashboardNavigation } from "../../app/lib/navigation";
import { Button } from "../ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "../ui/sheet";
import { AIComposer, type AIComposerSubmission } from "./ai-composer";
import { SessionHistoryPanel } from "./session-history";
import { useChat } from "./chat-context";
import { ReasoningThread, type ThreadMessage, type ThreadStep } from "../ui/reasoning-thread";
import { BackgroundInbox, type BackgroundInboxItem } from "../ui/background-inbox";
import { OAuthConsentCard } from "../ui/oauth-consent-card";
import { PaymentApprovalOverlay } from "../ui/payment-approval-overlay";
import { PaymentResultCard } from "../cards/payment-result-card";
import { apiClient, getAuthHeaders } from "../../lib/api/client";
import { useAdaptiveStream } from "../../lib/adaptive-stream";
import {
  saveConversation,
  saveMessages,
  getCachedMessages,
  type CachedMessage,
} from "../../lib/chat-cache";
import { ContextWindowDialog } from "./context-window-dialog";
import { ProposedBudgetCard, type ProposedAllocationItem } from "./proposed-budget-card";
import { useAuth } from "../../app/auth-provider";

export interface AssistantViewProps {
  conversationIdFromUrl?: string;
  className?: string;
  onViewTrace?: (traceId?: string) => void;
  isIncognito?: boolean;
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
  approvalUrl?: string;
  recipient?: string;
  proposedAllocations?: ProposedAllocationItem[];
  rootBudgetMinor?: number;
}

export function AssistantView({
  conversationIdFromUrl,
  className = "",
  onViewTrace,
  isIncognito = false,
}: AssistantViewProps) {
  const router = useRouter();
  const auth = useAuth();
  const user = auth?.user;
  const store = useWorkspaceStore();
  const currentEnv = store.currentEnvironment;
  const currentEnvId = currentEnv?.id;
  const aboutAbortRef = React.useRef<AbortController | null>(null);

  // Persistent sidebar controls & conversation manager from ChatProvider
  const {
    sidebarOpen,
    setSidebarOpen,
    upsertConversation,
    setMandateOverlayOpen,
    conversations,
    activeConversationId,
    setActiveConversationId,
    selectConversation,
  } = useChat();

  // Helper to validate standard UUID format
  const isValidUuid = React.useCallback((id: unknown): id is string => {
    return (
      typeof id === "string" &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
    );
  }, []);

  const loadedConvIdRef = React.useRef<string | null>(null);
  const conversationsRef = React.useRef(conversations);
  React.useEffect(() => {
    conversationsRef.current = conversations;
  }, [conversations]);

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
  const [isProposalMinimized, setIsProposalMinimized] = React.useState(false);
  const [completedPayments, setCompletedPayments] = React.useState<
    Array<{
      id: string;
      transactionId: string;
      recipient: string;
      merchantCategory: string;
      amountMinor: number;
      currency: string;
      rail: string;
      agentName?: string;
      completedAt?: string;
    }>
  >([]);

  // Context window modal
  const [contextWindowOpen, setContextWindowOpen] = React.useState(false);
  const [activeModelId, setActiveModelId] = React.useState<string>("free/gpt-6-luna");
  const [assembledContext, setAssembledContext] = React.useState<{
    system_instruction?: string;
    system_prompt?: string;
    assembled_prompt?: string;
    operational_context?: string;
    total_characters?: number;
    estimated_tokens?: number;
    system_prompt_tokens?: number;
    assembled_prompt_tokens?: number;
    messages_count?: number;
    active_tasks_count?: number;
  } | null>(null);

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
      loadedConvIdRef.current = convId;
      setSubagents([]);
      setSelectedSubagentId(null);

      // Restore persisted pending proposal for this conversation if any
      try {
        const stored =
          typeof window !== "undefined"
            ? localStorage.getItem(`pg_pending_approval_${convId}`)
            : null;
        if (stored) {
          const parsed = JSON.parse(stored);
          if (parsed && (parsed.type === "budget_proposal" || parsed.proposedAllocations)) {
            setPendingApproval(parsed);
          } else {
            setPendingApproval(null);
          }
        } else {
          setPendingApproval(null);
        }
      } catch {
        setPendingApproval(null);
      }
      setIsProposalMinimized(false);

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
      const matchedConv = conversationsRef.current.find((c) => c.id === convId);
      let targetEnvId =
        (matchedConv && isValidUuid(matchedConv.environmentId)
          ? matchedConv.environmentId
          : null) ||
        (isValidUuid(currentEnvId) ? currentEnvId : null) ||
        store.environmentsList.find((e) => isValidUuid(e.id))?.id;

      if (!targetEnvId) {
        try {
          const envRes = await fetch(`${API_BASE}/v1/environments`, {
            headers: getAuthHeaders(),
          });
          if (envRes.ok) {
            const envData = await envRes.json();
            const found = (envData.environments || []).find((e: any) => isValidUuid(e.id));
            if (found && typeof found.id === "string") {
              targetEnvId = found.id;
              workspaceStore.switchEnvironment(found.id);
            }
          }
        } catch {
          // ignore
        }
      }

      if (targetEnvId) {
        try {
          const res = await fetch(
            `${API_BASE}/v1/environments/${targetEnvId}/conversations/${convId}/messages`,
            {
              headers: getAuthHeaders(),
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
                senderType:
                  m.role === "user" || m.sender_type === "user" || m.senderType === "user"
                    ? "user"
                    : "assistant",
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
    [currentEnvId, isValidUuid, store, scrollToBottom],
  );

  // Initial alignment on mount with conversationIdFromUrl or activeConversationId
  React.useEffect(() => {
    const targetId =
      conversationIdFromUrl && conversationIdFromUrl !== "new"
        ? conversationIdFromUrl
        : activeConversationId && activeConversationId !== "new"
          ? activeConversationId
          : null;

    if (targetId) {
      if (loadedConvIdRef.current !== targetId) {
        loadedConvIdRef.current = targetId;
        setActiveConversationId(targetId);
        loadConversation(targetId);
      }
    } else {
      if (loadedConvIdRef.current !== null) {
        loadedConvIdRef.current = null;
        activeFetchIdRef.current = null;
        setThreadMessages([]);
        setSubagents([]);
        setSelectedSubagentId(null);
        setPendingApproval(null);
        setIsProposalMinimized(false);
      }
    }
  }, []);

  // In-place navigation when activeConversationId changes without page reloads
  React.useEffect(() => {
    if (!activeConversationId || activeConversationId === "new") {
      if (loadedConvIdRef.current !== null) {
        loadedConvIdRef.current = null;
        activeFetchIdRef.current = null;
        if (eventSourceRef.current) {
          eventSourceRef.current.close();
        }
        setIsStreaming(false);
        setThreadMessages([]);
        setSubagents([]);
        setSelectedSubagentId(null);
        setPendingApproval(null);
        setIsProposalMinimized(false);
      }
      return;
    }

    if (loadedConvIdRef.current === activeConversationId) {
      return;
    }

    loadedConvIdRef.current = activeConversationId;
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }
    setIsStreaming(false);
    loadConversation(activeConversationId);
  }, [activeConversationId, loadConversation]);

  // Handle custom conversation-selected event (e.g. from sidebar clicks or history)
  React.useEffect(() => {
    const handleSelected = (e: Event) => {
      const customEvent = e as CustomEvent<{ conversationId: string | null }>;
      const targetId = customEvent.detail?.conversationId;
      if (!targetId || targetId === "new") {
        if (loadedConvIdRef.current !== null) {
          loadedConvIdRef.current = null;
          activeFetchIdRef.current = null;
          if (eventSourceRef.current) {
            eventSourceRef.current.close();
          }
          setIsStreaming(false);
          setThreadMessages([]);
          setSubagents([]);
          setSelectedSubagentId(null);
          setPendingApproval(null);
          setIsProposalMinimized(false);
        }
      } else if (targetId !== loadedConvIdRef.current) {
        loadedConvIdRef.current = targetId;
        if (eventSourceRef.current) {
          eventSourceRef.current.close();
        }
        setIsStreaming(false);
        loadConversation(targetId);
      }
    };

    window.addEventListener("payguardian:conversation-selected", handleSelected);
    return () => window.removeEventListener("payguardian:conversation-selected", handleSelected);
  }, [loadConversation]);

  // SSE Stream Connection with automatic reconnect & Last-Event-ID recovery
  const connectSSE = React.useCallback(
    (runId: string, envId?: string) => {
      const targetEnv =
        (envId && isValidUuid(envId) ? envId : null) ||
        (isValidUuid(currentEnvId) ? currentEnvId : null) ||
        store.environmentsList.find((e) => isValidUuid(e.id))?.id;

      if (!targetEnv) return;

      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }

      let tokenParam = "local-user";
      let localUserIdParam: string | undefined;
      try {
        const auth = getAuthHeaders();
        if (auth["authorization"]) {
          tokenParam = auth["authorization"].replace(/^Bearer\s+/i, "");
        } else {
          localUserIdParam = "local-user";
        }
      } catch {
        localUserIdParam = "local-user";
      }

      const lastIdParam = lastEventIdRef.current ? `&lastEventId=${lastEventIdRef.current}` : "";
      const localUserQuery = localUserIdParam
        ? `&localUserId=${encodeURIComponent(localUserIdParam)}`
        : "";
      const streamUrl = `${API_BASE}/v1/environments/${targetEnv}/runs/${runId}/stream?token=${encodeURIComponent(
        tokenParam,
      )}${localUserQuery}${lastIdParam}`;

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
        "payment.order_created",
        "context.assembled",
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
          setCurrentProgressLabel(
            `Thinking… Formulated task for ${agentKey.charAt(0).toUpperCase() + agentKey.slice(1)} specialist`,
          );
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
          setCurrentProgressLabel(
            `Thinking… ${agentKey.charAt(0).toUpperCase() + agentKey.slice(1)} specialist researching quotes`,
          );
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
                        time: new Date().toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        }),
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
        setCurrentProgressLabel(
          `Thinking… Verifying authority (${payload.tool || "gateway check"})`,
        );
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
                        ? {
                            ...a,
                            status: "done",
                            detail: JSON.stringify(payload.result || "Success"),
                          }
                        : a,
                    ),
                  }
                : s,
            ),
          );
        }
        break;
      }

      case "approval.requested": {
        setIsProposalMinimized(false);
        const apprData: PendingApprovalData = {
          id: payload.approvalId || payload.id || `appr-${Date.now()}`,
          clientName: payload.agentId ? `${payload.agentId} Agent` : "Specialist Agent",
          productName: "PayGuardian Gateway",
          action: payload.action || "action.execute",
          amountMinor: payload.amountMinor ?? payload.amount_minor ?? 0,
          currency: payload.currency || "USD",
          mandateId: payload.mandateId || payload.mandate_id || "",
          type:
            payload.type || (payload.proposedAllocations ? "budget_proposal" : "action_approval"),
          proposedAllocations: payload.proposedAllocations,
          rootBudgetMinor: payload.rootBudgetMinor || currentEnv?.budgetLimitMinor,
          approvalUrl: payload.approvalUrl || payload.approval_url,
          recipient: payload.recipient,
        };
        setPendingApproval(apprData);
        const targetId =
          activeConversationId || (conversationIdFromUrl !== "new" ? conversationIdFromUrl : null);
        if (typeof window !== "undefined" && targetId) {
          try {
            localStorage.setItem(`pg_pending_approval_${targetId}`, JSON.stringify(apprData));
          } catch {
            // ignore
          }
        }
        break;
      }

      case "payment.order_created": {
        setIsProposalMinimized(false);
        const payData: PendingApprovalData = {
          id:
            payload.actionId ||
            payload.providerOrderId ||
            payload.approvalId ||
            `appr-${Date.now()}`,
          clientName: payload.agentId ? `${payload.agentId} Specialist` : "Hotel Specialist",
          productName: "PayGuardian Gateway (PayPal Sandbox)",
          action: payload.action || "book_hotel",
          amountMinor: payload.amountMinor ?? payload.amount_minor ?? 0,
          currency: payload.currency || "USD",
          mandateId: payload.mandateId || payload.mandate_id || "",
          type: "action_approval",
          approvalUrl: payload.approvalUrl || payload.approval_url,
          recipient: payload.recipient,
        };
        setPendingApproval(payData);
        const targetId =
          activeConversationId || (conversationIdFromUrl !== "new" ? conversationIdFromUrl : null);
        if (typeof window !== "undefined" && targetId) {
          try {
            localStorage.setItem(`pg_pending_approval_${targetId}`, JSON.stringify(payData));
          } catch {
            // ignore
          }
        }
        break;
      }

      case "agent.output": {
        setCurrentProgressLabel("Thinking… Synthesizing coordinated response");
        const textChunk =
          payload.text ?? payload.output ?? payload.finalResponse ?? payload.content ?? "";
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
                return [...prev.slice(0, -1), { ...last, text: textChunk }];
              }
              // If payload is a streaming delta chunk
              if (payload.isDelta) {
                return [...prev.slice(0, -1), { ...last, text: last.text + textChunk }];
              }
              // Full text replacement
              return [...prev.slice(0, -1), { ...last, text: textChunk }];
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
            prev.map((s) => (s.id === agentKey ? { ...s, status: "ready", time: "Completed" } : s)),
          );
        }
        break;
      }

      case "context.assembled": {
        if (payload) {
          setAssembledContext(payload);
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
          const currentTargetId = loadedConvIdRef.current || activeConversationId;
          if (currentTargetId) {
            const toCache: CachedMessage[] = updated.map((m) => ({
              id: m.id,
              conversationId: currentTargetId,
              senderType: m.role === "user" ? "user" : "assistant",
              content: m.text,
              createdAt: new Date().toISOString(),
            }));
            saveMessages(currentTargetId, toCache).catch(() => {});
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
    if (!text || isStreaming) return;

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

    // 2. Standalone singleton handler for "About PayGuardian"
    if (submission.mode === "About PayGuardian") {
      setCurrentProgressLabel("Thinking… Querying PayGuardian Technical Specifications");
      setSubagents([]);
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
        const abortController = new AbortController();
        aboutAbortRef.current = abortController;

        const response = await fetch("/api/about-payguardian", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt: text,
            modelId: submission.modelId || activeModelId,
          }),
          signal: abortController.signal,
        });

        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          throw new Error(errData.error || `HTTP ${response.status}`);
        }

        if (!response.body) {
          throw new Error("No response stream available");
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder("utf-8");
        let accumulatedText = "";
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed.startsWith("data: ")) {
              const rawData = trimmed.slice(6);
              if (rawData === "[DONE]") break;
              try {
                const parsed = JSON.parse(rawData);
                if (parsed.text) {
                  accumulatedText += parsed.text;
                  const currentText = accumulatedText;
                  setThreadMessages((prev) =>
                    prev.map((m) =>
                      m.id === assistantMsgId
                        ? { ...m, text: currentText, streaming: true }
                        : m,
                    ),
                  );
                }
              } catch {
                // ignore parsing error for chunk
              }
            }
          }
        }

        setThreadMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMsgId
              ? { ...m, text: accumulatedText || "No response received.", streaming: false }
              : m,
          ),
        );
        setIsStreaming(false);
        setCurrentProgressLabel("");
        return;
      } catch (err: any) {
        if (err.name === "AbortError") {
          setIsStreaming(false);
          setCurrentProgressLabel("");
          return;
        }
        setIsStreaming(false);
        setCurrentProgressLabel("");
        setThreadMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMsgId
              ? {
                  ...m,
                  text: `PayGuardian Explainer encountered an issue: ${err.message || "Failed to reach explainer service"}. Please try again.`,
                  streaming: false,
                }
              : m,
          ),
        );
        return;
      }
    }

    // Determine target environment ID
    const matchedConv = activeConversationId
      ? conversations.find((c) => c.id === activeConversationId)
      : null;
    let effectiveEnvId =
      (matchedConv && isValidUuid(matchedConv.environmentId) ? matchedConv.environmentId : null) ||
      (isValidUuid(currentEnvId) ? currentEnvId : null) ||
      store.environmentsList.find((e) => isValidUuid(e.id))?.id;

    if (!effectiveEnvId) {
      try {
        const envRes = await fetch(`${API_BASE}/v1/environments`, {
          headers: getAuthHeaders(),
        });
        if (envRes.ok) {
          const envData = await envRes.json();
          const found = (envData.environments || []).find((e: any) => isValidUuid(e.id));
          if (found && typeof found.id === "string") {
            effectiveEnvId = found.id;
            workspaceStore.switchEnvironment(found.id);
          }
        }
      } catch {
        // ignore
      }
    }

    if (!effectiveEnvId) return;

    setCurrentProgressLabel("Thinking… Initializing Personal Agent");
    setSubagents([]);
    if (pendingApproval) {
      if (pendingApproval.type === "budget_proposal") {
        setIsProposalMinimized(true);
      } else {
        setPendingApproval(null);
      }
    }

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
        const createConvRes = await fetch(
          `${API_BASE}/v1/environments/${effectiveEnvId}/conversations`,
          {
            method: "POST",
            headers: getAuthHeaders({
              "Content-Type": "application/json",
            }),
            body: JSON.stringify({
              title: text.slice(0, 36) + (text.length > 36 ? "..." : ""),
              metadata: { model: submission.modelId, mode: submission.mode },
            }),
          },
        );

        if (createConvRes.ok) {
          const convData = await createConvRes.json();
          convId = convData.conversation.id;
          loadedConvIdRef.current = convId;
          activeFetchIdRef.current = convId;
          setActiveConversationId(convId);
          if (typeof window !== "undefined") {
            window.history.replaceState(null, "", `/chat/${convId}`);
            if (pendingApproval) {
              try {
                localStorage.setItem(
                  `pg_pending_approval_${convId}`,
                  JSON.stringify(pendingApproval),
                );
              } catch {
                // ignore
              }
            }
          }
          await upsertConversation({
            id: convId!,
            environmentId: effectiveEnvId,
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
        `${API_BASE}/v1/environments/${effectiveEnvId}/conversations/${convId}/messages`,
        {
          method: "POST",
          headers: getAuthHeaders({
            "Content-Type": "application/json",
          }),
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
        connectSSE(result.runId, effectiveEnvId);
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

  // Proposal authorization handlers (shared across expanded and minimized views)
  const handleApproveProposal = React.useCallback(async () => {
    if (!pendingApproval) {
      return { ok: false, message: "No active approval proposal." };
    }
    const matchedConv = activeConversationId
      ? conversations.find((c) => c.id === activeConversationId)
      : null;
    const targetEnvId =
      (matchedConv && isValidUuid(matchedConv.environmentId) ? matchedConv.environmentId : null) ||
      (isValidUuid(currentEnvId) ? currentEnvId : null) ||
      store.environmentsList.find((e) => isValidUuid(e.id))?.id;

    if (!targetEnvId) {
      return { ok: false, message: "No active environment selected." };
    }
    const approvalId = pendingApproval.id;
    try {
      const res = await fetch(
        `${API_BASE}/v1/environments/${targetEnvId}/approvals/${approvalId}/approve`,
        {
          method: "POST",
          headers: getAuthHeaders({
            "Content-Type": "application/json",
          }),
          body: JSON.stringify({
            mandateId: pendingApproval.mandateId,
            currency: pendingApproval.currency,
            proposedAllocations: pendingApproval.proposedAllocations,
          }),
        },
      );

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        const reason =
          errData.failures?.[0]?.reason ||
          errData.message ||
          errData.code ||
          `Gateway error HTTP ${res.status}`;
        return { ok: false, message: `Authority check failed: ${reason}` };
      }

      const data = await res.json();
      if (data.status === "FAILED") {
        const reason =
          data.failures?.[0]?.reason || "Authority rejected delegation for requested agents.";
        return { ok: false, message: `Delegation rejected: ${reason}` };
      }

      // Success confirmed by Gateway
      setPendingApproval(null);
      setIsProposalMinimized(false);
      const targetId =
        activeConversationId || (conversationIdFromUrl !== "new" ? conversationIdFromUrl : null);
      if (typeof window !== "undefined" && targetId) {
        try {
          localStorage.removeItem(`pg_pending_approval_${targetId}`);
        } catch {}
      }

      const formatCur = (minor: number, cur: string) => {
        const val = (minor / 100).toLocaleString("en-US", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        });
        if (cur === "INR") return `₹${val}`;
        if (cur === "EUR") return `€${val}`;
        if (cur === "GBP") return `£${val}`;
        return `$${val}`;
      };

      const delegationsList = (data.delegations || [])
        .map(
          (d: any) =>
            `- **${d.agent.toUpperCase()}**: ${formatCur(d.amountMinor, d.currency)} (Child Mandate \`${d.mandateId}\`${d.parentAgent ? ` under ${d.parentAgent}` : ""})`,
        )
        .join("\n");

      const confirmedMsg =
        `### 🛡️ Cryptographic Child Mandates Authorized\n\n` +
        `The PayGuardian Gateway has verified root spending authority and issued ${data.delegations?.length || 0} child mandates in the ledger:\n\n` +
        `${delegationsList}\n\n` +
        `**Approval Status**: \`${data.status}\`\n` +
        `**Total Delegated**: ${formatCur(data.totalDelegatedMinor, data.currency || pendingApproval.currency)}\n` +
        `**Remaining Buffer**: ${formatCur(data.remainingReserveMinor, data.currency || pendingApproval.currency)}\n\n` +
        `Specialists are now active with their respective spending envelopes.`;

      const assistantMsg: ThreadMessage = {
        id: `asst-auth-${Date.now()}`,
        role: "assistant",
        text: confirmedMsg,
      };
      setThreadMessages((prev) => [...prev, assistantMsg]);
      return { ok: true, status: data.status };
    } catch (err: any) {
      return { ok: false, message: err?.message || "Network error while connecting to Gateway." };
    }
  }, [
    activeConversationId,
    conversationIdFromUrl,
    conversations,
    currentEnvId,
    isValidUuid,
    pendingApproval,
    store,
  ]);

  const handleDenyProposal = React.useCallback(async () => {
    if (!pendingApproval) return;
    const approvalId = pendingApproval.id;
    const matchedConv = activeConversationId
      ? conversations.find((c) => c.id === activeConversationId)
      : null;
    const targetEnvId =
      (matchedConv && isValidUuid(matchedConv.environmentId) ? matchedConv.environmentId : null) ||
      (isValidUuid(currentEnvId) ? currentEnvId : null) ||
      store.environmentsList.find((e) => isValidUuid(e.id))?.id;

    if (targetEnvId && approvalId) {
      try {
        await fetch(`${API_BASE}/v1/environments/${targetEnvId}/approvals/${approvalId}/reject`, {
          method: "POST",
          headers: getAuthHeaders({
            "Content-Type": "application/json",
          }),
          body: JSON.stringify({
            reason: "User rejected proposed budget allocation in UI.",
          }),
        });
      } catch {
        // Best effort backend audit record
      }
    }
    setPendingApproval(null);
    setIsProposalMinimized(false);
    const targetId =
      activeConversationId || (conversationIdFromUrl !== "new" ? conversationIdFromUrl : null);
    if (typeof window !== "undefined" && targetId) {
      try {
        localStorage.removeItem(`pg_pending_approval_${targetId}`);
      } catch {}
    }
    const deniedMsg: ThreadMessage = {
      id: `asst-deny-${Date.now()}`,
      role: "assistant",
      text: "Understood. The proposed budget allocation has been rejected. No funds or cryptographic child mandates were issued.",
    };
    setThreadMessages((prev) => [...prev, deniedMsg]);
  }, [
    activeConversationId,
    conversationIdFromUrl,
    conversations,
    currentEnvId,
    isValidUuid,
    pendingApproval,
    store,
  ]);

  const selectedSubagent = subagents.find((s) => s.id === selectedSubagentId);

  return (
    <div
      className={`relative flex min-w-0 flex-1 flex-col h-full overflow-hidden bg-zinc-950 ${className}`}
    >
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
            onClick={() => router.push(isIncognito ? "/" : "/dashboard")}
            className="flex items-center gap-1.5 text-xs font-medium text-zinc-400 hover:text-white transition-colors px-1 py-1"
            title={isIncognito ? "Return to Landing Page" : "Return to Dashboard"}
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>{isIncognito ? "Home" : "Dashboard"}</span>
          </button>

          <div className="h-4 w-px bg-zinc-800 mx-1" />

          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold tracking-tight text-white">
              {isIncognito ? "PayGuardian Main Agent" : "Main Agent Chat"}
            </span>
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-[10px] font-medium border",
                isIncognito
                  ? "bg-blue-500/10 text-blue-400 border-blue-500/20"
                  : "bg-zinc-900 text-zinc-400 border-zinc-800",
              )}
            >
              {isIncognito ? "Incognito Explainer" : "LangGraph Personal"}
            </span>
          </div>
        </div>

        {/* Right side controls */}
        <div className="flex items-center gap-2">
          {isIncognito ? (
            <button
              type="button"
              onClick={() => router.push("/login")}
              className="flex items-center gap-1.5 text-xs font-medium text-zinc-200 hover:text-white transition-colors px-3 py-1.5 rounded-lg border border-zinc-800 bg-zinc-900 hover:bg-zinc-800"
            >
              Sign In
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setContextWindowOpen(true)}
              title="View Chat Context Window"
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors px-2.5 py-1.5 rounded-md border border-border bg-background shadow-sm"
            >
              <BookOpen className="h-3.5 w-3.5" />
              <span>Context Window</span>
            </button>
          )}
        </div>
      </div>

      {/* Main chat layout with optional split-screen for subagent inspection */}
      <div className="relative flex flex-1 min-h-0 divide-x divide-zinc-900 overflow-hidden">
        {/* Left Side: Main Agent Chat Thread */}
        <div className="relative flex h-full min-h-0 flex-1 flex-col overflow-hidden">
          {/* Minimized Proposal Floating Pill in Top Right of Chat Thread */}
          <AnimatePresence>
            {pendingApproval &&
              isProposalMinimized &&
              pendingApproval.type === "budget_proposal" && (
                <div
                  key="minimized-proposal-pill"
                  className="absolute top-3 right-4 z-30 pointer-events-auto"
                >
                  <ProposedBudgetCard
                    id={pendingApproval.id}
                    mandateId={pendingApproval.mandateId}
                    currency={pendingApproval.currency}
                    rootBudgetMinor={
                      pendingApproval.rootBudgetMinor ?? currentEnv?.budgetLimitMinor ?? 1000000
                    }
                    totalProposedMinor={pendingApproval.amountMinor}
                    allocations={pendingApproval.proposedAllocations || []}
                    isMinimized={true}
                    onToggleMinimize={() => setIsProposalMinimized(false)}
                    onApprove={handleApproveProposal}
                    onDeny={handleDenyProposal}
                  />
                </div>
              )}
          </AnimatePresence>

          {/* Only messages should scroll */}
          <div
            ref={messagesContainerRef}
            onScroll={handleContainerScroll}
            className="flex-1 min-h-0 overflow-y-auto"
          >
            <div
              className={cn(
                "mx-auto flex w-full max-w-3xl flex-col px-4 pt-6 pb-6 sm:px-6",
                threadMessages.length === 0
                  ? "flex-1 min-h-[calc(100vh-230px)] items-center justify-center"
                  : "space-y-6",
              )}
            >
              {threadMessages.length === 0 ? (
                <div className="flex flex-col items-center justify-center text-center max-w-md my-auto py-8">
                  <div className="mb-5 flex size-14 items-center justify-center rounded-2xl border border-white/10 bg-zinc-900 shadow-xl shadow-black/50 ring-1 ring-[#D0785A]/20">
                    <Image
                      src="/payguardian.svg"
                      alt="PayGuardian Logo"
                      width={32}
                      height={30}
                      className="size-7 object-contain shrink-0"
                      priority
                    />
                  </div>
                  <h2 className="text-2xl sm:text-[28px] font-semibold tracking-[-0.02em] text-white">
                    {isIncognito ? "Ask PayGuardian Agent" : "Delegate with total control"}
                  </h2>
                  <p className="mt-2.5 max-w-sm text-sm leading-relaxed text-zinc-400">
                    {isIncognito
                      ? "Inquire about PayGuardian's architecture, cryptographic DAG mandates, integer accounting invariants, and payment settlement rails."
                      : "Plan tasks, consult models, and safely delegate spending to autonomous subagents under cryptographic budget mandates."}
                  </p>
                  {isIncognito && (
                    <div className="mt-6 flex flex-wrap justify-center gap-2 max-w-md">
                      {[
                        "How does PayGuardian enforce the DAG depth ≤ 2 invariant?",
                        "How does integer accounting prevent floating-point loss?",
                        "Explain the two-phase PayPal Sandbox settlement flow",
                      ].map((promptSuggestion) => (
                        <button
                          key={promptSuggestion}
                          type="button"
                          onClick={() => {
                            handleSendMessage({
                              prompt: promptSuggestion,
                              mode: "About PayGuardian",
                              modelId: activeModelId,
                              modelName: "APInex GPT-6 Luna",
                              effort: "Medium",
                              autoMode: false,
                              attachedFiles: [],
                              files: [],
                            });
                          }}
                          className="rounded-full border border-zinc-800 bg-zinc-900/80 px-3.5 py-1.5 text-xs text-zinc-300 transition-colors hover:border-zinc-700 hover:bg-zinc-800 hover:text-white cursor-pointer"
                        >
                          {promptSuggestion}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <ReasoningThread
                  messages={threadMessages}
                  isStreaming={isStreaming}
                  progressLabel={currentProgressLabel}
                  className="w-full max-w-full"
                />
              )}

              {/* Settled Completed Payments */}
              {completedPayments.map((p) => (
                <div key={p.id} className="pt-2">
                  <PaymentResultCard
                    id={p.id}
                    transactionId={p.transactionId}
                    recipient={p.recipient}
                    merchantCategory={p.merchantCategory}
                    amountMinor={p.amountMinor}
                    currency={p.currency}
                    rail={p.rail}
                    currentStage="completed"
                    agentName={p.agentName}
                    completedAt={p.completedAt}
                    onViewTrace={onViewTrace}
                    className="mb-4"
                  />
                </div>
              ))}

              {/* Pending Approval / Proposed Budget Allocation Component */}
              {pendingApproval && (
                <div className="pt-2">
                  {pendingApproval.type === "budget_proposal" &&
                  pendingApproval.proposedAllocations &&
                  pendingApproval.proposedAllocations.length > 0 ? (
                    !isProposalMinimized && (
                      <ProposedBudgetCard
                        id={pendingApproval.id}
                        mandateId={pendingApproval.mandateId}
                        currency={pendingApproval.currency}
                        rootBudgetMinor={
                          pendingApproval.rootBudgetMinor ?? currentEnv?.budgetLimitMinor ?? 1000000
                        }
                        totalProposedMinor={pendingApproval.amountMinor}
                        allocations={pendingApproval.proposedAllocations}
                        isMinimized={false}
                        onToggleMinimize={() => setIsProposalMinimized(true)}
                        onApprove={handleApproveProposal}
                        onDeny={handleDenyProposal}
                      />
                    )
                  ) : (
                    <>
                      <PaymentResultCard
                        id={pendingApproval.id}
                        transactionId={pendingApproval.id}
                        recipient={pendingApproval.recipient || "Hotel Merchant / Vendor"}
                        merchantCategory="Lodging & Accommodations"
                        amountMinor={pendingApproval.amountMinor}
                        currency={pendingApproval.currency}
                        rail="PayPal Sandbox"
                        currentStage="sent_to_provider"
                        agentName={pendingApproval.clientName}
                        approvalUrl={pendingApproval.approvalUrl}
                        onViewTrace={onViewTrace}
                        className="mb-4"
                      />
                      <PaymentApprovalOverlay
                        isOpen={!isProposalMinimized}
                        environmentId={
                          (isValidUuid(currentEnv?.id) ? currentEnv?.id : null) ||
                          store.environmentsList.find((e) => isValidUuid(e.id))?.id
                        }
                        approvalId={pendingApproval.id}
                        actionId={pendingApproval.id}
                        clientName={pendingApproval.clientName}
                        productName={pendingApproval.productName || "PayGuardian Gateway"}
                        action={pendingApproval.action}
                        amountMinor={pendingApproval.amountMinor}
                        currency={pendingApproval.currency}
                        recipient={pendingApproval.recipient || "Hotel Merchant / Vendor"}
                        mandateId={pendingApproval.mandateId}
                        approvalUrl={pendingApproval.approvalUrl}
                        redirectUri="PayGuardian Gateway (PayPal Sandbox)"
                        email="operator@payguardian.local"
                        onClose={() => setIsProposalMinimized(true)}
                        onApprove={async (captureResult?: any) => {
                          const envId =
                            (isValidUuid(currentEnv?.id) ? currentEnv?.id : null) ||
                            store.environmentsList.find((e) => isValidUuid(e.id))?.id;

                          if (captureResult) {
                            const orderId =
                              captureResult.orderId || captureResult.order?.id || "N/A";
                            const captureId =
                              captureResult.captureId || captureResult.transactionId || "N/A";
                            const amt = ((pendingApproval.amountMinor || 15000) / 100).toFixed(2);
                            const curr = pendingApproval.currency || "USD";

                            setCompletedPayments((prev) => [
                              ...prev,
                              {
                                id: pendingApproval.id,
                                transactionId: captureId !== "N/A" ? captureId : orderId,
                                recipient: pendingApproval.recipient || "Hotel Merchant / Vendor",
                                merchantCategory: "Lodging & Accommodations",
                                amountMinor: pendingApproval.amountMinor || 15000,
                                currency: curr,
                                rail: "PayPal Sandbox",
                                agentName: pendingApproval.clientName,
                                completedAt: new Date().toISOString(),
                              },
                            ]);

                            const successMsg: ThreadMessage = {
                              id: `asst-pp-capture-${Date.now()}`,
                              role: "assistant",
                              text:
                                `### 🛡️ Payment Authorized & Settled via PayPal Sandbox\n\n` +
                                `The delegated payment has been authorized and captured directly through PayPal Sandbox.\n\n` +
                                `- **Order ID**: \`${orderId}\`\n` +
                                `- **Capture ID**: \`${captureId}\`\n` +
                                `- **Amount**: \`$${amt} ${curr}\`\n` +
                                `- **Recipient**: ${pendingApproval.recipient || "Hotel Merchant / Vendor"}\n` +
                                `- **Status**: **COMPLETED & Settled in Ledger**\n\n` +
                                `The cryptographic child mandate ledger entry is settled and policy invariants are verified.`,
                              steps: [],
                            };
                            setThreadMessages((prev) => [...prev, successMsg]);
                            setPendingApproval(null);
                            return;
                          }

                          let appUrl =
                            pendingApproval.approvalUrl &&
                            !pendingApproval.approvalUrl.includes("ORDER-") &&
                            !pendingApproval.approvalUrl.includes("simulated") &&
                            (pendingApproval.approvalUrl.startsWith(
                              "https://www.sandbox.paypal.com",
                            ) ||
                              pendingApproval.approvalUrl.startsWith("https://www.paypal.com"))
                              ? pendingApproval.approvalUrl
                              : null;

                          // If not already present, create a live PayPal Sandbox checkout order on the Gateway
                          if (!appUrl && envId) {
                            try {
                              const res = await apiClient.payments.createPayPalOrder(envId, {
                                agentId: pendingApproval.clientName?.toLowerCase().includes("hotel")
                                  ? "hotel"
                                  : "travel",
                                mandateId: pendingApproval.mandateId,
                                ledgerAccountId: `acc_${pendingApproval.mandateId}`,
                                idempotencyKey: `pp_ord_${Date.now()}`,
                                requestHash: `req_${Date.now()}`,
                                action: pendingApproval.action || "book_hotel",
                                amountMinor: pendingApproval.amountMinor || 15000,
                                currency: "USD",
                                approvalId: pendingApproval.id,
                                returnUrl:
                                  typeof window !== "undefined"
                                    ? `${window.location.origin}/paypal/return`
                                    : undefined,
                                cancelUrl:
                                  typeof window !== "undefined"
                                    ? `${window.location.origin}/paypal/cancel`
                                    : undefined,
                              });
                              const liveUrl =
                                (res as any)?.order?.approvalUrl || (res as any)?.approveUrl;
                              if (liveUrl && !liveUrl.includes("ORDER-")) {
                                appUrl = liveUrl;
                              }
                            } catch (orderErr) {
                              console.warn(
                                "Failed creating live PayPal order on approve:",
                                orderErr,
                              );
                            }
                          }

                          // Sync approval confirmation to Gateway approval store
                          if (envId && pendingApproval.id) {
                            try {
                              await apiClient.approvals.approve(envId, pendingApproval.id);
                            } catch (apprErr) {
                              console.warn("Failed syncing approval to Gateway:", apprErr);
                            }
                          }

                          setPendingApproval(null);

                          // If a live PayPal URL is available, navigate directly to PayPal checkout
                          if (appUrl && typeof window !== "undefined") {
                            const popup = window.open(appUrl, "_blank", "noopener,noreferrer");
                            if (!popup || popup.closed || typeof popup.closed === "undefined") {
                              window.location.href = appUrl;
                            }
                            return;
                          }

                          // Fallback if PayPal API is unreachable: navigate to PayGuardian's return status page
                          if (envId && typeof window !== "undefined") {
                            window.location.href = `/paypal/return?environment_id=${encodeURIComponent(envId)}&action_id=${encodeURIComponent(pendingApproval.id)}`;
                          }
                        }}
                        onDeny={async () => {
                          setPendingApproval(null);
                          await handleSendMessage({
                            prompt: "I deny the payment request.",
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
                    </>
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

              <div ref={messagesEndRef} />
            </div>
          </div>

          {/* Composer always stays at the bottom */}
          <div className="shrink-0 bg-gradient-to-t from-zinc-950 via-zinc-950/95 to-transparent px-4 pb-6 pt-2 sm:px-6">
            <AIComposer
              disabled={isStreaming}
              isStreaming={isStreaming}
              isIncognito={isIncognito}
              isAuthenticated={Boolean(user)}
              initialMode={isIncognito ? "About PayGuardian" : undefined}
              onStop={() => {
                setIsStreaming(false);
                if (eventSourceRef.current) eventSourceRef.current.close();
                if (aboutAbortRef.current) aboutAbortRef.current.abort();
              }}
              onSubmit={handleSendMessage}
              className="mx-auto w-full max-w-3xl"
            />
          </div>
        </div>

        {/* Right Side: Split Screen Window for Subagent Inspection */}
        {selectedSubagent && !isIncognito && (
          <div className="flex w-1/2 min-h-0 flex-col bg-zinc-925 border-l border-zinc-850">
            {/* Breadcrumb Header */}
            <div className="flex h-12 shrink-0 items-center justify-between border-b border-zinc-850 px-4">
              <nav
                aria-label="Breadcrumb"
                className="flex items-center gap-1.5 text-xs text-zinc-400"
              >
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
                      <Loader2 className="h-4 w-4 animate-spin text-[#D0785A]" />
                    ) : selectedSubagent.status === "ready" ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                    ) : (
                      <Clock className="h-4 w-4 text-zinc-500" />
                    )}
                    <h4 className="text-sm font-semibold text-white">{selectedSubagent.title}</h4>
                  </div>
                  <span className="text-xs font-mono text-zinc-400">
                    {selectedSubagent.time || "Active"}
                  </span>
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
                    <span className="text-zinc-600">
                      Waiting for subagent thoughts and actions...
                    </span>
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
        environmentId={
          (activeConversationId &&
            conversations.find((c) => c.id === activeConversationId)?.environmentId) ||
          (isValidUuid(currentEnvId) ? currentEnvId : undefined) ||
          store.environmentsList.find((e) => isValidUuid(e.id))?.id
        }
        environmentCurrency={currentEnv?.currency ?? "INR"}
        environmentBudgetLimitMinor={currentEnv?.budgetLimitMinor ?? 1000000}
        activeModel={activeModelId}
        threadMessages={threadMessages}
        subagents={subagents}
        activeRunId={activeRunId}
        assembledContext={assembledContext}
      />
    </div>
  );
}
