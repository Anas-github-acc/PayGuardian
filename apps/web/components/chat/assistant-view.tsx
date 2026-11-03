"use client";

import * as React from "react";
import {
  AlertTriangle,
  Brain,
  CreditCard,
  History,
  Hotel,
  Info,
  Square,
  Sparkles,
  Wallet,
} from "lucide-react";
import { useWorkspaceStore, workspaceStore, type ChatMessage } from "../../app/lib/workspace-store";
import { useDashboardNavigation } from "../../app/lib/navigation";
import { AgentSays } from "./agent-says";
import { VerifiedBlock } from "./verified-block";
import { Button } from "../ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "../ui/sheet";
import { AIComposer, type AIComposerSubmission } from "./ai-composer";
import { SessionHistoryPanel } from "./session-history";

export interface AssistantViewProps {
  className?: string;
  onViewTrace?: (traceId?: string) => void;
}

const MAIN_AGENT = { id: "orchestrator-root", name: "Main Orchestrator", role: "Root Coordinator" };

const SUGGESTIONS = [
  {
    icon: Wallet,
    label: "Allocate budget across my travel agents",
    prompt: "Allocate $4,000 to Travel & Hotel agents",
  },
  {
    icon: CreditCard,
    label: "Pay $245 for an IndiGo flight via PayPal",
    prompt: "Pay $245.00 for IndiGo flight via PayPal",
  },
  {
    icon: Hotel,
    label: "Book a luxury suite (test rejection)",
    prompt: "Book luxury suite for $5,000.00 (Test Rejection)",
  },
  {
    icon: Brain,
    label: "Remember my vegetarian meal preference",
    prompt: "Remember vegetarian meal preference",
  },
];

