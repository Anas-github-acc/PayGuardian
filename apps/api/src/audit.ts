import type { SupabaseClient } from "@supabase/supabase-js";
import {
  createAuditEvent,
  validateAuditPayload,
  verifyAuditChain,
  type AuditEvent,
  type AuditEventInput,
} from "@payguardian/observability";

export type AuditEventStore = {
  append(input: AuditEventInput): Promise<AuditEvent>;
  list(environmentId: string): Promise<AuditEvent[]>;
};

export class InMemoryAuditStore implements AuditEventStore {
  private readonly events = new Map<string, AuditEvent[]>();

  async append(input: AuditEventInput): Promise<AuditEvent> {
    const events = this.events.get(input.environmentId) ?? [];
    const event = createAuditEvent(input, events.at(-1)?.eventHash ?? null);
    events.push(event);
    this.events.set(input.environmentId, events);
    return { ...event, payload: structuredClone(event.payload) };
  }

  async list(environmentId: string): Promise<AuditEvent[]> {
    return (this.events.get(environmentId) ?? []).map((event) => ({
      ...event,
      payload: structuredClone(event.payload),
    }));
  }

  verify(environmentId: string): boolean {
    return verifyAuditChain(this.events.get(environmentId) ?? []);
  }
}

type Row = Record<string, unknown>;

export class SupabaseAuditStore implements AuditEventStore {
  constructor(private readonly client: SupabaseClient) {}

  async append(input: AuditEventInput): Promise<AuditEvent> {
    const createdAt = input.createdAt ?? new Date().toISOString();
    const payload = validateAuditPayload(input.payload);
    const id = input.id;
    const { data, error } = await this.client
      .rpc("append_audit_event", {
        p_id: id ?? null,
        p_environment_id: input.environmentId,
        p_actor_type: input.actorType,
        p_actor_id: input.actorId ?? null,
        p_session_id: input.sessionId ?? null,
        p_mandate_id: input.mandateId ?? null,
        p_action_id: input.actionId ?? null,
        p_event_type: input.eventType,
        p_outcome: input.outcome,
        p_reason_code: input.reasonCode ?? null,
        p_payload: payload,
        p_created_at: createdAt,
      })
      .single();
    if (error) throw error;
    return mapAuditEvent(data as Row);
  }

  async list(environmentId: string): Promise<AuditEvent[]> {
    const { data, error } = await this.client
      .from("audit_events")
      .select(
        "id,environment_id,actor_type,actor_id,session_id,mandate_id,action_id,event_type,outcome,reason_code,payload,previous_hash,event_hash,created_at",
      )
      .eq("environment_id", environmentId)
      .order("created_at", { ascending: true })
      .order("id", { ascending: true });
    if (error) throw error;
    const events = (data ?? []).map((row) => mapAuditEvent(row as Row));
    if (!verifyAuditChain(events)) throw new Error("AUDIT_CHAIN_INVALID");
    return events;
  }
}

function mapAuditEvent(row: Row): AuditEvent {
  return {
    id: String(row.id),
    environmentId: String(row.environment_id),
    actorType: row.actor_type as AuditEvent["actorType"],
    actorId: row.actor_id ? String(row.actor_id) : null,
    sessionId: row.session_id ? String(row.session_id) : null,
    mandateId: row.mandate_id ? String(row.mandate_id) : null,
    actionId: row.action_id ? String(row.action_id) : null,
    eventType: String(row.event_type),
    outcome: row.outcome as AuditEvent["outcome"],
    reasonCode: row.reason_code ? String(row.reason_code) : null,
    payload: (row.payload ?? {}) as AuditEvent["payload"],
    previousHash: row.previous_hash ? String(row.previous_hash) : null,
    eventHash: String(row.event_hash),
    createdAt: String(row.created_at),
  };
}

export function createAuditStore(client: SupabaseClient | null): AuditEventStore {
  return (process.env.DATABASE_MODE ?? "memory") === "supabase" && client
    ? new SupabaseAuditStore(client)
    : new InMemoryAuditStore();
}
