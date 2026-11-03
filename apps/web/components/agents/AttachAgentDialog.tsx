"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "../ui/dialog";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Link2, AlertCircle } from "lucide-react";
import { formatMinorUnits } from "../../app/lib/currency";
import { useWorkspaceStore, workspaceStore } from "../../app/lib/workspace-store";
import { apiClient } from "../../lib/api/client";
import type { SpecialistAgent } from "./types";
import type { AgentNodeData, AgentEdgeData } from "../../app/lib/workspace-store";
import type { MandateDto } from "@payguardian/contracts";

export interface AttachAgentDialogProps {
  agent: SpecialistAgent | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (agent: SpecialistAgent) => void;
}

export function AttachAgentDialog({
  agent,
  isOpen,
  onClose,
  onSuccess,
}: AttachAgentDialogProps) {
  const store = useWorkspaceStore();
  const currentEnv = store.currentEnvironment;
  const currency = currentEnv?.currency ?? "USD";

  // Form State
  const [budgetDollars, setBudgetDollars] = React.useState<string>("500");
  const [selectedParentId, setSelectedParentId] = React.useState<string>(
    () => store.graphNodes[0]?.id ?? "orchestrator-root"
  );
  const [allowedRails, setAllowedRails] = React.useState<string[]>(["PayPal"]);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  // Sync default budget and selected parent when agent changes
  React.useEffect(() => {
    if (agent) {
      const defaultDollars = (agent.recommendedBudgetMinor / 100).toFixed(0);
      setBudgetDollars(defaultDollars);
      setAllowedRails(agent.supportedRails.includes("PayPal") ? ["PayPal"] : agent.supportedRails.slice(0, 1));
      setErrorMessage(null);
    }
  }, [agent]);

  React.useEffect(() => {
    if (store.graphNodes.length > 0 && !store.graphNodes.some((n) => n.id === selectedParentId)) {
      setSelectedParentId(store.graphNodes[0].id);
    }
  }, [store.graphNodes, selectedParentId]);

  if (!agent) return null;

  // Potential parent nodes from workspace graph
  const availableParents =
    store.graphNodes.length > 0
      ? store.graphNodes.filter((n) => n.id !== agent.id && n.status !== "revoked")
      : [{ id: "orchestrator-root", name: "Main Orchestrator", role: "orchestrator" as const }];

  // Calculate budget minor units from input dollars (strict integer math)
  const parsedDollars = parseFloat(budgetDollars);
  const budgetMinor = isNaN(parsedDollars) || parsedDollars < 0 ? 0 : Math.round(parsedDollars * 100);

  const toggleRail = (rail: string) => {
    setAllowedRails((prev) =>
      prev.includes(rail) ? prev.filter((r) => r !== rail) : [...prev, rail]
    );
  };

  const handleAttach = async () => {
    if (allowedRails.length === 0) {
      setErrorMessage("At least one payment rail must be selected.");
      return;
    }

    if (!currentEnv?.id) {
      setErrorMessage("No active environment selected.");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      // 1. Sequential Backend Command: Register child agent on gateway
      const childAgent = await apiClient.agents.registerChild(currentEnv.id, {
        parentAgentId: selectedParentId,
        name: agent.name,
        kind: agent.specialty || "worker",
        capabilities: agent.permissions,
      });

      // 2. Sequential Backend Command: Delegate mandate if budget specified
      let delegatedMandate: MandateDto | null = null;
      if (budgetMinor > 0) {
        const mandates = await apiClient.mandates.list(currentEnv.id);
        const parentMandate =
          mandates.find((m) => m.holderAgentId === selectedParentId && m.state === "active") ??
          mandates.find((m) => !m.parentMandateId && m.state === "active") ??
          mandates[0];

        if (parentMandate) {
          delegatedMandate = await apiClient.mandates.delegate(parentMandate.id, {
            holderAgentId: childAgent.id,
            budgetLimitMinor: budgetMinor,
            currency,
            permittedActions: agent.permissions,
            expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
            canDelegate: false,
            maxDelegationDepth: 0,
            approvalRequired: false,
          });
        }
      }

      // 3. Update UI state strictly upon confirmed server response (no optimistic updates)
      const nodeIndex = store.graphNodes.length;
      const posX = (nodeIndex % 2 === 0 ? 1 : -1) * (60 + nodeIndex * 20);
      const posY = -40;
      const posZ = 0;

      const newNode: AgentNodeData = {
        id: childAgent.id,
        name: childAgent.name,
        role: "subagent",
        status: budgetMinor > 0 ? "active" : "unfunded",
        allocatedMinor: budgetMinor,
        spentMinor: 0,
        reservedMinor: 0,
        position: [posX, posY, posZ],
        isFunded: budgetMinor > 0,
      };

      const newEdge: AgentEdgeData = {
        id: `edge-${selectedParentId}-${childAgent.id}`,
        source: selectedParentId,
        target: childAgent.id,
        isAuthorized: budgetMinor > 0,
        status: budgetMinor > 0 ? "flowing" : "idle",
        amountMinor: budgetMinor,
      };

      workspaceStore.attachAgent(newNode, newEdge);

      const nowIso = new Date().toISOString();
      workspaceStore.addChatMessage({
        type: "agent_says",
        id: `msg-attach-${childAgent.id}`,
        sender: "Gateway Policy Engine",
        timestamp: nowIso,
        text: `Specialist child agent '${childAgent.name}' has been registered under parent '${selectedParentId}' with a confirmed delegated limit of ${formatMinorUnits(budgetMinor, currency)}.`,
      });

      if (delegatedMandate) {
        workspaceStore.addChatMessage({
          type: "verified_block",
          id: `msg-vdel-${delegatedMandate.id}`,
          cardType: "delegation",
          sender: "Delegation Gateway",
          timestamp: nowIso,
          verifiedAt: nowIso,
          payload: {
            id: delegatedMandate.id,
            parentMandateId: delegatedMandate.parentMandateId ?? undefined,
            childAgentId: childAgent.id,
            childAgentName: childAgent.name,
            allocatedMinor: budgetMinor,
            currency,
            permittedActions: agent.permissions,
            allowedRails,
            gatewaySignature: `mandate:${delegatedMandate.id}`,
          },
        });
      }

      onSuccess?.({ ...agent, id: childAgent.id, name: childAgent.name });
      onClose();
    } catch (err) {
      setErrorMessage(
        err instanceof Error
          ? err.message
          : "Failed to register child agent and delegate spending authority on gateway."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md bg-card border border-border p-6 text-foreground shadow-2xl top-shade">
        <DialogHeader>
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-md border border-border bg-secondary text-foreground">
              <Link2 className="h-4 w-4" />
            </div>
            <div>
              <DialogTitle className="text-sm font-semibold text-foreground">
                Attach {agent.name}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Configure spending delegation and parent authority attachment via Fastify Gateway.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {errorMessage && (
          <div className="mt-2 flex items-center gap-2 rounded-md bg-destructive/10 border border-destructive/20 p-2.5 text-xs text-destructive">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        <div className="mt-4 space-y-4 text-xs">
          {/* Target Parent Mandate */}
          <div>
            <label className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground block mb-1.5">
              Parent Mandate Holder
            </label>
            <select
              value={selectedParentId}
              onChange={(e) => setSelectedParentId(e.target.value)}
              className="w-full rounded-md border border-border bg-secondary px-3 py-2 text-xs text-foreground focus:border-input focus:outline-none"
            >
              {availableParents.map((parent) => (
                <option key={parent.id} value={parent.id} className="bg-secondary">
                  {parent.name} ({parent.id})
                </option>
              ))}
            </select>
          </div>

          {/* Delegated Budget Input */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
                Delegated Budget Limit
              </label>
              <span className="font-mono text-[10px] text-foreground">
                {formatMinorUnits(budgetMinor, currency)}
              </span>
            </div>
            <div className="relative">
              <span className="absolute left-3 top-2 font-mono text-xs text-muted-foreground">$</span>
              <Input
                type="number"
                min="0"
                step="10"
                value={budgetDollars}
                onChange={(e) => setBudgetDollars(e.target.value)}
                className="pl-7 font-mono text-xs bg-secondary border-border text-foreground"
                placeholder="500"
              />
            </div>
            <p className="mt-1 text-[10px] text-muted-foreground">
              Setting $0 connects the agent as a structural node with dashed edge and $0 authority.
            </p>
          </div>

          {/* Allowed Payment Rails */}
          <div>
            <label className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground block mb-1.5">
              Allowed Payment Rails
            </label>
            <div className="flex flex-wrap gap-2">
              {agent.supportedRails.map((rail) => {
                const isSelected = allowedRails.includes(rail);
                return (
                  <button
                    key={rail}
                    type="button"
                    onClick={() => toggleRail(rail)}
                    className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-mono transition-colors border focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring ${
                      isSelected
                        ? "border-input bg-secondary text-foreground"
                        : "border-border text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <span className={`h-1.5 w-1.5 rounded-full ${isSelected ? "bg-foreground" : "bg-muted-foreground"}`} />
                    {rail}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Security Notice */}
          <div className="rounded-md border border-border bg-card p-3 text-[11px] text-muted-foreground leading-relaxed">
            <span className="font-semibold text-foreground block mb-0.5">Policy Notice</span>
            Authority grants can be revoked at any time by the parent orchestrator. The child agent cannot
            delegate further without explicit sub-delegation permissions.
          </div>
        </div>

        <DialogFooter className="mt-6 flex gap-2">
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            disabled={isSubmitting}
            className="h-8 text-xs"
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="primary"
            onClick={handleAttach}
            disabled={isSubmitting}
            className="h-8 text-xs"
          >
            {isSubmitting ? "Attaching on Gateway…" : "Confirm & Attach"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
