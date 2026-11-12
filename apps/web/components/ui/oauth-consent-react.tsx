"use client";

import * as React from "react";
import Image from "next/image";
import { ShieldCheck, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  useOAuthConsent,
  type OAuthConsentDecision,
} from "@/components/ui/oauth-consent-react-utils/use-oauth-consent";
import { Button } from "@/components/ui/button";
import { PayPalCheckoutButton } from "./paypal-checkout-button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface ConsentCardShellProps extends React.ComponentPropsWithoutRef<"div"> {
  clientName: string;
  productName: string;
}

function formatMoney(amountMinor?: number, currency = "USD") {
  if (amountMinor === undefined) return null;
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: currency.toUpperCase(),
    }).format(amountMinor / 100);
  } catch {
    return `${(amountMinor / 100).toFixed(2)} ${currency}`;
  }
}

function ConsentCardShell({
  clientName,
  productName,
  className,
  children,
  ...props
}: ConsentCardShellProps) {
  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card className="border-border bg-card shadow-xl overflow-hidden">
        <CardHeader className="items-center space-y-4 text-center pb-2">
          {/* Top connection header with PayPal & PayGuardian icons */}
          <div
            className="flex items-center justify-center gap-3 pt-2"
            aria-label={`${clientName} connecting to ${productName}`}
          >
            <div className="flex size-14 items-center justify-center rounded-2xl border border-blue-500/20 bg-blue-500/10 p-2.5 shadow-inner">
              <Image
                src="/paypal.svg"
                alt="PayPal"
                width={32}
                height={32}
                className="size-8 object-contain"
              />
            </div>
            <div className="flex items-center">
              <div className="h-0.5 w-6 bg-gradient-to-r from-blue-500/40 to-cyan-400/40" />
              <div className="size-2 rounded-full bg-cyan-400 animate-pulse" />
              <div className="h-0.5 w-6 bg-gradient-to-r from-cyan-400/40 to-blue-500/40" />
            </div>
            <div className="flex size-14 items-center justify-center rounded-2xl border border-cyan-500/20 bg-cyan-500/10 p-2.5 shadow-inner">
              <Image
                src="/payguardian.svg"
                alt="PayGuardian"
                width={32}
                height={32}
                className="size-8 object-contain"
              />
            </div>
          </div>
          <div className="space-y-1.5 pt-1">
            <CardTitle className="text-xl font-bold tracking-tight text-foreground">
              Authorize {clientName}
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              Review transaction requested under delegated child authority.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-6 pt-2">{children}</CardContent>
      </Card>
    </div>
  );
}

export interface OAuthConsentCardProps extends React.ComponentPropsWithoutRef<"div"> {
  environmentId?: string;
  approvalId?: string;
  actionId?: string;
  clientName: string;
  productName?: string;
  redirectUri: string;
  email: string;
  scopes?: string[];
  amountMinor?: number;
  currency?: string;
  recipient?: string;
  action?: string;
  mandateId?: string;
  approvalUrl?: string;
  error?: string | null;
  decision?: OAuthConsentDecision | null;
  onApprove?: () => void;
  onPaymentSuccess?: (captureResult: any) => void | Promise<void>;
  onDeny?: () => void;
}

