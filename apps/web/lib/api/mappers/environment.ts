import type { EnvironmentDto } from "@payguardian/contracts";
import type { Environment } from "../../../app/lib/workspace-store";

/**
 * Maps a backend EnvironmentDto to the frontend Environment model.
 */
export function mapEnvironmentDto(
  dto: EnvironmentDto,
  extra?: Partial<Environment>,
): Environment {
  const slug =
    extra?.slug ||
    dto.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") ||
    "env";

  const budgetLimitMinor = dto.budgetLimitMinor ?? 0;
  const spentMinor = extra?.spentMinor ?? 0;
  const reservedMinor = extra?.reservedMinor ?? 0;
  const availableMinor = Math.max(0, budgetLimitMinor - spentMinor - reservedMinor);

  return {
    id: dto.id,
    name: dto.name,
    slug,
    purpose: dto.purpose || "Autonomous Delegation & Financial Authority Boundary",
    currency: dto.currency || "USD",
    budgetLimitMinor,
    spentMinor,
    reservedMinor,
    availableMinor,
    status: dto.status === "paused" ? "paused" : dto.status === "revoked" ? "revoked" : "active",
    type: extra?.type ?? "sandbox",
    createdAt: dto.createdAt || new Date().toISOString(),
    expiresAt: extra?.expiresAt ?? new Date(Date.now() + 90 * 86400 * 1000).toISOString(),
    agentCount: extra?.agentCount ?? 1,
    pendingApprovalsCount: extra?.pendingApprovalsCount ?? 0,
    maxDelegationDepth: extra?.maxDelegationDepth ?? 2,
    approvalThresholdMinor:
      extra?.approvalThresholdMinor ?? Math.round(budgetLimitMinor * 0.1),
    allowedRails: extra?.allowedRails ?? ["PayPal", "Simulation"],
    consentStatement:
      extra?.consentStatement ??
      `By proceeding, you grant authority to environment '${dto.name}' to execute bounded transactions under strict cryptographic delegation.`,
  };
}
