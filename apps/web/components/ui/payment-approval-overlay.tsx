"use client";

import * as React from "react";
import { OAuthConsentCard } from "./oauth-consent-react";

export interface PaymentApprovalOverlayProps {
  isOpen: boolean;
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
  onApprove: () => void | Promise<void>;
  onDeny: () => void | Promise<void>;
}

export function PaymentApprovalOverlay({
  isOpen,
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
}: PaymentApprovalOverlayProps) {
  const [decision, setDecision] = React.useState<"approve" | "deny" | null>(null);

  if (!isOpen) return null;

  const handleApprove = async () => {
    setDecision("approve");
    try {
      if (approvalUrl) {
        window.open(approvalUrl, "_blank", "noopener,noreferrer");
      }
      await onApprove();
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
      <div className="w-full max-w-md animate-in zoom-in-95 duration-150">
        <OAuthConsentCard
          clientName={clientName}
          productName={productName}
          redirectUri={redirectUri}
          email={email}
          amountMinor={amountMinor}
          currency={currency}
          recipient={recipient}
          action={action}
          mandateId={mandateId}
          scopes={scopes}
          decision={decision}
          onApprove={handleApprove}
          onDeny={handleDeny}
        />
      </div>
    </div>
  );
}

export default PaymentApprovalOverlay;
