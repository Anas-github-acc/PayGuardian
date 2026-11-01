export type ApprovalGridRow = {
  id: string;
  status: "pending" | "approved" | "rejected";
  action: string;
  amount: string;
  currency: string;
  agentId: string;
  mandateId: string;
  approvedBy: string;
  rejectionReason: string;
  createdAt: string;
};

export type ApprovalInput = {
  id: string;
  status: "pending" | "approved" | "rejected";
  action: string;
  amountMinor: number;
  currency: string;
  agentId: string;
  mandateId: string;
  approvedBy: string | null;
  rejectionReason: string | null;
  createdAt: string;
};

export function buildApprovalRows(approvals: ApprovalInput[]): ApprovalGridRow[] {
  return approvals.map((a) => ({
    id: a.id,
    status: a.status,
    action: a.action,
    amount: `${(a.amountMinor / 100).toFixed(2)} ${a.currency}`,
    currency: a.currency,
    agentId: a.agentId,
    mandateId: a.mandateId,
    approvedBy: a.approvedBy ?? "—",
    rejectionReason: a.rejectionReason ?? "—",
    createdAt: new Date(a.createdAt).toLocaleString(),
  }));
}
