"use client";

import * as React from "react";
import Image from "next/image";
import {
  AlertCircle,
  CheckCircle2,
  DollarSign,
  KeyRound,
  Loader2,
  ShieldCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export type OAuthConsentDecision = "approve" | "deny";

export interface OAuthConsentCardProps extends React.ComponentPropsWithoutRef<"div"> {
  clientName: string;
  productName?: string;
  action?: string;
  amountMinor?: number;
  currency?: string;
  mandateId?: string;
  redirectUri?: string;
  email?: string;
  scopes?: string[];
  error?: string | null;
  decision?: OAuthConsentDecision | null;
  onApprove?: () => void;
  onDeny?: () => void;
}

const getInitial = (value: string) => value.trim().charAt(0).toUpperCase() || "?";

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

interface ConsentCardShellProps extends React.ComponentPropsWithoutRef<"div"> {
  clientName: string;
  productName: string;
}

function ConsentCardShell({
  clientName,
  productName,
  className,
  children,
  ...props
}: ConsentCardShellProps) {
  return (
    <div className={cn("flex flex-col gap-4 max-w-md w-full mx-auto", className)} {...props}>
      <Card glow className="overflow-hidden border-border/80 shadow-md">
        <CardHeader className="items-center space-y-3 text-center pb-3">
          <div
            className="flex items-center justify-center gap-3"
            aria-label={`${clientName} requesting approval for ${productName}`}
          >
            <div className="flex size-12 items-center justify-center rounded-2xl border border-blue-500/20 bg-blue-500/10 p-2 shadow-inner">
              <Image
                src="/paypal.svg"
                alt="PayPal"
                width={28}
                height={28}
                className="size-7 object-contain"
              />
            </div>
            <div className="flex items-center">
              <div className="h-0.5 w-4 bg-gradient-to-r from-blue-500/40 to-cyan-400/40" />
              <div className="size-1.5 rounded-full bg-cyan-400 animate-pulse" />
              <div className="h-0.5 w-4 bg-gradient-to-r from-cyan-400/40 to-blue-500/40" />
            </div>
            <div className="flex size-12 items-center justify-center rounded-2xl border border-cyan-500/20 bg-cyan-500/10 p-2 shadow-inner">
              <Image
                src="/payguardian.svg"
                alt="PayGuardian"
                width={28}
                height={28}
                className="size-7 object-contain"
              />
            </div>
          </div>
          <div className="space-y-1">
            <CardTitle className="text-base font-semibold tracking-tight">
              Action Approval Required
            </CardTitle>
            <CardDescription className="text-xs">
              <span className="font-medium text-foreground">{clientName}</span> is requesting
              authorization via <span className="font-medium text-foreground">{productName}</span>.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 pt-1">{children}</CardContent>
      </Card>
    </div>
  );
}

export function OAuthConsentCard({
  clientName,
  productName = "PayGuardian",
  action,
  amountMinor,
  currency = "USD",
  mandateId,
  redirectUri,
  email,
  scopes = [],
  error = null,
  decision = null,
  onApprove,
  onDeny,
  className,
  ...props
}: OAuthConsentCardProps) {
  const formattedAmount = formatMoney(amountMinor, currency);

  return (
    <ConsentCardShell
      clientName={clientName}
      productName={productName}
      className={className}
      {...props}
    >
      <dl className="divide-y divide-border/60 rounded-md border border-border bg-muted/20 text-xs">
        {action && (
          <div className="flex items-center justify-between gap-4 p-2.5">
            <dt className="text-muted-foreground font-medium">Requested Action</dt>
            <dd className="min-w-0 font-semibold text-foreground text-right">{action}</dd>
          </div>
        )}

        {formattedAmount && (
          <div className="flex items-center justify-between gap-4 p-2.5 bg-primary/5">
            <dt className="text-muted-foreground font-medium flex items-center gap-1.5">
              <DollarSign className="size-3.5 text-primary" />
              <span>Payment Amount</span>
            </dt>
            <dd className="min-w-0 font-mono font-bold text-foreground text-sm text-right">
              {formattedAmount}
            </dd>
          </div>
        )}

        {mandateId && (
          <div className="flex items-center justify-between gap-4 p-2.5">
            <dt className="text-muted-foreground font-medium flex items-center gap-1.5">
              <KeyRound className="size-3.5" />
              <span>Mandate Reference</span>
            </dt>
            <dd className="min-w-0 font-mono text-[11px] text-muted-foreground text-right truncate max-w-[180px]">
              {mandateId}
            </dd>
          </div>
        )}

        {redirectUri && (
          <div className="flex items-center justify-between gap-4 p-2.5">
            <dt className="text-muted-foreground font-medium">Redirect URI</dt>
            <dd className="min-w-0 break-all text-right font-mono text-[11px] text-muted-foreground">
              {redirectUri}
            </dd>
          </div>
        )}

        {email && (
          <div className="flex items-center justify-between gap-4 p-2.5">
            <dt className="text-muted-foreground font-medium">Approving As</dt>
            <dd className="min-w-0 text-right font-medium text-foreground">{email}</dd>
          </div>
        )}

        {scopes.length > 0 && (
          <div className="flex items-start justify-between gap-4 p-2.5">
            <dt className="text-muted-foreground font-medium mt-0.5">Permissions</dt>
            <dd className="min-w-0 text-right">
              <div className="flex flex-wrap justify-end gap-1">
                {scopes.map((scope) => (
                  <span
                    key={scope}
                    className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-foreground"
                  >
                    {scope}
                  </span>
                ))}
              </div>
            </dd>
          </div>
        )}
      </dl>

      <p className="text-[11px] leading-relaxed text-muted-foreground">
        PayGuardian policy guardrails require explicit human confirmation for this transaction.
        Authorizing allows the agent to execute within the verified bounds.
      </p>

      {error && (
        <div
          role="alert"
          className="flex items-center gap-2 rounded-md bg-destructive/10 p-2 text-xs text-destructive"
        >
          <AlertCircle className="size-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end pt-1">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={decision !== null}
          onClick={onDeny}
          className="w-full sm:w-auto"
        >
          {decision === "deny" ? (
            <span className="flex items-center gap-1.5">
              <Loader2 className="size-3.5 animate-spin" />
              <span>Denying...</span>
            </span>
          ) : (
            "Deny"
          )}
        </Button>
        <button
          type="button"
          disabled={decision !== null}
          onClick={onApprove}
          className="inline-flex items-center justify-center gap-2 rounded-md bg-[#0070BA] hover:bg-[#003087] text-white px-4 py-2 text-xs font-semibold shadow-md transition-all duration-150 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none w-full sm:w-auto cursor-pointer"
        >
          {decision === "approve" ? (
            <span className="flex items-center gap-1.5">
              <Loader2 className="size-3.5 animate-spin" />
              <span>Authorizing on PayPal...</span>
            </span>
          ) : (
            <span className="flex items-center gap-2">
              <Image
                src="/paypal.svg"
                alt="PayPal"
                width={14}
                height={14}
                className="size-3.5 object-contain brightness-0 invert"
              />
              <span>Authorize & Pay with PayPal</span>
            </span>
          )}
        </button>
      </div>
    </ConsentCardShell>
  );
}

export default OAuthConsentCard;
