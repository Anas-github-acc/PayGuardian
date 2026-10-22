"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "../auth-provider";
import { apiRequest } from "../lib/api";

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001";

type PaymentView = {
  action: { authorizationState: string; executionState: string };
  operation: {
    status: string;
    providerOrderId: string;
    captureId: string | null;
    reconciliationState: string;
    approvalUrl: string | null;
  };
  reservation: { state: string; amountMinor: number } | null;
};

export function PayPalStatus({ cancelled = false }: { cancelled?: boolean }) {
  const { isLocalDevelopment, session } = useAuth();
  const params = useSearchParams();
  const environmentId = params.get("environment_id");
  const actionId = params.get("action_id");
  const [payment, setPayment] = useState<PaymentView | null>(null);
  const [message, setMessage] = useState("Loading PayPal operation…");
  const [busy, setBusy] = useState(false);
  const localUserId = process.env.NEXT_PUBLIC_LOCAL_USER_ID ?? "local-user";

  async function request<T>(path: string, init?: RequestInit): Promise<T> {
    return apiRequest<T>(
      apiBaseUrl,
      path,
      session,
      init,
      isLocalDevelopment ? localUserId : undefined,
    );
  }

  async function refresh() {
    if (!environmentId || !actionId) {
      setMessage("This PayPal callback is missing its operation reference.");
      return;
    }
    try {
      const result = await request<PaymentView>(
        `/v1/environments/${environmentId}/payments/paypal/${actionId}`,
      );
      setPayment(result);
      setMessage(
        cancelled
          ? "Cancellation received. Provider status is being checked."
          : "PayPal approval returned to PayGuardian.",
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to load PayPal operation.");
    }
  }

  useEffect(() => {
    void refresh();
  }, [environmentId, actionId, cancelled]);

  async function capture() {
    if (!environmentId || !actionId) return;
    setBusy(true);
    try {
      await request(`/v1/environments/${environmentId}/payments/paypal/${actionId}/capture`, {
        method: "POST",
      });
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to capture PayPal order.");
    } finally {
      setBusy(false);
    }
  }

  async function reconcile() {
    if (!environmentId || !actionId) return;
    setBusy(true);
    try {
      await request(`/v1/environments/${environmentId}/payments/paypal/${actionId}/reconcile`, {
        method: "POST",
      });
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to reconcile PayPal order.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="shell">
      <section className="hero" aria-labelledby="paypal-title">
        <p className="eyebrow">PayPal Sandbox · USD</p>
        <h1 id="paypal-title">{cancelled ? "Payment cancelled" : "Payment status"}</h1>
        <p className="lede">{message}</p>
      </section>
      <section className="card" aria-live="polite">
        {!payment ? <p className="muted">No operation details available yet.</p> : null}
        {payment ? (
          <dl className="payment-details">
            <div>
              <dt>Gateway authorization</dt>
              <dd>{payment.action.authorizationState}</dd>
            </div>
            <div>
              <dt>Execution state</dt>
              <dd>{payment.action.executionState}</dd>
            </div>
            <div>
              <dt>Provider state</dt>
              <dd>{payment.operation.status}</dd>
            </div>
            <div>
              <dt>Accounting reservation</dt>
              <dd>{payment.reservation?.state ?? "unknown"}</dd>
            </div>
            <div>
              <dt>Reconciliation</dt>
              <dd>{payment.operation.reconciliationState}</dd>
            </div>
            <div>
              <dt>Provider order</dt>
              <dd>{payment.operation.providerOrderId}</dd>
            </div>
          </dl>
        ) : null}
        <div className="action-row">
          {!cancelled && payment?.operation.status !== "COMPLETED" ? (
            <button type="button" onClick={() => void capture()} disabled={busy}>
              {busy ? "Working…" : "Capture payment"}
            </button>
          ) : null}
          <button type="button" onClick={() => void reconcile()} disabled={busy}>
            {busy ? "Working…" : "Refresh provider status"}
          </button>
        </div>
      </section>
    </main>
  );
}
