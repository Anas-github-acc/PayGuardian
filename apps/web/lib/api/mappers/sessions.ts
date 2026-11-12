import type { SessionDto } from "@payguardian/contracts";
import type { SessionItem } from "../types";

function formatRelativeTime(isoString: string): string {
  try {
    const diffMs = Date.now() - new Date(isoString).getTime();
    const mins = Math.floor(diffMs / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  } catch {
    return "recently";
  }
}

export function mapSessionDtoToItem(dto: SessionDto): SessionItem {
  const status: "active" | "waiting for you" | "done" =
    dto.status === "completed" || dto.status === "cancelled"
      ? "done"
      : dto.status === "paused"
        ? "waiting for you"
        : "active";

  const description =
    typeof dto.context?.description === "string"
      ? dto.context.description
      : `Workflow task session in status ${dto.status}`;

  return {
    id: dto.id,
    title: dto.name,
    description,
    status,
    lastActivity: formatRelativeTime(dto.updatedAt),
    agentCount: dto.agentId ? 1 : 0,
  };
}

export function mapSessionsToItems(dtos: SessionDto[]): SessionItem[] {
  return dtos.map(mapSessionDtoToItem);
}
