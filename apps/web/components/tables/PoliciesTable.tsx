"use client";

import * as React from "react";
import { SlidersHorizontal, Info, Check } from "lucide-react";
import { formatMinorUnits, parseMajorToMinor, minorToMajorString } from "../../app/lib/currency";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "../ui/dialog";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { DEFAULT_POLICIES, type PolicyRow } from "./types";

export interface PoliciesTableProps {
  className?: string;
}

export function PoliciesTable({ className = "" }: PoliciesTableProps) {
  const [policies, setPolicies] = React.useState<PolicyRow[]>(DEFAULT_POLICIES);
  const [editingPolicy, setEditingPolicy] = React.useState<PolicyRow | null>(null);
  const [formSingleAction, setFormSingleAction] = React.useState<string>("");
  const [formApprovalThreshold, setFormApprovalThreshold] = React.useState<string>("");
  const [formMaxShare, setFormMaxShare] = React.useState<number>(40);
  const [isSaving, setIsSaving] = React.useState<boolean>(false);

  const handleOpenEdit = (policy: PolicyRow) => {
    setEditingPolicy(policy);
    setFormSingleAction(minorToMajorString(policy.singleActionLimitMinor, policy.currency));
    setFormApprovalThreshold(minorToMajorString(policy.approvalThresholdMinor, policy.currency));
    setFormMaxShare(policy.maxSharePercent);
  };

  const handleSavePolicy = async () => {
    if (!editingPolicy) return;
    setIsSaving(true);
    try {
      const nextSingleActionMinor = parseMajorToMinor(formSingleAction || "0", editingPolicy.currency);
      const nextThresholdMinor = parseMajorToMinor(formApprovalThreshold || "0", editingPolicy.currency);

      setPolicies((prev) =>
        prev.map((p) =>
          p.id === editingPolicy.id
            ? {
                ...p,
                singleActionLimitMinor: nextSingleActionMinor,
                approvalThresholdMinor: nextThresholdMinor,
                maxSharePercent: formMaxShare,
                updatedAt: new Date().toISOString(),
              }
            : p
        )
      );
      setEditingPolicy(null);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className={`mx-auto w-full max-w-[1200px] space-y-4 ${className}`}>
      <div>
        <h2 className="text-sm font-semibold text-foreground">Policies</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Cryptographic boundaries, autonomous sign-off limits, and category allowlists enforced per agent node.
        </p>
      </div>

      {/* Structured Policy Table */}
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-border bg-card text-xs font-medium text-muted-foreground">
              <th className="py-2.5 px-3 font-medium">Agent Node</th>
              <th className="py-2.5 px-3 font-medium">Max Share</th>
              <th className="py-2.5 px-3 font-medium text-right">Autonomous Limit</th>
              <th className="py-2.5 px-3 font-medium text-right">Approval Over</th>
              <th className="py-2.5 px-3 font-medium">Allowed Categories</th>
              <th className="py-2.5 px-3 font-medium">Depth</th>
              <th className="py-2.5 px-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {policies.map((policy) => (
              <tr key={policy.id} className="hover:bg-secondary transition-colors">
                <td className="py-3 px-3">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-foreground">{policy.agentName}</span>
                    <span className="text-[11px] text-muted-foreground">{policy.role}</span>
                  </div>
                </td>
                <td className="py-3 px-3 font-mono tabular-nums text-muted-foreground">
                  {policy.maxSharePercent}%
                </td>
                <td className="py-3 px-3 font-mono tabular-nums text-right text-foreground">
                  {formatMinorUnits(policy.singleActionLimitMinor, policy.currency)}
                </td>
                <td className="py-3 px-3 font-mono tabular-nums text-right text-foreground">
                  {formatMinorUnits(policy.approvalThresholdMinor, policy.currency)}
                </td>
                <td className="py-3 px-3">
                  <div className="flex flex-wrap gap-1">
                    {policy.allowedCategories.map((cat) => (
                      <span
                        key={cat}
                        className="rounded border border-border bg-secondary px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground"
                      >
                        {cat}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="py-3 px-3 font-mono tabular-nums text-muted-foreground">
                  &le; {policy.maxDelegationDepth}
                </td>
                <td className="py-3 px-3">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleOpenEdit(policy)}
                    className="h-7 px-2.5 text-[11px]"
                  >
                    <SlidersHorizontal className="mr-1 h-3 w-3" />
                    Amend Limit
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Limit Amendment Modal with Strict Invariant Notice */}
      <Dialog open={!!editingPolicy} onOpenChange={(open) => !open && setEditingPolicy(null)}>
        <DialogContent className="sm:max-w-md bg-secondary border-border text-foreground">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold text-foreground">
              Amend Mandate Limit: {editingPolicy?.agentName}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Update spending boundaries for this agent node. Changes are cryptographically signed.
            </DialogDescription>
          </DialogHeader>

          {/* Strict Invariant Notice */}
          <div className="rounded-lg border border-warning/30 bg-warning/10 p-3 text-xs">
            <div className="flex items-start gap-2.5">
              <Info className="h-4 w-4 text-warning shrink-0 mt-0.5" />
              <div>
                <strong className="font-semibold text-warning">Accounting Invariant: </strong>
                <span className="text-foreground">
                  Spent budget is never reset upon limit increase. Historical deductions remain permanently recorded.
                </span>
              </div>
            </div>
          </div>

          <div className="space-y-3.5 text-xs">
            <div>
              <label className="block text-muted-foreground mb-1 font-medium">
                Single-Action Autonomous Limit ({editingPolicy?.currency}):
              </label>
              <Input
                type="text"
                value={formSingleAction}
                onChange={(e) => setFormSingleAction(e.target.value)}
                placeholder="500.00"
                className="bg-card border-border font-mono text-xs"
              />
              <span className="text-[10px] text-muted-foreground mt-0.5 block">
                Payments up to this amount execute without human sign-off.
              </span>
            </div>

            <div>
              <label className="block text-muted-foreground mb-1 font-medium">
                Human Approval Threshold ({editingPolicy?.currency}):
              </label>
              <Input
                type="text"
                value={formApprovalThreshold}
                onChange={(e) => setFormApprovalThreshold(e.target.value)}
                placeholder="500.00"
                className="bg-card border-border font-mono text-xs"
              />
              <span className="text-[10px] text-muted-foreground mt-0.5 block">
                Payments exceeding this require passkey human confirmation.
              </span>
            </div>

            <div>
              <label className="block text-muted-foreground mb-1 font-medium">
                Max Share of Environment Budget ({formMaxShare}%):
              </label>
              <input
                type="range"
                min="5"
                max="100"
                step="5"
                value={formMaxShare}
                onChange={(e) => setFormMaxShare(Number(e.target.value))}
                className="w-full accent-success cursor-pointer"
              />
            </div>
          </div>

          <DialogFooter className="mt-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setEditingPolicy(null)}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleSavePolicy}
              disabled={isSaving}
              className="bg-success hover:bg-success text-black font-semibold text-xs"
            >
              <Check className="mr-1.5 h-3.5 w-3.5" />
              Apply Policy Update
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