export function AssistantView({ className = "", onViewTrace }: AssistantViewProps) {
  const store = useWorkspaceStore();
  const { navigateTab } = useDashboardNavigation();
  const [isStreaming, setIsStreaming] = React.useState(false);
  const messagesEndRef = React.useRef<HTMLDivElement>(null);

  // Sessions sheet
  const [sessionsOpen, setSessionsOpen] = React.useState(false);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  React.useEffect(() => {
    scrollToBottom();
  }, [store.chatMessages, isStreaming]);

  const handleSendMessage = (textToSend?: string, modelId?: string) => {
    const text = (textToSend ?? "").trim();
    if (!text || isStreaming) return;

    // 1. Append User Message
    const userMsg: ChatMessage = {
      type: "agent_says",
      id: `usr-msg-${Date.now()}`,
      sender: "You",
      timestamp: new Date().toISOString(),
      text,
      // The send flow is local simulation (no API call); the chosen model rides on the message payload.
      payload: { model: modelId ?? "gemini-2.5-pro" },
    };
    workspaceStore.addChatMessage(userMsg);

    // 2. Simulate streaming agent response
    setIsStreaming(true);
    const lower = text.toLowerCase();

    setTimeout(() => {
      setIsStreaming(false);

      if (lower.includes("allocate") || lower.includes("budget") || lower.includes("plan")) {
        workspaceStore.addChatMessage({
          type: "agent_says",
          id: `ag-msg-${Date.now()}`,
          sender: MAIN_AGENT.name,
          timestamp: new Date().toISOString(),
          text: "I have prepared a proposed budget allocation plan compliant with parent mandate rules. Please review the cryptographic authorization plan below:",
        });

        const nowIso = new Date().toISOString();
        workspaceStore.addChatMessage({
          type: "verified_block",
          id: `v-plan-${Date.now()}`,
          cardType: "budget_plan",
          sender: "Gateway Policy Engine",
          timestamp: nowIso,
          verifiedAt: nowIso,
          payload: {
            title: "Subagent Capital Distribution Plan",
            parentMandateId: "man-root-9081",
            totalRequestedMinor: 1000000,
            currency: store.currentEnvironment?.currency ?? "USD",
            status: "pending",
            subAllocations: [
              { agentId: "agent-travel", agentName: "Travel Subagent", role: "Logistics", amountMinor: 400000 },
              { agentId: "agent-hotel", agentName: "Hotel Subagent", role: "Hospitality", amountMinor: 400000 },
              { agentId: "agent-reserve", agentName: "Unallocated Reserve", role: "Contingency", amountMinor: 200000 },
            ],
            policyNotes: "Total sum matches root mandate budget ($10,000.00). Max depth ≤ 2.",
          },
        });
      } else if (lower.includes("pay") || lower.includes("flight") || lower.includes("indigo")) {
        workspaceStore.addChatMessage({
          type: "agent_says",
          id: `ag-msg-${Date.now()}`,
          sender: MAIN_AGENT.name,
          timestamp: new Date().toISOString(),
          text: "Executing payment for IndiGo Airlines flight 6E-204 to Goa via PayPal rail. Policy verification checks passed.",
        });

        const nowIso = new Date().toISOString();
        workspaceStore.addChatMessage({
          type: "verified_block",
          id: `v-pay-${Date.now()}`,
          cardType: "payment_result",
          sender: "PayGuardian PayPal Rail Gateway",
          timestamp: nowIso,
          verifiedAt: nowIso,
          payload: {
            transactionId: `txn_pp_${Math.floor(100000000 + Math.random() * 900000000)}`,
            recipient: "IndiGo Airlines Ltd",
            merchantCategory: "Airlines & Air Travel",
            amountMinor: 24500,
            currency: store.currentEnvironment?.currency ?? "USD",
            rail: "PayPal",
            authHash: "0x89f41b2a7e93c07d391ef41908bc21",
            currentStage: "completed",
            agentName: MAIN_AGENT.name,
          },
        });
      } else if (
        lower.includes("hotel") ||
        lower.includes("suite") ||
        lower.includes("5000") ||
        lower.includes("reject")
      ) {
        workspaceStore.addChatMessage({
          type: "agent_says",
          id: `ag-msg-${Date.now()}`,
          sender: MAIN_AGENT.name,
          timestamp: new Date().toISOString(),
          text: "Attempted to confirm booking at Grand Hyatt Goa for $5,000.00. The transaction was refused by the Gateway Policy Engine.",
        });

        const nowIso = new Date().toISOString();
        workspaceStore.addChatMessage({
          type: "verified_block",
          id: `v-rej-${Date.now()}`,
          cardType: "rejection",
          sender: "Gateway Policy Engine",
          timestamp: nowIso,
          verifiedAt: nowIso,
          payload: {
            reasonCode: "BUDGET_EXCEEDED",
            agentName: MAIN_AGENT.name,
            attemptedAmountMinor: 500000,
            currency: store.currentEnvironment?.currency ?? "USD",
            attemptedMerchant: "Grand Hyatt Goa Luxury Villas",
            ruleReference: "Rule #POL-8820 (Max Sub-Allocation)",
            explanation: "Main Orchestrator requested $5,000.00, but its authorized sub-mandate limit is $4,000.00 (with $2,800.00 remaining).",
            checksFailed: [
              "Remaining sub-mandate balance: FAILED (Available: $2,800.00 < Requested: $5,000.00)",
              "Single transaction autonomous threshold: FAILED ($5,000.00 > $500.00)",
              "Merchant category check: PASSED",
            ],
          },
        });
      } else if (lower.includes("remember") || lower.includes("vegetarian") || lower.includes("preference")) {
        workspaceStore.addChatMessage({
          type: "agent_says",
          id: `ag-msg-${Date.now()}`,
          sender: MAIN_AGENT.name,
          timestamp: new Date().toISOString(),
          text: "I have committed this preference to durable environment memory. Notice that memory stores factual context only and does not expand financial spending authority.",
        });

        const nowIso = new Date().toISOString();
        workspaceStore.addChatMessage({
          type: "verified_block",
          id: `v-mem-${Date.now()}`,
          cardType: "memory",
          sender: "PayGuardian Memory Vault",
          timestamp: nowIso,
          verifiedAt: nowIso,
          payload: {
            category: "environment",
            keyName: "dietary_preference",
            value: "Vegetarian meals only for all airline bookings; seat 3A or window preference",
            contextSnippet: text,
            agentName: MAIN_AGENT.name,
          },
        });
      } else {
        workspaceStore.addChatMessage({
          type: "agent_says",
          id: `ag-msg-${Date.now()}`,
          sender: MAIN_AGENT.name,
          timestamp: new Date().toISOString(),
          text: `Understood. I am monitoring the "${store.currentEnvironment?.name ?? "Travel & Hospitality"}" environment. Current budget: $10,000.00 total limit with $6,050.00 available. All actions are verified by PayGuardian before execution.`,
        });
      }
    }, 900);
  };

  const handleStopStreaming = () => setIsStreaming(false);

  const handleComposerSubmit = (submission: AIComposerSubmission) => {
    handleSendMessage(submission.prompt, submission.modelId);
  };

  const hasPendingApprovals = (store.currentEnvironment?.pendingApprovalsCount ?? 0) > 0;
  const hasMessages = store.chatMessages.length > 0;

  return (
    <div className={`relative flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-black text-white ${className}`}>
      {/* 1. Sticky Alert at top */}
      {hasPendingApprovals && (
        <div className="shrink-0 z-30 border-b border-amber-900/40 bg-amber-950/20 px-4 py-2.5 text-xs text-amber-400 sm:px-6">
          <div className="flex items-center justify-center gap-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              <span className="font-medium">An agent is blocked, waiting for your approval.</span>
            </div>
            <button
              type="button"
              onClick={() => navigateTab("approvals")}
              className="rounded-md border border-amber-900/60 bg-amber-950/60 px-2.5 py-0.5 font-medium text-amber-300 hover:bg-amber-900/40 transition-colors"
            >
              Review
            </button>
          </div>
        </div>
      )}

      {/* 2. Chat body area with pinned session icon and scrollable message stream */}
      <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
        {/* Sticky top-right session management icon */}
        <div className="absolute top-4 right-4 z-20 sm:top-5 sm:right-6 pointer-events-auto">
          <Sheet open={sessionsOpen} onOpenChange={setSessionsOpen}>
            <button
              type="button"
              onClick={() => setSessionsOpen(true)}
              title="Manage sessions"
              aria-label="Manage sessions"
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900/90 text-zinc-400 hover:text-white hover:bg-zinc-800 hover:border-zinc-700 transition-colors shadow-sm"
            >
              <History className="h-4 w-4" />
            </button>

            <SheetContent side="right" className="bg-zinc-950 border-l border-zinc-800 text-zinc-100 p-6 sm:max-w-sm">
              <SheetHeader className="pb-3 border-b border-zinc-800/60">
                <SheetTitle className="text-zinc-100 text-sm font-semibold tracking-tight">Sessions</SheetTitle>
                <SheetDescription className="text-zinc-400 text-xs">Switch context or start a fresh thread.</SheetDescription>
              </SheetHeader>
              <SessionHistoryPanel onClose={() => setSessionsOpen(false)} />
            </SheetContent>
          </Sheet>
        </div>

        {/* 3. ONLY THE CHAT PART IS VERTICAL SCROLLABLE */}
        <div className="flex-1 min-h-0 overflow-y-auto">
          <div className="mx-auto flex min-h-full w-full max-w-4xl flex-col px-4 py-6 sm:px-6">
            {/* GAP-SESS-01 notice: Session history persistence missing on gateway */}
            <div className="mb-4 mx-auto max-w-xl w-full rounded-md border border-zinc-800 bg-zinc-900/60 p-2.5 text-[11px] text-zinc-400 flex items-center gap-2">
              <Info className="h-3.5 w-3.5 text-amber-400 shrink-0" />
              <span>
                Session history persistence unavailable on gateway; starting new thread (
                <span className="font-mono text-zinc-300">GAP-SESS-01</span>).
              </span>
            </div>
            {!hasMessages ? (
              <div className="my-auto flex flex-col items-center justify-center py-16 text-center">
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl border border-zinc-800 bg-zinc-950 text-white shadow-sm">
                  <Sparkles className="h-5 w-5 text-blue-400" />
                </div>
                <h2 className="text-xl font-semibold tracking-tight text-white">What can I help with?</h2>
                <p className="mt-1.5 max-w-sm text-xs leading-relaxed text-zinc-400">
                  Talk to your main orchestrator. Everything that spends money is verified by the
                  PayGuardian gateway before execution.
                </p>
              </div>
            ) : (
              <div className="mt-auto space-y-4">
                {store.chatMessages.map((msg) =>
                  msg.type === "agent_says" ? (
                    <AgentSays
                      key={msg.id}
                      message={{
                        type: "agent_says",
                        id: msg.id,
                        sender: msg.sender ?? "Agent",
                        timestamp: msg.timestamp,
                        text: msg.text ?? "",
                      }}
                    />
                  ) : (
                    <VerifiedBlock
                      key={msg.id}
                      message={{
                        type: "verified_block",
                        id: msg.id,
                        cardType: msg.cardType ?? "budget_plan",
                        payload: msg.payload ?? {},
                        verifiedAt: msg.verifiedAt ?? msg.timestamp,
                        gatewaySignature: msg.gatewaySignature,
                        sender: msg.sender,
                      }}
                      onViewTrace={onViewTrace}
                      onApproveBudget={() => {
                        workspaceStore.addChatMessage({
                          type: "agent_says",
                          id: `ag-app-${Date.now()}`,
                          sender: MAIN_AGENT.name,
                          timestamp: new Date().toISOString(),
                          text: "Budget allocation plan cryptographically signed and confirmed by human operator. Authority delegated.",
                        });
                      }}
                    />
                  )
                )}

                {/* Streaming typing indicator */}
                {isStreaming && (
                  <div className="flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs text-zinc-400">
                    <span className="flex gap-1">
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-blue-500" />
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-blue-500 delay-75" />
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-blue-500 delay-150" />
                    </span>
                    <span className="text-[11px] text-zinc-300 font-mono">{MAIN_AGENT.name} is drafting a response…</span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleStopStreaming}
                      className="ml-auto h-6 px-2 text-[10px] border-zinc-800 bg-zinc-900 text-red-400 hover:bg-zinc-800 hover:text-red-300"
                    >
                      <Square className="mr-1 h-2.5 w-2.5 fill-current" />
                      Stop
                    </Button>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            )}

            {/* Suggestion cards (only on empty state, above composer) */}
            {!hasMessages && (
              <div className="mt-8 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
                {SUGGESTIONS.map(({ icon: Icon, label, prompt }) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => handleSendMessage(prompt)}
                    className="flex h-[86px] flex-col items-start justify-between rounded-xl border border-zinc-800 bg-zinc-950 p-3 text-left text-xs leading-snug text-zinc-400 transition-colors hover:bg-zinc-900 hover:text-white shadow-sm"
                  >
                    <Icon className="h-4 w-4 text-zinc-400" />
                    <span>{label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* 4. Sticky Chatbox / Composer pinned at bottom */}
        <div className="shrink-0 z-10 border-t border-zinc-900/60 bg-black px-4 pb-6 pt-3 sm:px-6">
          <AIComposer
            disabled={isStreaming}
            onSubmit={handleComposerSubmit}
            className="mx-auto w-full max-w-3xl"
          />
          <p className="mx-auto mt-2 w-full max-w-3xl text-center text-[10px] text-zinc-500">
            Enter to send · Shift+Enter for a new line
          </p>
        </div>
      </div>
    </div>
  );
}