export function OAuthConsentCard({
  environmentId,
  approvalId,
  actionId,
  clientName,
  productName = "PayGuardian Gateway",
  redirectUri,
  email,
  scopes = [],
  amountMinor,
  currency = "USD",
  recipient,
  action,
  mandateId,
  approvalUrl,
  error = null,
  decision = null,
  onApprove,
  onPaymentSuccess,
  onDeny,
  ...props
}: OAuthConsentCardProps) {
  const formattedAmount = formatMoney(amountMinor, currency);
  const isRealPayPalUrl = (url?: string | null): boolean => {
    if (!url) return false;
    if (url.includes("ORDER-") || url.includes("simulated")) return false;
    return (
      url.startsWith("https://www.sandbox.paypal.com") || url.startsWith("https://www.paypal.com")
    );
  };
  const effectiveApprovalUrl = isRealPayPalUrl(approvalUrl) ? approvalUrl : null;

  return (
    <ConsentCardShell clientName={clientName} productName={productName} {...props}>
      <dl className="divide-y divide-border/60 rounded-xl border border-border/80 bg-muted/20 text-sm overflow-hidden">
        {formattedAmount && (
          <div className="flex items-center justify-between gap-6 p-3.5 bg-blue-500/5">
            <dt className="text-muted-foreground font-medium">Payment Amount</dt>
            <dd className="min-w-0 font-mono text-base font-bold text-blue-400">
              {formattedAmount}
            </dd>
          </div>
        )}
        {recipient && (
          <div className="flex items-center justify-between gap-6 p-3.5">
            <dt className="text-muted-foreground">Merchant / Recipient</dt>
            <dd className="min-w-0 break-all text-right font-medium text-foreground">
              {recipient}
            </dd>
          </div>
        )}
        {mandateId && (
          <div className="flex items-center justify-between gap-6 p-3.5">
            <dt className="text-muted-foreground">Child Mandate</dt>
            <dd className="min-w-0 font-mono text-xs text-right text-cyan-400">{mandateId}</dd>
          </div>
        )}
        <div className="flex items-center justify-between gap-6 p-3.5">
          <dt className="text-muted-foreground">Specialist Subagent</dt>
          <dd className="min-w-0 break-all text-right font-medium text-foreground">{clientName}</dd>
        </div>
        <div className="flex items-center justify-between gap-6 p-3.5">
          <dt className="text-muted-foreground">Settlement Route</dt>
          <dd className="min-w-0 break-all text-right font-medium text-muted-foreground">
            {redirectUri}
          </dd>
        </div>
        <div className="flex items-center justify-between gap-6 p-3.5">
          <dt className="text-muted-foreground">Authorized Operator</dt>
          <dd className="min-w-0 break-all text-right font-medium text-foreground">{email}</dd>
        </div>
        {scopes.length > 0 && (
          <div className="flex items-center justify-between gap-6 p-3.5">
            <dt className="text-muted-foreground">Verified Scope</dt>
            <dd className="min-w-0 break-all text-right font-medium text-foreground">
              <div className="flex flex-wrap justify-end gap-1">
                {scopes.map((s) => (
                  <span key={s} className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px]">
                    {s}
                  </span>
                ))}
              </div>
            </dd>
          </div>
        )}
      </dl>
      <p className="text-xs text-muted-foreground leading-relaxed">
        Allow payment only if you recognize this subagent and merchant. The transaction is strictly
        limited to the verified cryptographic child mandate bounds and cannot exceed your delegated
        budget.
      </p>
      {error && (
        <div
          role="alert"
          className="flex items-center gap-2 rounded-lg bg-destructive/10 p-3 text-xs text-destructive"
        >
          <AlertCircle className="size-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}
      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-end pt-2">
        <Button
          type="button"
          variant="outline"
          disabled={decision !== null}
          onClick={onDeny}
          className="border-border text-foreground hover:bg-muted font-medium h-10"
        >
          {decision === "deny" ? "Denying..." : "Deny"}
        </Button>
        <div className="w-full sm:w-auto min-w-[200px]">
          <PayPalCheckoutButton
            environmentId={environmentId || "default"}
            mandateId={mandateId}
            approvalId={approvalId}
            actionId={actionId}
            action={action}
            amountMinor={amountMinor || 15000}
            currency={currency}
            recipient={recipient}
            clientName={clientName}
            onSuccess={async (captureResult) => {
              if (onPaymentSuccess) {
                await onPaymentSuccess(captureResult);
              } else if (onApprove) {
                onApprove();
              }
            }}
            onCancel={onDeny}
          />
        </div>
      </div>
      {effectiveApprovalUrl && (
        <div className="pt-2 text-center border-t border-border/40">
          <a
            href={effectiveApprovalUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-blue-400 hover:text-blue-300 underline font-medium inline-flex items-center gap-1.5"
          >
            <span>Proceed directly to PayPal Checkout</span>
            <span>&rarr;</span>
          </a>
        </div>
      )}
    </ConsentCardShell>
  );
}

interface OAuthConsentProps extends React.ComponentPropsWithoutRef<"div"> {
  authorizationId?: string | null;
  signInPath?: string;
  productName?: string;
}

export function OAuthConsent({
  authorizationId,
  signInPath = "/auth/login",
  productName = "PayGuardian Gateway",
  ...props
}: OAuthConsentProps) {
  const { details, email, error, isLoading, decision, approve, deny } = useOAuthConsent({
    authorizationId,
    signInPath,
  });

  if (isLoading || !details || !email) {
    return (
      <ConsentCardShell clientName="Subagent Payment" productName={productName} {...props}>
        {isLoading ? (
          <p role="status" className="text-sm text-muted-foreground text-center py-6">
            Loading authorization request...
          </p>
        ) : (
          <p role="alert" className="text-sm text-destructive text-center py-6">
            {error ??
              "Unable to load the authorization request. Start again from your agent console."}
          </p>
        )}
      </ConsentCardShell>
    );
  }

  return (
    <OAuthConsentCard
      clientName={details.client.name}
      productName={productName}
      redirectUri={details.redirect_uri}
      email={email}
      scopes={details.scope.split(" ").filter(Boolean)}
      error={error}
      decision={decision}
      onApprove={() => void approve()}
      onDeny={() => void deny()}
      {...props}
    />
  );
}

export default OAuthConsentCard;
