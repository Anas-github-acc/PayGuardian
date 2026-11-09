"use client";

import * as React from "react";
import {
  Layers,
  Cpu,
  Copy,
  Check,
  FileText,
  Brain,
  ShieldCheck,
  Sparkles,
  Database,
  Code2,
  RefreshCw,
  Wallet,
  Users,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "../ui/dialog";
import type { ThreadMessage } from "../ui/reasoning-thread";

export interface ContextWindowDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conversationId: string | null;
  environmentId?: string;
  environmentCurrency?: string;
  environmentBudgetLimitMinor?: number;
  activeModel?: string;
  threadMessages: ThreadMessage[];
  subagents: Array<{
    id: string;
    title: string;
    status: string;
    detail?: string;
    streamText?: string;
  }>;
  activeRunId?: string | null;
}

interface ServerContextData {
  conversationId: string;
  title: string;
  environmentId: string;
  mandate: {
    mandateId?: string;
    budgetLimitMinor: number;
    currency: string;
    budgetDisplay: string;
    spendableMinor: number;
    reserveMinor: number;
    reserveDisplay: string;
  };
  subagents: Array<{
    agent: string;
    role: string;
    percentage: number;
    amountMinor: number;
    currency: string;
    budgetDisplay: string;
    description: string;
  }>;
  systemInstruction: string;
  messages: Array<{
    id: string;
    role: string;
    content: string;
    createdAt?: string;
  }>;
  estimatedTokens: number;
  totalCharacters: number;
  fullPromptText: string;
}

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001";

