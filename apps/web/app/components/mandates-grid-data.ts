export type MandateGridRow = {
  id: string;
  holderAgentId: string;
  state: "active" | "expired" | "revoked";
  budgetLimit: string;
  spent: string;
  available: string;
  currency: string;
  permittedActions: string;
  approvalRequired: string;
  expiresAt: string;
};

export type MandateInput = {
  id: string;
  holderAgentId: string;
  state: "active" | "expired" | "revoked";
  budgetLimitMinor: number;
  spentMinor: number;
  allocatedMinor?: number;
  reservedMinor?: number;
  currency: string;
  permittedActions: string[];
  approvalRequired?: boolean;
  expiresAt: string;
};

export function buildMandateRows(mandates: MandateInput[]): MandateGridRow[] {
  return mandates.map((m) => {
    const allocated = m.allocatedMinor ?? 0;
    const spent = m.spentMinor ?? 0;
    const reserved = m.reservedMinor ?? 0;
    const availableMinor = Math.max(0, m.budgetLimitMinor - allocated - spent - reserved);
    return {
      id: m.id,
      holderAgentId: m.holderAgentId,
      state: m.state,
      budgetLimit: `${(m.budgetLimitMinor / 100).toFixed(2)} ${m.currency}`,
      spent: `${(spent / 100).toFixed(2)} ${m.currency}`,
      available: `${(availableMinor / 100).toFixed(2)} ${m.currency}`,
      currency: m.currency,
      permittedActions: m.permittedActions.join(", "),
      approvalRequired: m.approvalRequired ? "Yes" : "No",
      expiresAt: new Date(m.expiresAt).toLocaleDateString(),
    };
  });
}
