import type { AuditEventDto } from "@payguardian/contracts";
import type { ActivityFeedItem } from "../types";

function formatTimestamp(isoString: string): string {
  try {
    const d = new Date(isoString);
    return d.toTimeString().slice(0, 8);
  } catch {
    return isoString;
  }
}

export function mapAuditEventToFeedItem(
  event: AuditEventDto,
  actorNameLookup?: Record<string, string>,
): ActivityFeedItem {
  const payload = event.payload as Record<string, unknown> | undefined;
  const rawAmount = payload?.amountMinor ?? payload?.amount_minor;
  const amountMinor = typeof rawAmount === "number" ? rawAmount : undefined;
  const currency = typeof payload?.currency === "string" ? payload.currency : undefined;

  let actorName = event.actorType === "user" ? "You (Operator)" : "Autonomous Agent";
  if (event.actorId) {
    if (actorNameLookup && actorNameLookup[event.actorId]) {
      actorName = actorNameLookup[event.actorId];
    } else {
      actorName = `Agent (${event.actorId.slice(0, 8)})`;
    }
  }

  const isSimulation = event.eventType.toLowerCase().includes("simulation");
  const outcome: "success" | "denied" | "pending" =
    event.outcome === "success" ? "success" : event.outcome === "denied" ? "denied" : "pending";

  let action = event.eventType.replace(/_/g, " ");
  if (typeof payload?.purpose === "string" && payload.purpose.trim() !== "") {
    action = payload.purpose;
  } else if (typeof payload?.action === "string" && payload.action.trim() !== "") {
    action = payload.action;
  }

  return {
    id: event.id,
    timestamp: formatTimestamp(event.createdAt),
    actorName,
    action,
    amountMinor,
    currency,
    outcome,
    reasonCode: event.reasonCode ?? undefined,
    isSimulation,
    traceId: event.actionId ? `trace-${event.actionId}` : undefined,
  };
}

export function mapAuditEventsToFeed(
  events: AuditEventDto[],
  actorNameLookup?: Record<string, string>,
): ActivityFeedItem[] {
  return events.map((evt) => mapAuditEventToFeedItem(evt, actorNameLookup));
}
