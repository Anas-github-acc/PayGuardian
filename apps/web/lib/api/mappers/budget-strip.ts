import type { EnvironmentDto, LedgerAccountDto, MandateDto } from "@payguardian/contracts";
import type { Environment, EnvironmentStatus } from "@/app/lib/workspace-store";

export function mapBudgetStrip(
  dto: EnvironmentDto,
  ledgerAccounts: LedgerAccountDto[] = [],
  mandates: MandateDto[] = [],
  pendingApprovalsCount = 0,
  agentCount = 0,
): Environment {
  // Aggregate ledger figures if accounts are present
  let availableMinor = 0;
  let reservedMinor = 0;
  let spentMinor = 0;

  if (ledgerAccounts.length > 0) {
    for (const acc of ledgerAccounts) {
      availableMinor += acc.availableMinor;
      reservedMinor += acc.reservedMinor;
      spentMinor += acc.capturedMinor;
    }
  } else if (mandates.length > 0) {
    // Derive from root mandate if available
    const rootMandate = mandates.find((m) => !m.parentMandateId) || mandates[0];
    spentMinor = rootMandate.spentMinor;
    reservedMinor = rootMandate.reservedMinor;
    availableMinor = Math.max(0, rootMandate.budgetLimitMinor - spentMinor - reservedMinor);
  } else {
    availableMinor = dto.budgetLimitMinor;
  }

  const mappedStatus: EnvironmentStatus =
    dto.status === "active"
      ? "active"
      : dto.status === "paused"
      ? "paused"
      : "revoked";

  return {
    id: dto.id,
    name: dto.name,
    slug: dto.name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
    purpose: dto.purpose,
    currency: dto.currency,
    budgetLimitMinor: dto.budgetLimitMinor,
    spentMinor,
    reservedMinor,
    availableMinor,
    status: mappedStatus,
    type: "sandbox",
    createdAt: dto.createdAt,
    expiresAt: new Date(new Date(dto.createdAt).getTime() + 30 * 24 * 3600 * 1000).toISOString(),
    agentCount,
    pendingApprovalsCount,
  };
}
