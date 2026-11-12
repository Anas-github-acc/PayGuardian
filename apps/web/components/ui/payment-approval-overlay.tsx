"use client";

import * as React from "react";
import { X } from "lucide-react";
import { OAuthConsentCard } from "./oauth-consent-react";

export interface PaymentApprovalOverlayProps {
  isOpen: boolean;
  environmentId?: string;
  approvalId?: string;
  actionId?: string;
  clientName: string;
  productName?: string;
  amountMinor?: number;
  currency?: string;
  recipient?: string;
  action?: string;
  mandateId?: string;
  approvalUrl?: string;
  redirectUri?: string;
  email?: string;
  scopes?: string[];
  onApprove: (captureResult?: any) => void | Promise<void>;
  onDeny: () => void | Promise<void>;
  onClose?: () => void;
}

export function PaymentApprovalOverlay({
  isOpen,
  environmentId,
  approvalId,
  actionId,
  clientName,
  productName = "PayGuardian Gateway",
  amountMinor,
  currency = "USD",
  recipient,
  action,
  mandateId,
  approvalUrl,
  redirectUri = "PayGuardian Gateway (PayPal Sandbox)",
  email = "operator@payguardian.local",
  scopes = ["payments:execute", "mandates:child:bind"],
  onApprove,
  onDeny,
  onClose,
}: PaymentApprovalOverlayProps) {
  const [decision, setDecision] = React.useState<"approve" | "deny" | null>(null);

  const isRealPayPalUrl = (url?: string | null): boolean => {
    if (!url) return false;
    if (url.includes("ORDER-") || url.includes("simulated")) return false;
    return url.startsWith("https://www.sandbox.paypal.com") || url.startsWith("https://www.paypal.com");
  };

  const effectiveApprovalUrl = isRealPayPalUrl(approvalUrl) ? approvalUrl : null;

  if (!isOpen) return null;

  const handleApprove = async (captureResult?: any) => {
    setDecision("approve");
    try {
      await onApprove(captureResult);
    } catch {
      // ignore
    } finally {
      setDecision(null);
    }
  };

  const handleDeny = async () => {
    setDecision("deny");
    try {
      await onDeny();
    } finally {
      setDecision(null);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4 animate-in fade-in duration-200"
    >
      <div className="relative w-full max-w-md animate-in zoom-in-95 duration-150">
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="absolute -top-3 -right-3 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-700 shadow-md border border-zinc-600 transition-colors cursor-pointer"
            aria-label="Close approval dialog"
          >
            <X className="h-4 w-4" />
          </button>
        )}
        <OAuthConsentCard
          environmentId={environmentId}
          approvalId={approvalId}
          actionId={actionId}
          clientName={clientName}
          productName={productName}
          redirectUri={redirectUri}
          email={email}
          amountMinor={amountMinor}
          currency={currency}
          recipient={recipient}
          action={action}
          mandateId={mandateId}
          approvalUrl={effectiveApprovalUrl ?? undefined}
          scopes={scopes}
          decision={decision}
          onApprove={handleApprove}
          onPaymentSuccess={onApprove}
          onDeny={handleDeny}
        />
      </div>
    </div>
  );
}

export default PaymentApprovalOverlay;
