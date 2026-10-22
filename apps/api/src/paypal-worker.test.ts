import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { SupabasePayPalWorkerOrderStore } from "./paypal.js";

describe("SupabasePayPalWorkerOrderStore", () => {
  it("calls the atomic enqueue RPC and maps its deduplicated result", async () => {
    let rpcName = "";
    let rpcArgs: Record<string, unknown> | undefined;
    const client = {
      rpc(name: string, args: Record<string, unknown>) {
        rpcName = name;
        rpcArgs = args;
        return {
          async single() {
            return {
              data: {
                action: {
                  id: "action-1",
                  environmentId: "environment-1",
                  agentId: "agent-1",
                  mandateId: "mandate-1",
                  idempotencyKey: "request-1",
                  requestHash: "hash-1",
                  action: "paypal_order",
                  amountMinor: 1000,
                  currency: "USD",
                  authorizationState: "authorized",
                  executionState: "pending",
                  createdAt: "2026-10-22T00:00:00.000Z",
                },
                reservation: {
                  actionId: "action-1",
                  accountId: "account-1",
                  amountMinor: 1000,
                  state: "held",
                },
                operation: {
                  environment_id: "environment-1",
                  action_id: "action-1",
                  provider: "paypal",
                  provider_order_id: null,
                  approval_url: null,
                  status: "PENDING",
                  observed_provider_status: "PENDING",
                  capture_id: null,
                  reconciliation_state: "pending",
                  last_checked_at: null,
                  last_event_at: null,
                  last_error_code: null,
                  created_at: "2026-10-22T00:00:00.000Z",
                  updated_at: "2026-10-22T00:00:00.000Z",
                },
                job: {
                  id: "job-1",
                  provider: "paypal",
                  intent: "create_order",
                  dedupe_key: "paypal:create_order:action-1",
                  payload: { action: { id: "action-1" } },
                  status: "queued",
                  attempts: 0,
                  max_attempts: 5,
                  available_at: "2026-10-22T00:00:00.000Z",
                  lease_owner: null,
                  lease_token: null,
                  lease_expires_at: null,
                  last_error_code: null,
                  last_error_message: null,
                  completed_at: null,
                  created_at: "2026-10-22T00:00:00.000Z",
                  updated_at: "2026-10-22T00:00:00.000Z",
                },
                deduplicated: true,
              },
              error: null,
            };
          },
        };
      },
    } as unknown as SupabaseClient;

    const result = await new SupabasePayPalWorkerOrderStore(client).enqueue({
      environmentId: "environment-1",
      agentId: "agent-1",
      mandateId: "mandate-1",
      ledgerAccountId: "account-1",
      idempotencyKey: "request-1",
      requestHash: "hash-1",
      action: "paypal_order",
      amountMinor: 1000,
      currency: "USD",
      returnUrl: "https://app.test/return",
      cancelUrl: "https://app.test/cancel",
    });

    expect(rpcName).toBe("enqueue_paypal_order_worker");
    expect(rpcArgs).toMatchObject({
      p_environment_id: "environment-1",
      p_idempotency_key: "request-1",
      p_return_url: "https://app.test/return",
      p_cancel_url: "https://app.test/cancel",
    });
    expect(result).toMatchObject({
      action: { id: "action-1", environmentId: "environment-1" },
      reservation: { actionId: "action-1", accountId: "account-1", state: "held" },
      operation: { actionId: "action-1", providerOrderId: null, status: "PENDING" },
      job: { id: "job-1", intent: "create_order", leaseToken: null },
      deduplicated: true,
    });
  });
});
