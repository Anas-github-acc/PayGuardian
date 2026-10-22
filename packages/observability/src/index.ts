import { createHash, randomUUID } from "node:crypto";

export type JsonValue =
  null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };
export type JsonObject = { [key: string]: JsonValue };
export type AuditActorType = "user" | "agent" | "service" | "system";
export type AuditOutcome = "success" | "denied" | "failure";

export type AuditEventInput = {
  environmentId: string;
  actorType: AuditActorType;
  actorId?: string | null;
  sessionId?: string | null;
  mandateId?: string | null;
  actionId?: string | null;
  eventType: string;
  outcome: AuditOutcome;
  reasonCode?: string | null;
  payload?: JsonObject;
  id?: string;
  createdAt?: string;
};

export type AuditEvent = Required<
  Pick<AuditEventInput, "environmentId" | "actorType" | "eventType" | "outcome">
> & {
  id: string;
  actorId: string | null;
  sessionId: string | null;
  mandateId: string | null;
  actionId: string | null;
  reasonCode: string | null;
  payload: JsonObject;
  previousHash: string | null;
  eventHash: string;
  createdAt: string;
};

const sensitiveKey =
  /(authorization|api[-_]?key|cookie|credential|password|private[-_]?key|prompt|secret|token)/i;

export function normalizeJson(value: JsonValue): JsonValue {
  if (Array.isArray(value)) return value.map(normalizeJson);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, nested]) => [key, normalizeJson(nested)]),
    );
  }
  return value;
}

export function validateAuditPayload(payload: JsonObject | undefined): JsonObject {
  const value = payload ?? {};
  assertSafePayload(value);
  const normalized = normalizeJson(value);
  const serialized = JSON.stringify(normalized);
  if (serialized.length > 16_384) throw new Error("AUDIT_PAYLOAD_TOO_LARGE");
  return normalized as JsonObject;
}

function assertSafePayload(value: JsonValue): void {
  if (Array.isArray(value)) {
    for (const item of value) assertSafePayload(item);
    return;
  }
  if (value === null || typeof value !== "object") return;
  for (const [key, nested] of Object.entries(value)) {
    if (sensitiveKey.test(key)) throw new Error("AUDIT_PAYLOAD_SENSITIVE_KEY");
    assertSafePayload(nested);
  }
}

export function computeAuditEventHash(event: Omit<AuditEvent, "eventHash">): string {
  const material = normalizeJson({
    actionId: event.actionId,
    actorId: event.actorId,
    actorType: event.actorType,
    createdAt: canonicalTimestamp(event.createdAt),
    environmentId: event.environmentId,
    eventType: event.eventType,
    id: event.id,
    mandateId: event.mandateId,
    outcome: event.outcome,
    payload: event.payload,
    previousHash: event.previousHash,
    reasonCode: event.reasonCode,
    sessionId: event.sessionId,
  });
  return createHash("sha256").update(JSON.stringify(material)).digest("hex");
}

function canonicalTimestamp(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) throw new Error("AUDIT_TIMESTAMP_INVALID");
  return parsed.toISOString();
}

export function verifyAuditChain(events: readonly AuditEvent[]): boolean {
  let previousHash: string | null = null;
  for (const event of events) {
    if (event.previousHash !== previousHash) return false;
    if (computeAuditEventHash(event) !== event.eventHash) return false;
    previousHash = event.eventHash;
  }
  return true;
}

export function createAuditEvent(input: AuditEventInput, previousHash: string | null): AuditEvent {
  const event: Omit<AuditEvent, "eventHash"> = {
    id: input.id ?? randomUUID(),
    environmentId: input.environmentId,
    actorType: input.actorType,
    actorId: input.actorId ?? null,
    sessionId: input.sessionId ?? null,
    mandateId: input.mandateId ?? null,
    actionId: input.actionId ?? null,
    eventType: input.eventType,
    outcome: input.outcome,
    reasonCode: input.reasonCode ?? null,
    payload: validateAuditPayload(input.payload),
    previousHash,
    createdAt: canonicalTimestamp(input.createdAt ?? new Date().toISOString()),
  };
  return { ...event, eventHash: computeAuditEventHash(event) };
}

export const observabilityPhase = "tamper-evident-audit-events" as const;
