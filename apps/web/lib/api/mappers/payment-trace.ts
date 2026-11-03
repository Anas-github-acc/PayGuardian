import type {
  PayPalOperationSummaryDto,
  AuditEventDto,
  AgentDto,
  MandateDto,
} from "@payguardian/contracts";
import type { PaymentTrace, TraceStatus, TraceRail, TraceAuthNode } from "@/components/traces/types";

export interface BackendTracePayload {
  action?: Record<string, unknown> | null;
  agent?: AgentDto | null;
  mandateChain?: MandateDto[] | null;
  rootMandate?: MandateDto | null;
  reservation?: { actionId: string; accountId?: string; amountMinor?: number; state?: string } | null;
  operation?: PayPalOperationSummaryDto | null;
  auditEvent?: AuditEventDto | null;
}

export function mapBackendTraceToView(
  traceSource: BackendTracePayload | AuditEventDto,
  opSummary?: PayPalOperationSummaryDto | null,
  environmentName = "Active Environment",
  reservation?: Record<string, unknown> | null,
): PaymentTrace {
  const isAuditEvent = Boolean(
    traceSource &&
      typeof (traceSource as AuditEventDto).eventType === "string" &&
      typeof (traceSource as AuditEventDto).outcome === "string",
  );

  const payloadSource = !isAuditEvent ? (traceSource as BackendTracePayload) : null;
  const auditEvent = isAuditEvent
    ? (traceSource as AuditEventDto)
    : payloadSource?.auditEvent ?? null;

  const action = (payloadSource?.action ?? null) as Record<string, unknown> | null;
  const agent = payloadSource?.agent ?? null;
  const mandateChain = payloadSource?.mandateChain ?? [];
  const op = opSummary ?? payloadSource?.operation ?? null;
  const reservationData =
    reservation ?? (payloadSource?.reservation as Record<string, unknown> | null) ?? null;

  const eventPayload = (auditEvent?.payload ?? {}) as Record<string, unknown>;

  const actionId = action?.id
    ? String(action.id)
    : auditEvent?.actionId || auditEvent?.id || op?.actionId || "unknown";

  const amountMinor =
    typeof action?.amountMinor === "number"
      ? (action.amountMinor as number)
      : typeof op?.amountMinor === "number"
      ? op.amountMinor
      : typeof eventPayload.amountMinor === "number"
      ? (eventPayload.amountMinor as number)
      : 0;

  const currency = String(
    action?.currency ?? op?.currency ?? eventPayload.currency ?? "USD",
  );

  let status: TraceStatus = "completed";
  const actionAuthState = action?.authorizationState;
  const actionExecState = action?.executionState;

  if (actionAuthState === "denied" || op?.status === "FAILED" || auditEvent?.outcome === "denied") {
    status = "rejected";
  } else if (auditEvent?.outcome === "failure") {
    status = "failed";
  } else if (
    op?.reconciliationState === "pending" ||
    op?.reconciliationState === "uncertain" ||
    actionExecState === "reserved"
  ) {
    status = "pending_capture";
  } else if (
    actionExecState === "captured" ||
    op?.status === "COMPLETED" ||
    auditEvent?.outcome === "success"
  ) {
    status = "completed";
  }

  const rail: TraceRail = op ? "PayPal" : "Simulation";

  const recipient =
    (eventPayload.recipient as string) ||
    (op ? "PayPal Merchant" : "Authorized Gateway Recipient");

  const merchantCategory =
    (eventPayload.merchantCategory as string) ||
    (op ? "Payment Services" : "Autonomous Operations");

  const initiatedAt = String(
    action?.createdAt ?? op?.createdAt ?? auditEvent?.createdAt ?? new Date().toISOString(),
  );

  const completedAt = op?.lastEventAt
    ? String(op.lastEventAt)
    : action?.updatedAt
    ? String(action.updatedAt)
    : auditEvent?.createdAt
    ? String(auditEvent.createdAt)
    : undefined;

  // Build authentic vertical authorization chain from mandateChain
  const authChain: TraceAuthNode[] =
    mandateChain && mandateChain.length > 0
      ? mandateChain.map((m, idx) => {
          const allocatedMinor = m.budgetLimitMinor ?? 0;
          const spentMinor = m.spentMinor ?? 0;
          const reservedMinor = m.reservedMinor ?? 0;
          const availableMinor = Math.max(0, allocatedMinor - spentMinor - reservedMinor);
          const isRevoked = m.state === "revoked" || (m as { status?: string }).status === "revoked";
          return {
            id: m.holderAgentId || m.id,
            name:
              idx === 0
                ? "Root Authority"
                : `Delegated Agent (${m.holderAgentId?.slice(0, 8) ?? idx})`,
            role: idx === 0 ? "Root Orchestrator" : "Delegated Subagent",
            mandateId: m.id,
            allocatedMinor,
            spentMinor,
            reservedMinor,
            availableMinor,
            currency: m.currency || currency,
            status: isRevoked ? ("revoked" as const) : ("active" as const),
            depth: idx,
          };
        })
      : [
          {
            id: "auth-root",
            name: "Operator Mandate Authority",
            role: "Root Issuer",
            mandateId: String(action?.mandateId ?? auditEvent?.mandateId ?? "root-mandate"),
            allocatedMinor: amountMinor,
            spentMinor: amountMinor,
            reservedMinor: 0,
            availableMinor: 0,
            currency,
            status: "active" as const,
            depth: 0,
          },
        ];

  const requestingAgent = {
    id: agent?.id ?? (action?.agentId ? String(action.agentId) : auditEvent?.actorId || "agent-root"),
    name:
      agent?.name ??
      (auditEvent?.actorType === "agent" ? "Procurement Agent" : "Autonomous Subagent"),
    role: agent?.parentAgentId ? "Delegated Subagent" : "Autonomous Agent",
  };

  const uncertainNotice =
    status === "pending_capture"
      ? "Waiting for confirmation from payment provider. The money is held in reservation, not spent."
      : undefined;

  return {
    id: `trace-${actionId}`,
    actionId,
    environmentId: String(action?.environmentId ?? auditEvent?.environmentId ?? ""),
    environmentName,
    transactionId: op?.providerOrderId ?? op?.captureId ?? undefined,
    recipient,
    merchantCategory,
    amountMinor,
    currency,
    status,
    rail,
    initiatedAt,
    completedAt,
    // Per R2: Never invent synthetic execution latencies (documented under GAP-TRC-01)
    totalLatencyMs: 0,
    requestingAgent,
    authChain,
    // Per R2: Since Fastify Gateway lacks 5-stage latency metrics and 5-point checklist records,
    // empty arrays are provided so components render explicit "Unavailable" state containers.
    stages: [],
    checklist: [],
    rawRecord: {
      action,
      agent,
      mandateChain,
      reservation: reservationData,
      operation: op,
      auditEvent,
    },
    uncertainStateNotice: uncertainNotice,
  };
}
