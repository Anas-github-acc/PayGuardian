"use client";

import * as React from "react";
import type { VerifiedBlockMessage } from "./types";
import { BudgetPlanCard, type BudgetSubAllocation } from "../cards/budget-plan-card";
import { PaymentResultCard, type PaymentLifecycleStage } from "../cards/payment-result-card";
import { RejectionCard, type RejectionReasonCode } from "../cards/rejection-card";
import { DelegationCard } from "../cards/delegation-card";
import { MemoryCard, type MemoryCategory } from "../cards/memory-card";

export interface VerifiedBlockProps {
  message: VerifiedBlockMessage;
  onViewTrace?: (traceId?: string) => void;
  onApproveBudget?: () => void;
  onUndoMemory?: (id: string) => void;
  className?: string;
}

/**
 * VerifiedBlock component
 *
 * Dedicated immutable container for Gateway-Verified cryptographic facts.
 * Invariant: Agent conversational text can NEVER render or inject this component.
 */
export function VerifiedBlock({
  message,
  onViewTrace,
  onApproveBudget,
  onUndoMemory,
  className = "",
}: VerifiedBlockProps) {
  const { cardType, payload, verifiedAt, gatewaySignature } = message;

  return (
    <div className={`w-full my-1.5 ${className}`}>
      {/* Decorative immutable hairline frame */}
      <div className="relative group">
        {cardType === "budget_plan" && (
          <BudgetPlanCard
            id={(payload.id as string) ?? message.id}
            title={(payload.title as string) ?? undefined}
            parentMandateId={(payload.parentMandateId as string) ?? undefined}
            totalRequestedMinor={(payload.totalRequestedMinor as number) ?? (payload.amountMinor as number) ?? 1000000}
            currency={(payload.currency as string) ?? "USD"}
            status={(payload.status as "pending" | "approved" | "rejected") ?? "pending"}
            subAllocations={(payload.subAllocations as BudgetSubAllocation[]) ?? undefined}
            policyNotes={(payload.policyNotes as string) ?? undefined}
            verifiedAt={verifiedAt}
            onApprove={onApproveBudget}
            onViewTrace={onViewTrace}
          />
        )}

        {cardType === "payment_result" && (
          <PaymentResultCard
            id={(payload.id as string) ?? message.id}
            transactionId={(payload.transactionId as string) ?? undefined}
            recipient={(payload.recipient as string) ?? "Merchant Gateway"}
            merchantCategory={(payload.merchantCategory as string) ?? undefined}
            amountMinor={(payload.amountMinor as number) ?? 24500}
            currency={(payload.currency as string) ?? "USD"}
            rail={(payload.rail as string) ?? "PayPal"}
            authHash={(payload.authHash as string) ?? gatewaySignature ?? undefined}
            currentStage={(payload.currentStage as PaymentLifecycleStage) ?? "completed"}
            completedAt={verifiedAt}
            agentName={(payload.agentName as string) ?? message.sender ?? undefined}
            onViewTrace={onViewTrace}
          />
        )}

        {cardType === "rejection" && (
          <RejectionCard
            id={(payload.id as string) ?? message.id}
            reasonCode={(payload.reasonCode as RejectionReasonCode) ?? "BUDGET_EXCEEDED"}
            agentName={(payload.agentName as string) ?? message.sender ?? "Subagent"}
            attemptedAmountMinor={(payload.attemptedAmountMinor as number) ?? (payload.amountMinor as number) ?? 500000}
            currency={(payload.currency as string) ?? "USD"}
            attemptedMerchant={(payload.attemptedMerchant as string) ?? undefined}
            ruleReference={(payload.ruleReference as string) ?? undefined}
            explanation={(payload.explanation as string) ?? undefined}
            rejectedAt={verifiedAt}
            checksFailed={(payload.checksFailed as string[]) ?? undefined}
            onViewTrace={onViewTrace}
          />
        )}

        {cardType === "delegation" && (
          <DelegationCard
            id={(payload.id as string) ?? message.id}
            parentAgentName={(payload.parentAgentName as string) ?? "Main Orchestrator"}
            subagentName={(payload.subagentName as string) ?? "Authorized Subagent"}
            delegatedBudgetMinor={(payload.delegatedBudgetMinor as number) ?? 400000}
            currency={(payload.currency as string) ?? "USD"}
            allowedRails={(payload.allowedRails as string[]) ?? undefined}
            maxDepth={(payload.maxDepth as number) ?? 2}
            expiresAt={(payload.expiresAt as string) ?? undefined}
            isFunded={(payload.isFunded as boolean) ?? true}
            delegationHash={(payload.delegationHash as string) ?? gatewaySignature ?? undefined}
            verifiedAt={verifiedAt}
            onViewTrace={onViewTrace}
          />
        )}

        {cardType === "memory" && (
          <MemoryCard
            id={(payload.id as string) ?? message.id}
            category={(payload.category as MemoryCategory) ?? "environment"}
            keyName={(payload.keyName as string) ?? (payload.key as string) ?? "preference"}
            value={(payload.value as string) ?? ""}
            contextSnippet={(payload.contextSnippet as string) ?? undefined}
            agentName={(payload.agentName as string) ?? message.sender ?? undefined}
            savedAt={verifiedAt}
            onUndo={onUndoMemory}
          />
        )}
      </div>
    </div>
  );
}
