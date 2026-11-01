"use client";

import * as React from "react";
import {
  AlertTriangle,
  ShieldAlert,
  Trash2,
  X,
  Check,
  Building2,
  Layers,
} from "lucide-react";
import { formatMinorUnits } from "../../app/lib/currency";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "../ui/dialog";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Badge } from "../ui/badge";
import type { RevocationSubtreeImpact } from "./types";

export interface RevocationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  impact: RevocationSubtreeImpact | null;
  onConfirmRevoke: (mandateId: string) => Promise<void> | void;
  isProcessing?: boolean;
}

export function RevocationDialog({
  isOpen,
  onClose,
  impact,
  onConfirmRevoke,
  isProcessing = false,
}: RevocationDialogProps) {
  const [confirmInput, setConfirmInput] = React.useState<string>("");

  if (!impact) return null;

  const requiresInputMatch = impact.cascadeAgentsCount > 1;
  const isInputValid = !requiresInputMatch || confirmInput.trim().toUpperCase() === "REVOKE";

  const handleConfirm = async () => {
    if (!isInputValid || isProcessing) return;
    await onConfirmRevoke(impact.targetMandateId);
    setConfirmInput("");
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg bg-secondary border-destructive/40 text-foreground top-shade">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-destructive/20 text-destructive">
              <ShieldAlert className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold text-destructive">
                Revoke Authority: {impact.targetAgentName}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Irreversible cryptographic mandate invalidation.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Mandatory Truth-in-Accounting Warning */}
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3.5 text-xs text-foreground">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
            <div className="space-y-1">
              <strong className="font-semibold text-destructive">
                Truth-in-Accounting Invariant:
              </strong>
              <p className="leading-relaxed text-foreground/90">
                Revoking stops future actions immediately, but cannot undo completed external transactions.
              </p>
            </div>
          </div>
        </div>

        {/* Subtree Cascade Impact Preview */}
        <div className="space-y-3 text-xs">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono">
            Downstream Subtree Impact Preview
          </div>

          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-md border border-border bg-card p-2.5">
              <span className="text-[10px] uppercase text-muted-foreground block">Target Mandate</span>
              <span className="font-mono text-xs text-foreground truncate block mt-0.5">
                {impact.targetMandateId}
              </span>
            </div>
            <div className="rounded-md border border-border bg-card p-2.5">
              <span className="text-[10px] uppercase text-muted-foreground block">Affected Agents</span>
              <span className="font-mono text-base font-bold text-destructive block mt-0.5">
                {impact.cascadeAgentsCount}
              </span>
            </div>
            <div className="rounded-md border border-border bg-card p-2.5">
              <span className="text-[10px] uppercase text-muted-foreground block">Held Reservations</span>
              <span className="font-mono text-xs text-warning block mt-0.5 tabular-nums">
                {formatMinorUnits(impact.heldReservationsMinor, impact.currency)}
              </span>
            </div>
          </div>

          {impact.childAgentNames.length > 0 && (
            <div className="rounded-md border border-border bg-card p-2.5 text-[11px]">
              <span className="text-muted-foreground block mb-1">
                Subtree child agents that will instantly lose all spending authority:
              </span>
              <div className="flex flex-wrap gap-1.5">
                {impact.childAgentNames.map((name) => (
                  <Badge key={name} variant="revoked" className="text-[10px]">
                    {name}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {requiresInputMatch && (
            <div>
              <label className="block text-muted-foreground mb-1 font-medium">
                Type <strong className="text-destructive">REVOKE</strong> to confirm subtree invalidation:
              </label>
              <Input
                type="text"
                value={confirmInput}
                onChange={(e) => setConfirmInput(e.target.value)}
                placeholder="REVOKE"
                className="bg-card border-border font-mono text-xs text-destructive focus:border-destructive"
              />
            </div>
          )}
        </div>

        <DialogFooter className="mt-4 gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="text-xs"
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={handleConfirm}
            disabled={!isInputValid || isProcessing}
            className="bg-destructive hover:bg-destructive/90 text-foreground font-bold text-xs"
          >
            <Trash2 className="mr-1.5 h-3.5 w-3.5" />
            {isProcessing ? "Revoking..." : "Confirm Revocation"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