export function ContextWindowDialog({
  open,
  onOpenChange,
  conversationId,
  environmentId,
  environmentCurrency = "INR",
  environmentBudgetLimitMinor = 1000000,
  activeModel = "free/gpt-6-luna",
  threadMessages,
  subagents,
  activeRunId,
}: ContextWindowDialogProps) {
  const [activeTab, setActiveTab] = React.useState<
    "overview" | "prompt" | "system" | "messages" | "json"
  >("overview");
  const [copied, setCopied] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(false);
  const [serverContext, setServerContext] = React.useState<ServerContextData | null>(null);

  // Fetch server-verified context when opened
  React.useEffect(() => {
    if (!open || !environmentId || !conversationId) return;

    let isMounted = true;
    setIsLoading(true);

    fetch(
      `${API_BASE}/v1/environments/${environmentId}/conversations/${conversationId}/context`,
      {
        headers: { "x-local-user-id": "local-user" },
      }
    )
      .then((res) => (res.ok ? res.json() : null))
      .then((data: ServerContextData | null) => {
        if (isMounted && data) {
          setServerContext(data);
        }
      })
      .catch((err) => {
        console.warn("Could not fetch server conversation context:", err);
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [open, environmentId, conversationId]);

  // Format currency helpers
  const formatCurrency = (minor: number, currency: string) => {
    const val = (minor / 100).toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    if (currency === "INR") return `₹${val}`;
    if (currency === "EUR") return `€${val}`;
    if (currency === "GBP") return `£${val}`;
    return `$${val}`;
  };

  const budgetLimitMinor =
    serverContext?.mandate?.budgetLimitMinor ?? environmentBudgetLimitMinor;
  const currency = serverContext?.mandate?.currency ?? environmentCurrency;
  const budgetDisplay =
    serverContext?.mandate?.budgetDisplay ?? formatCurrency(budgetLimitMinor, currency);

  // Real subagent allocations from server context (no mock hardcoded weights)
  const activeAllocations =
    serverContext?.subagents && serverContext.subagents.length > 0
      ? serverContext.subagents.map((s) => ({
          agent: s.agent,
          role: s.role,
          share: `${s.percentage}%`,
          amountMinor: s.amountMinor,
          description: s.description,
          budgetDisplay: s.budgetDisplay,
        }))
      : [];

  const totalDelegatedMinor = activeAllocations.reduce(
    (acc, s) => acc + s.amountMinor,
    0
  );
  const totalDelegatedDisplay = formatCurrency(totalDelegatedMinor, currency);
  const spendableMinor = Math.max(0, budgetLimitMinor - totalDelegatedMinor);
  const reserveMinor = Math.max(0, budgetLimitMinor - totalDelegatedMinor);
  const reserveDisplay = formatCurrency(reserveMinor, currency);

  // System instruction
  const systemInstruction =
    serverContext?.systemInstruction ||
    [
      "You are the PayGuardian Personal Agent Orchestrator — an intelligent, articulate AI coordinator.",
      "You manage specialist sub-agents (Travel, Hotel, Food, Transport, Activities, MerchantAttach) and communicate with users in clear, detailed English.",
      "",
      "MANDATE BUDGET FACTS (use these exact figures when answering budget questions):",
      `  - Your mandate budget (allocated to YOU by the user): ${budgetDisplay} (${currency})`,
      `  - Total you have delegated to subagents: ${totalDelegatedDisplay}`,
      `  - Remaining orchestrator reserve: ${reserveDisplay}`,
      "",
      "SUBAGENT BUDGET DELEGATIONS:",
      ...activeAllocations.map((s) => `  - ${s.role}: ${s.budgetDisplay}`),
      "",
      "RESPONSE RULES:",
      "1. When asked 'how much budget do you have?', answer with YOUR mandate budget exactly.",
      "2. When asked about a subagent's budget, answer with the amount YOU actually delegated upto this point.",
      "3. Always provide rich, detailed, well-structured responses. Use markdown tables and bullet points when summarizing plans or budgets.",
      "4. When asked about you and payguardian work - never invent numbers — use only the figures provided above.",
      "5. Never bypass gateway authority rules or leak credentials.",
    ].join("\n");

  // Injected subagent results
  const subagentResultsInContext = subagents
    .filter((s) => s.streamText || s.detail)
    .map(
      (s) =>
        `[${s.id.toUpperCase()} AGENT RESULT]\n${s.streamText || s.detail || "Completed"}`
    )
    .join("\n\n");

  // Build message history
  const activeMessages =
    threadMessages.length > 0
      ? threadMessages
      : (serverContext?.messages || []).map((m) => ({
          id: m.id,
          role: m.role as "user" | "assistant",
          text: m.content,
        }));

  const messageHistoryText = activeMessages
    .map((m) => `[${m.role.toUpperCase()}]: ${m.text}`)
    .join("\n\n");

  const fullPromptText = [
    systemInstruction,
    subagentResultsInContext
      ? `=== SPECIALIST AGENT CONTEXT INJECTIONS ===\n${subagentResultsInContext}`
      : "",
    `=== CONVERSATION MESSAGES ===\n${messageHistoryText || "(No messages in active session)"}`,
  ]
    .filter(Boolean)
    .join("\n\n");

  const estimatedTokens = Math.ceil(fullPromptText.length / 4);

  const handleCopy = () => {
    let textToCopy = fullPromptText;
    if (activeTab === "system") textToCopy = systemInstruction;
    if (activeTab === "json") {
      textToCopy = JSON.stringify(
        {
          conversationId,
          environmentId,
          activeRunId,
          activeModel,
          mandate: {
            mandateId: serverContext?.mandate?.mandateId,
            budgetLimitMinor,
            currency,
            budgetDisplay,
            spendableMinor,
            reserveMinor,
            reserveDisplay,
          },
          subagents: activeAllocations,
          systemInstruction,
          messages: activeMessages,
          estimatedTokens,
        },
        null,
        2
      );
    }
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col p-0 overflow-hidden bg-zinc-950 border-zinc-800 text-zinc-100 shadow-2xl">
        {/* Header */}
        <div className="p-5 border-b border-zinc-800/80 bg-zinc-900/40">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400">
                  <Layers className="h-4 w-4" />
                </div>
                <DialogTitle className="text-sm font-semibold text-white tracking-tight">
                  Chat Context Window & Prompt Bounds
                </DialogTitle>
              </div>
              <DialogDescription className="text-xs text-zinc-400">
                Inspect the exact mandate bounds, specialist delegations, system instructions, and token consumption injected into this chat.
              </DialogDescription>
            </div>

            <div className="flex items-center gap-2 mr-6">
              <button
                type="button"
                onClick={handleCopy}
                className="flex items-center gap-1.5 rounded-md border border-zinc-800 bg-zinc-900 px-2.5 py-1 text-xs text-zinc-300 hover:bg-zinc-800 hover:text-white transition-colors"
                title="Copy current context tab"
              >
                {copied ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-emerald-400" />
                    <span className="text-emerald-400 font-medium">Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5 text-zinc-400" />
                    <span>Copy</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Quick Stats Badges */}
          <div className="mt-4 flex flex-wrap items-center gap-2 text-[11px]">
            <div className="flex items-center gap-1.5 rounded-md bg-zinc-900 border border-zinc-800/80 px-2.5 py-1">
              <Cpu className="h-3 w-3 text-zinc-400" />
              <span className="text-zinc-400">Model:</span>
              <span className="font-mono text-zinc-200">{activeModel}</span>
            </div>
            <div className="flex items-center gap-1.5 rounded-md bg-zinc-900 border border-zinc-800/80 px-2.5 py-1">
              <Sparkles className="h-3 w-3 text-amber-400" />
              <span className="text-zinc-400">Tokens:</span>
              <span className="font-mono font-medium text-amber-300">
                ~{estimatedTokens.toLocaleString()}
              </span>
            </div>
            <div className="flex items-center gap-1.5 rounded-md bg-zinc-900 border border-zinc-800/80 px-2.5 py-1">
              <Wallet className="h-3 w-3 text-emerald-400" />
              <span className="text-zinc-400">Mandate:</span>
              <span className="font-mono font-medium text-emerald-300">
                {budgetDisplay}
              </span>
            </div>
            <div className="flex items-center gap-1.5 rounded-md bg-zinc-900 border border-zinc-800/80 px-2.5 py-1">
              <Users className="h-3 w-3 text-blue-400" />
              <span className="text-zinc-400">Subagents:</span>
              <span className="font-mono text-blue-300">
                {activeAllocations.length} active
              </span>
            </div>
            {conversationId && (
              <div className="flex items-center gap-1.5 rounded-md bg-zinc-900 border border-zinc-800/80 px-2.5 py-1">
                <span className="text-zinc-500 font-mono text-[10px]">
                  ID: {conversationId.slice(0, 8)}...
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center border-b border-zinc-800/80 bg-zinc-900/30 px-5 gap-1">
          <button
            type="button"
            onClick={() => setActiveTab("overview")}
            className={`px-3 py-2 text-xs font-medium border-b-2 transition-colors ${
              activeTab === "overview"
                ? "border-blue-500 text-blue-400"
                : "border-transparent text-zinc-400 hover:text-zinc-200"
            }`}
          >
            Overview & Bounds
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("prompt")}
            className={`px-3 py-2 text-xs font-medium border-b-2 transition-colors ${
              activeTab === "prompt"
                ? "border-blue-500 text-blue-400"
                : "border-transparent text-zinc-400 hover:text-zinc-200"
            }`}
          >
            Assembled Prompt
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("system")}
            className={`px-3 py-2 text-xs font-medium border-b-2 transition-colors ${
              activeTab === "system"
                ? "border-blue-500 text-blue-400"
                : "border-transparent text-zinc-400 hover:text-zinc-200"
            }`}
          >
            System Instruction
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("messages")}
            className={`px-3 py-2 text-xs font-medium border-b-2 transition-colors ${
              activeTab === "messages"
                ? "border-blue-500 text-blue-400"
                : "border-transparent text-zinc-400 hover:text-zinc-200"
            }`}
          >
            Messages ({activeMessages.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("json")}
            className={`px-3 py-2 text-xs font-medium border-b-2 transition-colors ${
              activeTab === "json"
                ? "border-blue-500 text-blue-400"
                : "border-transparent text-zinc-400 hover:text-zinc-200"
            }`}
          >
            Raw JSON
          </button>
        </div>

        {/* Tab Content Body */}
        <div className="flex-1 overflow-y-auto p-5 text-xs text-zinc-300">
          {activeTab === "overview" && (
            <div className="space-y-5">
              {/* Mandate & Subagent Explanation */}
              <div className="rounded-lg border border-blue-900/40 bg-blue-950/20 p-4 space-y-2">
                <div className="flex items-center gap-2 text-blue-300 font-semibold text-xs">
                  <ShieldCheck className="h-4 w-4 text-blue-400" />
                  <span>How Subagent Budgets are Delegated from the Mandate</span>
                </div>
                <p className="text-zinc-300 text-[11px] leading-relaxed">
                  Your environment grants a root spending mandate of <strong className="text-white">{budgetDisplay}</strong> to the Main Agent (Personal Agent Orchestrator). Child mandates are issued through the Gateway only when specialist tasks are planned, quoted, and approved.
                </p>
                {activeAllocations.length > 0 ? (
                  <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
                    {activeAllocations.map((sub) => (
                      <div
                        key={sub.agent}
                        className="rounded-md border border-zinc-800 bg-zinc-900/80 p-3 space-y-1"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-zinc-200">{sub.role}</span>
                          <span className="text-[10px] text-blue-400 font-mono font-medium">
                            {sub.share}
                          </span>
                        </div>
                        <div className="text-base font-bold text-emerald-400 font-mono">
                          {sub.budgetDisplay}
                        </div>
                        <p className="text-[10px] text-zinc-400 leading-tight">
                          {sub.description}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="mt-2 rounded-md border border-zinc-800 bg-zinc-900/50 p-3 text-[11px] text-zinc-400">
                    No child mandates are currently delegated. The Main Agent holds the entire <span className="font-mono text-emerald-400 font-medium">{budgetDisplay}</span> root spending ceiling.
                  </div>
                )}
                <div className="flex items-center justify-between text-[11px] pt-2 text-zinc-400 border-t border-blue-900/30">
                  <span>
                    Total Delegated: <strong className="text-white">{totalDelegatedDisplay}</strong>
                  </span>
                  <span>
                    Orchestrator Reserve Buffer (5%): <strong className="text-zinc-200">{reserveDisplay}</strong>
                  </span>
                </div>
              </div>

              {/* Context Summary Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="rounded-lg border border-zinc-800/80 bg-zinc-900/50 p-3.5 space-y-2">
                  <div className="flex items-center gap-2 text-zinc-200 font-medium">
                    <Brain className="h-4 w-4 text-purple-400" />
                    <span>Context Window Breakdown</span>
                  </div>
                  <div className="space-y-1.5 text-[11px] text-zinc-400">
                    <div className="flex justify-between py-1 border-b border-zinc-800/60">
                      <span>Total Characters</span>
                      <span className="font-mono text-zinc-200">
                        {fullPromptText.length.toLocaleString()} chars
                      </span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-zinc-800/60">
                      <span>Estimated Context Tokens</span>
                      <span className="font-mono text-amber-300 font-medium">
                        ~{estimatedTokens.toLocaleString()} tokens
                      </span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-zinc-800/60">
                      <span>Messages in History</span>
                      <span className="font-mono text-zinc-200">
                        {activeMessages.length} messages
                      </span>
                    </div>
                    <div className="flex justify-between py-1">
                      <span>Active Run ID</span>
                      <span className="font-mono text-zinc-400">
                        {activeRunId ? `${activeRunId.slice(0, 14)}...` : "None"}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="rounded-lg border border-zinc-800/80 bg-zinc-900/50 p-3.5 space-y-2">
                  <div className="flex items-center gap-2 text-zinc-200 font-medium">
                    <Database className="h-4 w-4 text-emerald-400" />
                    <span>Authority & Mandate State</span>
                  </div>
                  <div className="space-y-1.5 text-[11px] text-zinc-400">
                    <div className="flex justify-between py-1 border-b border-zinc-800/60">
                      <span>Mandate ID</span>
                      <span className="font-mono text-zinc-200">
                        {serverContext?.mandate?.mandateId || "mandate-root-simulated"}
                      </span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-zinc-800/60">
                      <span>Mandate Ceiling</span>
                      <span className="font-mono text-emerald-300 font-medium">
                        {budgetDisplay}
                      </span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-zinc-800/60">
                      <span>Currency</span>
                      <span className="font-mono text-zinc-200">{currency}</span>
                    </div>
                    <div className="flex justify-between py-1">
                      <span>Security Bounds</span>
                      <span className="text-emerald-400">Immutable Cryptographic Cap</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === "prompt" && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-zinc-400 text-[11px]">
                <span>Full assembled prompt text sent to model:</span>
                <span className="font-mono text-amber-400">~{estimatedTokens} tokens</span>
              </div>
              <pre className="p-4 rounded-lg bg-zinc-900 border border-zinc-800 font-mono text-[11px] leading-relaxed text-zinc-200 whitespace-pre-wrap overflow-x-auto max-h-[50vh]">
                {fullPromptText}
              </pre>
            </div>
          )}

          {activeTab === "system" && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-zinc-400 text-[11px]">
                <span>Coordinator System Instruction:</span>
                <span className="font-mono text-zinc-400">
                  {systemInstruction.length} chars
                </span>
              </div>
              <pre className="p-4 rounded-lg bg-zinc-900 border border-zinc-800 font-mono text-[11px] leading-relaxed text-blue-300 whitespace-pre-wrap overflow-x-auto max-h-[50vh]">
                {systemInstruction}
              </pre>
            </div>
          )}

          {activeTab === "messages" && (
            <div className="space-y-3">
              {activeMessages.length === 0 ? (
                <div className="text-center py-8 text-zinc-500">
                  No conversation messages in context yet.
                </div>
              ) : (
                activeMessages.map((msg, idx) => (
                  <div
                    key={msg.id || idx}
                    className={`p-3 rounded-lg border ${
                      msg.role === "user"
                        ? "bg-zinc-900/90 border-zinc-800"
                        : "bg-blue-950/20 border-blue-900/40"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span
                        className={`text-[10px] font-semibold uppercase tracking-wider ${
                          msg.role === "user" ? "text-zinc-400" : "text-blue-400"
                        }`}
                      >
                        {msg.role}
                      </span>
                      <span className="text-[10px] text-zinc-500 font-mono">
                        {msg.text.length} chars
                      </span>
                    </div>
                    <div className="whitespace-pre-wrap text-[11px] text-zinc-200">
                      {msg.text}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === "json" && (
            <pre className="p-4 rounded-lg bg-zinc-900 border border-zinc-800 font-mono text-[11px] leading-relaxed text-emerald-300 whitespace-pre-wrap overflow-x-auto max-h-[50vh]">
              {JSON.stringify(
                {
                  conversationId,
                  environmentId,
                  activeRunId,
                  activeModel,
                  mandate: {
                    mandateId: serverContext?.mandate?.mandateId,
                    budgetLimitMinor,
                    currency,
                    budgetDisplay,
                    spendableMinor,
                    reserveMinor,
                    reserveDisplay,
                  },
                  subagents: activeAllocations,
                  systemInstruction,
                  messages: activeMessages,
                  estimatedTokens,
                },
                null,
                2
              )}
            </pre>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
