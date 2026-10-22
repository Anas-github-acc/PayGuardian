import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

export type ProviderEventRecord = {
  provider: "paypal";
  providerEventId: string;
  eventType: string;
  providerOrderId: string | null;
  captureId: string | null;
  observedStatus: string | null;
  payloadHash: string;
  verificationState: "verified" | "rejected";
  processingState: "received" | "applied" | "ignored";
  eventOccurredAt: string | null;
  receivedAt: string;
};

export type ProviderEventStore = {
  record(input: {
    event: unknown;
    providerEventId: string;
    eventType: string;
    providerOrderId: string | null;
    captureId: string | null;
    observedStatus: string | null;
    eventOccurredAt: string | null;
    verificationState: "verified" | "rejected";
  }): Promise<{ event: ProviderEventRecord; duplicate: boolean }>;
  markApplied(providerEventId: string): Promise<void>;
};

export function payloadHash(event: unknown): string {
  return createHash("sha256")
    .update(JSON.stringify(event, Object.keys((event ?? {}) as object).sort()))
    .digest("hex");
}

export class InMemoryProviderEventStore implements ProviderEventStore {
  private readonly events = new Map<string, ProviderEventRecord>();

  async record(input: {
    event: unknown;
    providerEventId: string;
    eventType: string;
    providerOrderId: string | null;
    captureId: string | null;
    observedStatus: string | null;
    eventOccurredAt: string | null;
    verificationState: "verified" | "rejected";
  }): Promise<{ event: ProviderEventRecord; duplicate: boolean }> {
    const existing = this.events.get(input.providerEventId);
    if (existing) return { event: { ...existing }, duplicate: true };
    const event: ProviderEventRecord = {
      provider: "paypal",
      providerEventId: input.providerEventId,
      eventType: input.eventType,
      providerOrderId: input.providerOrderId,
      captureId: input.captureId,
      observedStatus: input.observedStatus,
      payloadHash: payloadHash(input.event),
      verificationState: input.verificationState,
      processingState: "received",
      eventOccurredAt: input.eventOccurredAt,
      receivedAt: new Date().toISOString(),
    };
    this.events.set(event.providerEventId, event);
    return { event: { ...event }, duplicate: false };
  }

  async markApplied(providerEventId: string): Promise<void> {
    const event = this.events.get(providerEventId);
    if (event) this.events.set(providerEventId, { ...event, processingState: "applied" });
  }
}

type Row = Record<string, unknown>;

export class SupabaseProviderEventStore implements ProviderEventStore {
  constructor(private readonly client: SupabaseClient) {}

  async record(input: {
    event: unknown;
    providerEventId: string;
    eventType: string;
    providerOrderId: string | null;
    captureId: string | null;
    observedStatus: string | null;
    eventOccurredAt: string | null;
    verificationState: "verified" | "rejected";
  }): Promise<{ event: ProviderEventRecord; duplicate: boolean }> {
    const existing = await this.client
      .from("provider_events")
      .select(
        "provider,provider_event_id,event_type,provider_order_id,capture_id,observed_status,payload_hash,verification_state,processing_state,event_occurred_at,received_at",
      )
      .eq("provider", "paypal")
      .eq("provider_event_id", input.providerEventId)
      .maybeSingle();
    if (existing.error) throw existing.error;
    if (existing.data) return { event: mapEvent(existing.data as Row), duplicate: true };
    const { data, error } = await this.client
      .from("provider_events")
      .insert({
        provider: "paypal",
        provider_event_id: input.providerEventId,
        event_type: input.eventType,
        provider_order_id: input.providerOrderId,
        capture_id: input.captureId,
        observed_status: input.observedStatus,
        payload_hash: payloadHash(input.event),
        verification_state: input.verificationState,
        event_occurred_at: input.eventOccurredAt,
      })
      .select(
        "provider,provider_event_id,event_type,provider_order_id,capture_id,observed_status,payload_hash,verification_state,processing_state,event_occurred_at,received_at",
      )
      .single();
    if (error) {
      const retry = await this.client
        .from("provider_events")
        .select(
          "provider,provider_event_id,event_type,provider_order_id,capture_id,observed_status,payload_hash,verification_state,processing_state,event_occurred_at,received_at",
        )
        .eq("provider", "paypal")
        .eq("provider_event_id", input.providerEventId)
        .single();
      if (retry.error) throw error;
      return { event: mapEvent(retry.data as Row), duplicate: true };
    }
    return { event: mapEvent(data as Row), duplicate: false };
  }

  async markApplied(providerEventId: string): Promise<void> {
    const { error } = await this.client
      .from("provider_events")
      .update({ processing_state: "applied", processed_at: new Date().toISOString() })
      .eq("provider", "paypal")
      .eq("provider_event_id", providerEventId);
    if (error) throw error;
  }
}

function mapEvent(row: Row): ProviderEventRecord {
  return {
    provider: "paypal",
    providerEventId: String(row.provider_event_id),
    eventType: String(row.event_type),
    providerOrderId: row.provider_order_id ? String(row.provider_order_id) : null,
    captureId: row.capture_id ? String(row.capture_id) : null,
    observedStatus: row.observed_status ? String(row.observed_status) : null,
    payloadHash: String(row.payload_hash),
    verificationState: row.verification_state as ProviderEventRecord["verificationState"],
    processingState: row.processing_state as ProviderEventRecord["processingState"],
    eventOccurredAt: row.event_occurred_at ? String(row.event_occurred_at) : null,
    receivedAt: String(row.received_at),
  };
}

export function createProviderEventStore(client: SupabaseClient | null): ProviderEventStore {
  if ((process.env.DATABASE_MODE ?? "memory") === "supabase") {
    if (!client) throw new Error("DATABASE_MODE=supabase requires Supabase credentials");
    return new SupabaseProviderEventStore(client);
  }
  return new InMemoryProviderEventStore();
}
