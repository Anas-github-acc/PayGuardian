"use client";

import React, { useState } from "react";
import { PayPalScriptProvider, PayPalButtons } from "@paypal/react-paypal-js";
import { apiClient } from "../../lib/api/client";
import { Loader2, CheckCircle2, AlertCircle } from "lucide-react";

export interface PayPalCheckoutProps {
  environmentId: string;
  mandateId?: string;
  approvalId?: string;
  actionId?: string;
  action?: string;
  amountMinor: number;
  currency?: string;
  recipient?: string;
  clientName?: string;
  onSuccess: (captureResult: {
    orderId: string;
    transactionId?: string | null;
    captureId?: string | null;
    amountMinor?: number;
    currency?: string;
    status: string;
  }) => void | Promise<void>;
  onError?: (error: Error) => void;
  onCancel?: () => void;
}

const DEFAULT_CLIENT_ID =
  process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID ||
  "BAAFc7jKwyLxb56aggw4vyNn_s1bMQu1o-Pu-3EAf4GtygFGAcS5sG2lyw4_q0RACWea4Lsy5ybKjyYln0";

export function PayPalCheckoutButton({
  environmentId,
  mandateId,
  approvalId,
  actionId,
  action = "book_hotel",
  amountMinor,
  currency = "USD",
  recipient,
  clientName = "hotel",
  onSuccess,
  onError,
  onCancel,
}: PayPalCheckoutProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [completedTxn, setCompletedTxn] = useState<{
    orderId: string;
    captureId?: string | null;
  } | null>(null);

  const cleanCurrency = (currency || "USD").toUpperCase();

  if (completedTxn) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 animate-in fade-in zoom-in-95 duration-200">
        <CheckCircle2 className="size-6 text-emerald-400" />
        <span className="text-sm font-semibold text-white">Payment Authorized & Settled</span>
        <div className="flex flex-col text-xs text-zinc-400 text-center font-mono">
          <span>Order: {completedTxn.orderId}</span>
          {completedTxn.captureId && <span>Capture: {completedTxn.captureId}</span>}
        </div>
      </div>
    );
  }

  return (
    <div className="w-full space-y-2">
      {errorMessage && (
        <div className="flex items-center gap-2 p-3 text-xs rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 animate-in fade-in">
          <AlertCircle className="size-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {isProcessing && (
        <div className="flex items-center justify-center gap-2 py-2 text-xs text-blue-400">
          <Loader2 className="size-4 animate-spin" />
          <span>Capturing & settling payment on Gateway ledger...</span>
        </div>
      )}

      <PayPalScriptProvider
        options={{
          clientId: DEFAULT_CLIENT_ID,
          currency: cleanCurrency,
          intent: "capture",
        }}
      >
        <div className="relative min-h-[44px] flex items-center justify-center">
          <PayPalButtons
            style={{
              layout: "horizontal",
              height: 40,
              color: "gold",
              shape: "rect",
              label: "paypal",
              tagline: false,
            }}
            disabled={isProcessing}
            createOrder={async () => {
              setErrorMessage(null);
              try {
                // Step 1: User clicks PayPal Checkout -> Frontend invokes backend's create-order endpoint
                // Step 2: Backend creates an order -> calls PayPal Orders API and receives order ID
                const res = await apiClient.payments.createPayPalOrder(environmentId, {
                  agentId: clientName?.toLowerCase().includes("hotel") ? "hotel" : "travel",
                  mandateId: mandateId || "",
                  ledgerAccountId: `acc_${mandateId || "default"}`,
                  idempotencyKey: `pp_sdk_${Date.now()}`,
                  requestHash: `req_hash_${Date.now()}`,
                  action: action || "book_hotel",
                  amountMinor: amountMinor || 15000,
                  currency: (cleanCurrency as "USD") || "USD",
                  approvalId: approvalId,
                  returnUrl:
                    typeof window !== "undefined"
                      ? `${window.location.origin}/paypal/return`
                      : undefined,
                  cancelUrl:
                    typeof window !== "undefined"
                      ? `${window.location.origin}/paypal/cancel`
                      : undefined,
                });

                const orderId =
                  (res as any)?.order?.id ||
                  (res as any)?.orderId ||
                  (res as any)?.order?.approvalUrl?.match(/token=([^&]+)/)?.[1];

                if (!orderId) {
                  throw new Error("PayPal order creation failed to return a valid Order ID");
                }
                return orderId;
              } catch (err) {
                const msg =
                  err instanceof Error ? err.message : "Failed to initiate PayPal Checkout";
                setErrorMessage(msg);
                if (onError) onError(err instanceof Error ? err : new Error(msg));
                throw err;
              }
            }}
            onApprove={async (data) => {
              // Step 3: User approves payment -> PayPal opens its checkout experience and calls onApprove
              // Step 4: Backend captures payment -> Frontend calls capture endpoint after approval
              // Step 5: Update your ledger -> Persist transaction ID, amount, currency, status and order ID
              setIsProcessing(true);
              setErrorMessage(null);
              try {
                const captureRes = await apiClient.payments.captureOrder(environmentId, {
                  orderId: data.orderID,
                  actionId: actionId || approvalId,
                  approvalId: approvalId,
                  amountMinor: amountMinor,
                  currency: cleanCurrency,
                });

                setCompletedTxn({
                  orderId: data.orderID,
                  captureId: captureRes.captureId || captureRes.transactionId,
                });

                await onSuccess({
                  orderId: data.orderID,
                  transactionId: captureRes.transactionId || captureRes.captureId,
                  captureId: captureRes.captureId,
                  amountMinor: captureRes.amountMinor || amountMinor,
                  currency: captureRes.currency || cleanCurrency,
                  status: "COMPLETED",
                });
              } catch (captureErr) {
                const msg =
                  captureErr instanceof Error
                    ? captureErr.message
                    : "Payment authorized on PayPal, but Gateway capture failed";
                setErrorMessage(msg);
                if (onError) onError(captureErr instanceof Error ? captureErr : new Error(msg));
              } finally {
                setIsProcessing(false);
              }
            }}
            onCancel={() => {
              setErrorMessage("PayPal checkout was cancelled.");
              if (onCancel) onCancel();
            }}
            onError={(sdkErr) => {
              console.error("PayPal SDK Checkout Error:", sdkErr);
              setErrorMessage((prev) => {
                if (prev) return prev;
                const errStr = sdkErr instanceof Error ? sdkErr.message : String(sdkErr || "");
                if (errStr && !errStr.includes("[object Object]")) {
                  return `PayPal checkout error: ${errStr}`;
                }
                return "PayPal checkout encountered an error. Please try again.";
              });
              if (onError) onError(sdkErr instanceof Error ? sdkErr : new Error(String(sdkErr)));
            }}
          />
        </div>
      </PayPalScriptProvider>
    </div>
  );
}
