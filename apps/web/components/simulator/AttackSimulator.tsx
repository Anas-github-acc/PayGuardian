"use client";

import * as React from "react";
import { Zap, ShieldAlert, CheckCircle2, Trash2, Lock, Activity } from "lucide-react";
import { useWorkspaceStore, workspaceStore } from "../../app/lib/workspace-store";
import { formatMinorUnits } from "../../app/lib/currency";
import { Button } from "../ui/button";
import { SimulationBadge } from "./SimulationBadge";
import { AttackVectorCard } from "./AttackVectorCard";
import { ATTACK_VECTORS, type AttackVector, type SimulationLogItem } from "./types";

export interface AttackSimulatorProps {
  className?: string;
  onNavigateTab?: (tab: "workspace" | "approvals" | "traces") => void;
}

export function AttackSimulator({ className = "", onNavigateTab }: AttackSimulatorProps) {
  const store = useWorkspaceStore();
  const currentEnv = store.currentEnvironment;
  const isSandbox = currentEnv?.type === "sandbox";

  const [executingVectorId, setExecutingVectorId] = React.useState<string | null>(null);
  const [simulationLogs, setSimulationLogs] = React.useState<SimulationLogItem[]>([]);
  const [lastExecutedMap, setLastExecutedMap] = React.useState<Record<string, string>>({});
  const [activeFeedback, setActiveFeedback] = React.useState<{
    title: string;
    description: string;
    type: "blocked" | "held";
  } | null>(null);

  const handleSwitchToSandbox = () => {
    const sandboxEnv = store.environmentsList.find((e) => e.type === "sandbox");
    if (sandboxEnv) {
      workspaceStore.switchEnvironment(sandboxEnv.id);
    }
  };

  const handleExecuteAttack = async (vector: AttackVector) => {
    if (!isSandbox) return;

    setExecutingVectorId(vector.id);
    setActiveFeedback(null);

    // Brief simulation processing delay for UI tactile feedback
    await new Promise((r) => setTimeout(r, 600));

    const nowIso = new Date().toISOString();
    const traceId = `trace-sim-${Date.now()}`;

    // Record execution timestamp
    setLastExecutedMap((prev) => ({ ...prev, [vector.id]: nowIso }));

    switch (vector.id) {
      case "budget_overflow": {
        // Red flash on node and edge
        workspaceStore.updateGraphNode(vector.attackerNodeId, {
          status: "active",
          isSimulation: true,
        });
        workspaceStore.updateGraphEdge(`edge-root-hotel`, {
          status: "rejected_flash",
          isSimulation: true,
        });

        // Add RejectionCard to Chat and GatewayCards
        workspaceStore.addChatMessage({
          type: "verified_block",
          id: `msg-sim-rej-${Date.now()}`,
          cardType: "rejection",
          sender: "Gateway Policy Engine [SIMULATION]",
          timestamp: nowIso,
          verifiedAt: nowIso,
          payload: {
            title: "[SIMULATION] Budget Overflow Refusal",
            id: traceId,
            reasonCode: "BUDGET_EXCEEDED",
            agentName: vector.attackerAgent,
            attemptedAmountMinor: vector.attemptedAmountMinor,
            currency: "USD",
            attemptedMerchant: vector.targetMerchant,
            ruleReference: vector.policyRule,
            explanation: `[SIMULATION] ${vector.attackerAgent} attempted to spend ${formatMinorUnits(vector.attemptedAmountMinor, "USD")}, but its delegated mandate ceiling is only ${formatMinorUnits(vector.allocatedMinor, "USD")}.`,
            isSimulation: true,
          },
        });

        // Add to local simulation logs
        setSimulationLogs((prev) => [
          {
            id: `log-${Date.now()}`,
            vectorId: vector.id,
            timestamp: nowIso,
            title: vector.title,
            reasonCode: "BUDGET_EXCEEDED",
            outcome: "denied",
            details: `Gateway refused ${formatMinorUnits(vector.attemptedAmountMinor, "USD")} spend attempt: exceeds available sub-mandate limit. Red pulse sent to 3D node.`,
            traceId,
          },
          ...prev,
        ]);

        setActiveFeedback({
          title: "Attack 1 Defended: BUDGET_EXCEEDED",
          description:
            "Gateway blocked the $500.00 overspend attempt. Streamed red rejection flash to 3D node and appended verified RejectionCard to decision stream.",
          type: "blocked",
        });

        // Reset edge status after 2.5s
        setTimeout(() => {
          workspaceStore.updateGraphEdge(`edge-root-hotel`, { status: "idle", isSimulation: true });
        }, 2500);
        break;
      }

      case "disallowed_merchant": {
        // Red flash on edge and simulation badge on node
        workspaceStore.updateGraphNode(vector.attackerNodeId, {
          isSimulation: true,
        });
        workspaceStore.updateGraphEdge(`edge-root-travel`, {
          status: "rejected_flash",
          isSimulation: true,
        });

        // Add RejectionCard with UNAUTHORIZED_MERCHANT
        workspaceStore.addChatMessage({
          type: "verified_block",
          id: `msg-sim-dis-${Date.now()}`,
          cardType: "rejection",
          sender: "Security Policy Enforcement [SIMULATION]",
          timestamp: nowIso,
          verifiedAt: nowIso,
          payload: {
            title: "[SIMULATION] Disallowed Merchant Refusal",
            id: traceId,
            reasonCode: "UNAUTHORIZED_MERCHANT",
            agentName: vector.attackerAgent,
            attemptedAmountMinor: vector.attemptedAmountMinor,
            currency: "USD",
            attemptedMerchant: vector.targetMerchant,
            ruleReference: vector.policyRule,
            explanation: `[SIMULATION] Merchant "${vector.targetMerchant}" is blocked under category allowlist rules (Gambling/Casinos strictly prohibited).`,
            isSimulation: true,
          },
        });

        setSimulationLogs((prev) => [
          {
            id: `log-${Date.now()}`,
            vectorId: vector.id,
            timestamp: nowIso,
            title: vector.title,
            reasonCode: "UNAUTHORIZED_MERCHANT",
            outcome: "denied",
            details: `Gateway refused payment to disallowed merchant "${vector.targetMerchant}". Logged security incident with cryptographic trace.`,
            traceId,
          },
          ...prev,
        ]);

        setActiveFeedback({
          title: "Attack 2 Defended: UNAUTHORIZED_MERCHANT",
          description: `Disallowed casino merchant blocked under Rule #POL-1044. Zero funds disbursed. Appended to Security Event Log.`,
          type: "blocked",
        });

        setTimeout(() => {
          workspaceStore.updateGraphEdge(`edge-root-travel`, {
            status: "flowing",
            isSimulation: true,
          });
        }, 2500);
        break;
      }

      case "threshold_bypass": {
        // Mark node and edge with simulation tag
        workspaceStore.updateGraphNode(vector.attackerNodeId, {
          isSimulation: true,
        });
        workspaceStore.updateGraphEdge(`edge-root-travel`, {
          isSimulation: true,
        });

        // Increment pending approvals count on environment
        if (currentEnv) {
          workspaceStore.updateEnvironment(currentEnv.id, {
            pendingApprovalsCount: (currentEnv.pendingApprovalsCount ?? 0) + 1,
          });
        }

        // Add chat notification that action was held for human sign-off
        workspaceStore.addChatMessage({
          type: "agent_says",
          id: `msg-sim-appr-${Date.now()}`,
          sender: "Autonomous Guardrail Monitor [SIMULATION]",
          timestamp: nowIso,
          text: `[SIMULATION] Agent '${vector.attackerAgent}' attempted a single payment of ${formatMinorUnits(vector.attemptedAmountMinor, "USD")} to '${vector.targetMerchant}'. This exceeds the autonomous human approval threshold ($25.00). The payment has been halted and routed directly to your Approvals Inbox.`,
        });

        setSimulationLogs((prev) => [
          {
            id: `log-${Date.now()}`,
            vectorId: vector.id,
            timestamp: nowIso,
            title: vector.title,
            reasonCode: "THRESHOLD_EXCEEDED",
            outcome: "routed_to_approval",
            details: `Action exceeded $25.00 human sign-off threshold. Gateway held funds and routed approval item to Approvals Inbox.`,
            traceId,
          },
          ...prev,
        ]);

        setActiveFeedback({
          title: "Attack 3 Held: THRESHOLD_EXCEEDED",
          description:
            "Payment held by autonomous guardrail. Routed to Approvals Inbox with plain-language rationale. Zero funds disbursed autonomously.",
          type: "held",
        });
        break;
      }

      case "stolen_token": {
        // Red flash on node and edge with simulation tag
        workspaceStore.updateGraphNode(vector.attackerNodeId, {
          status: "unfunded",
          isSimulation: true,
        });
        workspaceStore.updateGraphEdge(`edge-travel-scraper`, {
          status: "rejected_flash",
          isSimulation: true,
        });

        workspaceStore.addChatMessage({
          type: "verified_block",
          id: `msg-sim-tamper-${Date.now()}`,
          cardType: "rejection",
          sender: "Cryptographic Sentinel [SIMULATION]",
          timestamp: nowIso,
          verifiedAt: nowIso,
          payload: {
            title: "[SIMULATION] Parameter Hash Tampering Refusal",
            id: traceId,
            reasonCode: "CRYPTOGRAPHIC_SIGNATURE_INVALID",
            agentName: vector.attackerAgent,
            attemptedAmountMinor: vector.attemptedAmountMinor,
            currency: "USD",
            attemptedMerchant: vector.targetMerchant,
            ruleReference: vector.policyRule,
            explanation: `[SIMULATION] Forged parameter hash (0xbadc0de...) did not match root co-signature. Gateway verification checklist failed: Signature check rejected.`,
            isSimulation: true,
          },
        });

        setSimulationLogs((prev) => [
          {
            id: `log-${Date.now()}`,
            vectorId: vector.id,
            timestamp: nowIso,
            title: vector.title,
            reasonCode: "SIGNATURE_TAMPERED",
            outcome: "flagged",
            details: `SHA-256 parameter hash verification failed. Shadow account payment rejected before reaching payment provider.`,
            traceId,
          },
          ...prev,
        ]);

        setActiveFeedback({
          title: "Attack 4 Defended: FORGED_SIGNATURE",
          description:
            "Cryptographic verification checklist failed on signature verification. Request killed and flagged in Security Audit Table.",
          type: "blocked",
        });

        setTimeout(() => {
          workspaceStore.updateGraphEdge(`edge-travel-scraper`, {
            status: "idle",
            isSimulation: true,
          });
        }, 2500);
        break;
      }

      case "revoked_agent": {
        // Mark node as revoked on canvas (desaturates to grey) and trigger red flash
        workspaceStore.updateGraphNode(vector.attackerNodeId, {
          status: "revoked",
          isFunded: false,
          isSimulation: true,
        });
        workspaceStore.updateGraphEdge(`edge-root-hotel`, {
          status: "rejected_flash",
          isSimulation: true,
        });

        workspaceStore.addChatMessage({
          type: "agent_says",
          id: `msg-sim-rev-${Date.now()}`,
          sender: "Revocation Enforcement Engine [SIMULATION]",
          timestamp: nowIso,
          text: `[SIMULATION] Revoked agent '${vector.attackerAgent}' attempted an external transaction of ${formatMinorUnits(vector.attemptedAmountMinor, "USD")}. The gateway instantly denied the request: all downstream authority is revoked. Node strike-through event recorded.`,
        });

        setSimulationLogs((prev) => [
          {
            id: `log-${Date.now()}`,
            vectorId: vector.id,
            timestamp: nowIso,
            title: vector.title,
            reasonCode: "REVOKED_AUTHORITY",
            outcome: "denied",
            details: `Agent was marked revoked in state tree. Immediate rejection: zero network dispatch permitted.`,
            traceId,
          },
          ...prev,
        ]);

        setActiveFeedback({
          title: "Attack 5 Defended: REVOKED_AGENT_DENIED",
          description:
            "Revoked agent call immediately refused by gateway authority tree. Canvas node desaturated to grey with strike-through.",
          type: "blocked",
        });

        setTimeout(() => {
          workspaceStore.updateGraphEdge(`edge-root-hotel`, { status: "idle", isSimulation: true });
        }, 2500);
        break;
      }
    }

    setExecutingVectorId(null);
  };

  const handleClearLogs = () => {
    setSimulationLogs([]);
    setActiveFeedback(null);
    store.graphNodes.forEach((node) => {
      if (node.isSimulation) {
        workspaceStore.updateGraphNode(node.id, { isSimulation: false });
      }
    });
    store.graphEdges.forEach((edge) => {
      if (edge.isSimulation) {
        workspaceStore.updateGraphEdge(edge.id, { isSimulation: false });
      }
    });
  };

  return (
    <div
      className={`flex flex-col min-h-0 flex-1 bg-background text-foreground overflow-y-auto ${className}`}
    >
      {/* Top Banner / Header */}
      <div className="border-b border-border bg-card px-6 py-6 sm:px-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-warning/30 bg-warning/10 text-warning">
                <Zap className="h-4 w-4" />
              </div>
              <h1 className="text-lg font-semibold text-foreground tracking-tight flex items-center gap-2">
                Sandbox Attack Simulator
                <SimulationBadge />
              </h1>
            </div>
            <p className="mt-1 text-xs text-muted-foreground max-w-2xl">
              Stress-test the PayGuardian Gateway against autonomous adversary vectors in a safe
              sandbox. All events are simulated, streamed to the 3D canvas and activity feeds, and
              explicitly tagged with [SIMULATION].
            </p>
          </div>

          <div className="flex items-center gap-2">
            {simulationLogs.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleClearLogs}
                className="h-8 text-xs border-border text-muted-foreground hover:text-foreground"
              >
                <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                Clear Simulation Log ({simulationLogs.length})
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Production Gating Warning Banner (If in Production) */}
      {!isSandbox && (
        <div className="m-6 sm:m-8 rounded-xl border border-destructive/40 bg-destructive/10 p-5 text-xs text-destructive">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <Lock className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold text-sm text-destructive">
                  Production Environment Guard Active
                </h3>
                <p className="mt-1 text-xs text-destructive/80 leading-relaxed max-w-2xl">
                  The Attack Simulator is strictly disabled in Production environments to ensure
                  zero disruption to live financial ledger mandates. To safely run interactive
                  attack vectors, switch to a Sandbox environment.
                </p>
              </div>
            </div>
            <Button
              size="sm"
              onClick={handleSwitchToSandbox}
              className="bg-destructive hover:bg-destructive text-black font-semibold text-xs h-8 px-3 shrink-0"
            >
              Switch to Sandbox Environment
            </Button>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="mx-auto w-full max-w-[1200px] px-4 py-6 sm:px-6 lg:px-8 space-y-6">
        {/* Active Feedback Banner */}
        {activeFeedback && (
          <div
            className={`rounded-xl border p-4 text-xs transition-all animate-in fade-in-0 duration-200 ${
              activeFeedback.type === "blocked"
                ? "border-success/40 bg-success/10 text-success"
                : "border-warning/40 bg-warning/10 text-warning"
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 font-semibold">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-success" />
                <span>{activeFeedback.title}</span>
              </div>
              <SimulationBadge />
            </div>
            <p className="mt-1 text-[11px] opacity-90 leading-relaxed">
              {activeFeedback.description}
            </p>
          </div>
        )}

        {/* 5 Attack Vector Cards Grid */}
        <section aria-labelledby="attack-vectors-heading">
          <div className="mb-3">
            <h2
              id="attack-vectors-heading"
              className="text-sm font-semibold text-foreground flex items-center gap-2"
            >
              <ShieldAlert className="h-4 w-4 text-warning" />
              Interactive Simulated Attack Vectors (5 Vectors)
            </h2>
            <p className="text-[11px] text-muted-foreground">
              Execute any attack vector below to stream the simulated adversarial event through the
              gateway defense engine.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {ATTACK_VECTORS.map((vector) => (
              <AttackVectorCard
                key={vector.id}
                vector={vector}
                onTrigger={handleExecuteAttack}
                isExecuting={executingVectorId === vector.id}
                lastExecutedAt={lastExecutedMap[vector.id] ?? null}
              />
            ))}
          </div>
        </section>

        {/* Live Simulation Audit Feed */}
        <section
          aria-labelledby="simulation-feed-heading"
          className="rounded-xl border border-border bg-card p-5 top-shade"
        >
          <div className="flex items-center justify-between border-b border-border pb-3 mb-4">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-success" />
              <h3
                id="simulation-feed-heading"
                className="text-xs font-semibold uppercase tracking-wider text-muted-foreground font-mono"
              >
                Simulation Execution Log ({simulationLogs.length} Events)
              </h3>
            </div>
            <span className="font-mono text-[10px] text-muted-foreground">Isolated to Sandbox</span>
          </div>

          {simulationLogs.length === 0 ? (
            <div className="py-8 text-center text-xs text-muted-foreground">
              No attack simulations executed in this session. Click &ldquo;Simulate Attack&rdquo; on
              any vector above to trigger live gateway defense.
            </div>
          ) : (
            <div className="space-y-2.5">
              {simulationLogs.map((log) => (
                <div
                  key={log.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-lg border border-border bg-secondary p-3 text-xs"
                >
                  <div className="flex items-start gap-2.5">
                    <SimulationBadge />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-foreground">{log.title}</span>
                        <span className="rounded bg-destructive/15 px-1.5 py-[0.05rem] font-mono text-[9px] font-bold text-destructive border border-destructive/30">
                          {log.reasonCode}
                        </span>
                      </div>
                      <p className="mt-0.5 text-[11px] text-muted-foreground leading-relaxed">
                        {log.details}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 sm:self-center font-mono text-[10px] text-muted-foreground">
                    <span>{new Date(log.timestamp).toLocaleTimeString()}</span>
                    {onNavigateTab && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onNavigateTab("traces")}
                        className="h-6 px-2 text-[10px] text-success hover:bg-white/[0.04]"
                      >
                        Inspect Trace
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
