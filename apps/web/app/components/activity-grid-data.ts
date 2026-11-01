export type ActivityGridRow = {
  id: string;
  eventType: string;
  outcome: "success" | "denied" | "failure";
  actorType: string;
  reasonCode: string;
  createdAt: string;
};

export type ActivityEventInput = {
  id: string;
  eventType: string;
  outcome: "success" | "denied" | "failure";
  actorType: string;
  reasonCode?: string | null;
  createdAt: string;
};

export function buildActivityRows(events: ActivityEventInput[]): ActivityGridRow[] {
  return events.map((e) => ({
    id: e.id,
    eventType: e.eventType,
    outcome: e.outcome,
    actorType: e.actorType,
    reasonCode: e.reasonCode ?? "—",
    createdAt: new Date(e.createdAt).toLocaleString(),
  }));
}
