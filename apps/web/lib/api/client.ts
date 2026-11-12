import type {
  EnvironmentDto,
  CreateEnvironmentRequest,
  AgentDto,
  CreateRootAgentRequest,
  RegisterChildAgentRequest,
  MandateDto,
  CreateRootMandateRequest,
  DelegateMandateRequest,
  PolicyDecisionDto,
  LedgerAccountDto,
  ActionReserveRequest,
  ActionReserveResponse,
  ApprovalDto,
  SessionDto,
  SessionRunDto,
  PayPalOrderRequest,
  PayPalOperationSummaryDto,
  AuditEventDto,
  HealthResponse,
  SystemStatusResponse,
} from "@payguardian/contracts";
import type { SpecialistAgent } from "@/components/agents/types";
import type { paths, components } from "./generated-schema";

export type { paths, components };

export interface RequestOptions extends Omit<RequestInit, "body"> {
  token?: string;
  localUserId?: string;
}

export class ApiClientError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly payload?: unknown;

  constructor(message: string, status: number, code?: string, payload?: unknown) {
    super(message);
    this.name = "ApiClientError";
    this.status = status;
    this.code = code;
    this.payload = payload;
  }
}

export class ApiClient {
  private readonly baseUrl: string;

  constructor(baseUrl = "/api/proxy") {
    // Normalise base URL without trailing slash
    this.baseUrl = baseUrl.replace(/\/$/, "");
  }

  private buildUrl(path: string): string {
    const cleanPath = path.startsWith("/") ? path : `/${path}`;
    return `${this.baseUrl}${cleanPath}`;
  }

  private buildHeaders(options?: RequestOptions): Headers {
    const headers = new Headers(options?.headers);
    if (!headers.has("content-type")) {
      headers.set("content-type", "application/json");
    }
    if (options?.token) {
      headers.set("authorization", `Bearer ${options.token}`);
    } else if (options?.localUserId) {
      headers.set("x-local-user-id", options.localUserId);
    }
    return headers;
  }

  async request<T>(path: string, options: RequestOptions & { body?: unknown } = {}): Promise<T> {
    const url = this.buildUrl(path);
    const headers = this.buildHeaders(options);

    const hasBody = options.body !== undefined && options.body !== null;
    const body = hasBody
      ? typeof options.body === "string"
        ? options.body
        : JSON.stringify(options.body)
      : undefined;

    if (!hasBody) {
      headers.delete("content-type");
    }

    const fetchOptions: RequestInit = {
      ...options,
      headers,
      body,
      credentials: options.credentials ?? "same-origin",
    };

    const response = await fetch(url, fetchOptions);

    if (!response.ok) {
      let errorBody: { code?: string; message?: string } | null = null;
      try {
        errorBody = (await response.json()) as { code?: string; message?: string };
      } catch {
        // Response wasn't valid JSON
      }

      const message =
        errorBody?.message ||
        `HTTP Error ${response.status}: ${response.statusText || "Request failed"}`;
      throw new ApiClientError(message, response.status, errorBody?.code, errorBody);
    }

    if (response.status === 204) {
      return undefined as T;
    }

    return (await response.json()) as T;
  }

  get<T>(path: string, options?: RequestOptions): Promise<T> {
    return this.request<T>(path, { ...options, method: "GET" });
  }

  post<T>(path: string, body?: unknown, options?: RequestOptions): Promise<T> {
    return this.request<T>(path, { ...options, method: "POST", body });
  }

  put<T>(path: string, body?: unknown, options?: RequestOptions): Promise<T> {
    return this.request<T>(path, { ...options, method: "PUT", body });
  }

  patch<T>(path: string, body?: unknown, options?: RequestOptions): Promise<T> {
    return this.request<T>(path, { ...options, method: "PATCH", body });
  }

  delete<T>(path: string, options?: RequestOptions): Promise<T> {
    return this.request<T>(path, { ...options, method: "DELETE" });
  }

  private unwrapArray<T>(payload: unknown, key: string): T[] {
    if (Array.isArray(payload)) return payload as T[];
    if (payload && typeof payload === "object" && Array.isArray((payload as Record<string, unknown>)[key])) {
      return (payload as Record<string, unknown>)[key] as T[];
    }
    return [];
  }

  // --- Domain Resource Namespaces ---

  readonly system = {
    health: (options?: RequestOptions) => this.get<HealthResponse>("/health", options),
    status: (options?: RequestOptions) =>
      this.get<SystemStatusResponse>("/v1/system/status", options),
    models: (options?: RequestOptions) =>
      this.get<{ models: Array<{ id: string; label: string; provider: string; default?: boolean }> }>(
        "/v1/models",
        options,
      ),
  };

  readonly environments = {
    list: async (options?: RequestOptions): Promise<EnvironmentDto[]> => {
      const res = await this.get<unknown>("/v1/environments", options);
      return this.unwrapArray<EnvironmentDto>(res, "environments");
    },
    get: async (id: string, options?: RequestOptions): Promise<EnvironmentDto> => {
      try {
        const res = await this.get<unknown>(`/v1/environments/${encodeURIComponent(id)}`, options);
        if (res && typeof res === "object" && "environment" in (res as Record<string, unknown>)) {
          return (res as { environment: EnvironmentDto }).environment;
        }
        return res as EnvironmentDto;
      } catch (err) {
        // Fallback to environments.list() if single GET /v1/environments/:id is not implemented on Gateway
        const list = await this.environments.list(options);
        const match = list.find((e) => e.id === id);
        if (match) return match;
        throw err;
      }
    },
    create: async (data: CreateEnvironmentRequest, options?: RequestOptions): Promise<EnvironmentDto> => {
      const res = await this.post<unknown>("/v1/environments", data, options);
      if (res && typeof res === "object" && "environment" in (res as Record<string, unknown>)) {
        return (res as { environment: EnvironmentDto }).environment;
      }
      return res as EnvironmentDto;
    },
    pause: (id: string, options?: RequestOptions) =>
      this.post<EnvironmentDto>(`/v1/environments/${encodeURIComponent(id)}/pause`, {}, options),
    resume: (id: string, options?: RequestOptions) =>
      this.post<EnvironmentDto>(`/v1/environments/${encodeURIComponent(id)}/resume`, {}, options),
    revoke: (id: string, options?: RequestOptions) =>
      this.post<EnvironmentDto>(`/v1/environments/${encodeURIComponent(id)}/revoke`, {}, options),
    delete: (id: string, options?: RequestOptions) =>
      this.delete<{ success: boolean; environmentId: string }>(`/v1/environments/${encodeURIComponent(id)}`, options),
  };

  readonly agents = {
    catalog: async (options?: RequestOptions): Promise<SpecialistAgent[]> => {
      const res = await this.get<unknown>("/v1/agents/catalog", options);
      return this.unwrapArray<SpecialistAgent>(res, "catalog");
    },
    list: async (environmentId: string, options?: RequestOptions): Promise<AgentDto[]> => {
      const res = await this.get<unknown>(
        `/v1/environments/${encodeURIComponent(environmentId)}/agents`,
        options,
      );
      return this.unwrapArray<AgentDto>(res, "agents");
    },
    createRoot: async (
      environmentId: string,
      data: CreateRootAgentRequest,
      options?: RequestOptions,
    ): Promise<AgentDto> => {
      const res = await this.post<unknown>(
        `/v1/environments/${encodeURIComponent(environmentId)}/agents/root`,
        data,
        options,
      );
      if (res && typeof res === "object" && "agent" in (res as Record<string, unknown>)) {
        return (res as { agent: AgentDto }).agent;
      }
      return res as AgentDto;
    },
    registerChild: async (
      environmentId: string,
      data: RegisterChildAgentRequest,
      options?: RequestOptions,
    ): Promise<AgentDto> => {
      const res = await this.post<unknown>(
        `/v1/environments/${encodeURIComponent(environmentId)}/agents/children`,
        data,
        options,
      );
      if (res && typeof res === "object" && "agent" in (res as Record<string, unknown>)) {
        return (res as { agent: AgentDto }).agent;
      }
      return res as AgentDto;
    },
    disable: (environmentId: string, agentId: string, options?: RequestOptions) =>
      this.post<AgentDto>(
        `/v1/environments/${encodeURIComponent(environmentId)}/agents/${encodeURIComponent(agentId)}/disable`,
        {},
        options,
      ),
    revoke: (environmentId: string, agentId: string, options?: RequestOptions) =>
      this.post<AgentDto>(
        `/v1/environments/${encodeURIComponent(environmentId)}/agents/${encodeURIComponent(agentId)}/revoke`,
        {},
        options,
      ),
  };

  readonly mandates = {
    list: async (environmentId: string, options?: RequestOptions): Promise<MandateDto[]> => {
      const res = await this.get<unknown>(
        `/v1/environments/${encodeURIComponent(environmentId)}/mandates`,
        options,
      );
      return this.unwrapArray<MandateDto>(res, "mandates");
    },
    createRoot: async (
      environmentId: string,
      data: CreateRootMandateRequest,
      options?: RequestOptions,
    ): Promise<MandateDto> => {
      const res = await this.post<unknown>(
        `/v1/environments/${encodeURIComponent(environmentId)}/mandates/root`,
        data,
        options,
      );
      if (res && typeof res === "object" && "mandate" in (res as Record<string, unknown>)) {
        return (res as { mandate: MandateDto }).mandate;
      }
      return res as MandateDto;
    },
    get: (mandateId: string, options?: RequestOptions) =>
      this.get<MandateDto>(`/v1/mandates/${encodeURIComponent(mandateId)}`, options),
    delegate: async (
      mandateId: string,
      data: DelegateMandateRequest,
      options?: RequestOptions,
    ): Promise<MandateDto> => {
      const res = await this.post<unknown>(
        `/v1/mandates/${encodeURIComponent(mandateId)}/delegations`,
        data,
        options,
      );
      if (res && typeof res === "object" && "mandate" in (res as Record<string, unknown>)) {
        return (res as { mandate: MandateDto }).mandate;
      }
      return res as MandateDto;
    },
    revoke: (mandateId: string, options?: RequestOptions) =>
      this.post<MandateDto>(
        `/v1/mandates/${encodeURIComponent(mandateId)}/revocations`,
        undefined,
        options,
      ),
    check: (
      mandateId: string,
      data: { action: string; amountMinor: number; currency: string },
      options?: RequestOptions,
    ) =>
      this.post<PolicyDecisionDto>(
        `/v1/mandates/${encodeURIComponent(mandateId)}/check`,
        data,
        options,
      ),
  };

  readonly ledger = {
    listAccounts: async (environmentId: string, options?: RequestOptions): Promise<LedgerAccountDto[]> => {
      const res = await this.get<unknown>(
        `/v1/environments/${encodeURIComponent(environmentId)}/ledger/accounts`,
        options,
      );
      return this.unwrapArray<LedgerAccountDto>(res, "accounts");
    },
    getAccount: (environmentId: string, accountId: string, options?: RequestOptions) =>
      this.get<LedgerAccountDto>(
        `/v1/environments/${encodeURIComponent(environmentId)}/ledger/accounts/${encodeURIComponent(accountId)}`,
        options,
      ),
    createAccount: (
      environmentId: string,
      data: { mandateId: string; parentAccountId?: string | null; currency: string; initialDepositMinor?: number },
      options?: RequestOptions,
    ) =>
      this.post<LedgerAccountDto>(
        `/v1/environments/${encodeURIComponent(environmentId)}/ledger/accounts`,
        data,
        options,
      ),
    allocate: (
      environmentId: string,
      data: { fromAccountId: string; toAccountId: string; amountMinor: number },
      options?: RequestOptions,
    ) =>
      this.post<{ success: boolean; allocationId: string }>(
        `/v1/environments/${encodeURIComponent(environmentId)}/ledger/allocations`,
        data,
        options,
      ),
    reserve: (environmentId: string, data: ActionReserveRequest, options?: RequestOptions) =>
      this.post<ActionReserveResponse>(
        `/v1/environments/${encodeURIComponent(environmentId)}/actions/reserve`,
        data,
        options,
      ),
    capture: (
      environmentId: string,
      actionId: string,
      data?: { amountMinor?: number },
      options?: RequestOptions,
    ) =>
      this.post<{ success: boolean; capturedMinor: number }>(
        `/v1/environments/${encodeURIComponent(environmentId)}/actions/${encodeURIComponent(actionId)}/capture`,
        data,
        options,
      ),
    release: (environmentId: string, actionId: string, options?: RequestOptions) =>
      this.post<{ success: boolean; releasedMinor: number }>(
        `/v1/environments/${encodeURIComponent(environmentId)}/actions/${encodeURIComponent(actionId)}/release`,
        undefined,
        options,
      ),
    simulate: (
      environmentId: string,
      data: { agentId: string; mandateId: string; action: string; amountMinor: number; currency: string },
      options?: RequestOptions,
    ) =>
      this.post<{ allowed: boolean; reason?: string }>(
        `/v1/environments/${encodeURIComponent(environmentId)}/actions/simulate`,
        data,
        options,
      ),
  };

  readonly actions = {
    get: (environmentId: string, actionId: string, options?: RequestOptions) =>
      this.get<{
        action: Record<string, unknown>;
        reservation: { actionId: string; accountId: string; amountMinor: number; state: string } | null;
      }>(
        `/v1/environments/${encodeURIComponent(environmentId)}/actions/${encodeURIComponent(actionId)}`,
        options,
      ),
    getTrace: (environmentId: string, actionId: string, options?: RequestOptions) =>
      this.get<{
        action: Record<string, unknown>;
        agent: AgentDto | null;
        mandateChain: MandateDto[];
        rootMandate: MandateDto | null;
      }>(
        `/v1/environments/${encodeURIComponent(environmentId)}/actions/${encodeURIComponent(actionId)}/trace`,
        options,
      ),
  };

  readonly approvals = {
    list: async (
      environmentId: string,
      status?: "pending" | "approved" | "rejected",
      options?: RequestOptions,
    ): Promise<ApprovalDto[]> => {
      const query = status ? `?status=${encodeURIComponent(status)}` : "";
      const res = await this.get<unknown>(
        `/v1/environments/${encodeURIComponent(environmentId)}/approvals${query}`,
        options,
      );
      return this.unwrapArray<ApprovalDto>(res, "approvals");
    },
    get: (environmentId: string, approvalId: string, options?: RequestOptions) =>
      this.get<ApprovalDto>(
        `/v1/environments/${encodeURIComponent(environmentId)}/approvals/${encodeURIComponent(approvalId)}`,
        options,
      ),
    approve: (
      environmentId: string,
      approvalId: string,
      body?: Record<string, unknown>,
      options?: RequestOptions,
    ) =>
      this.post<ApprovalDto>(
        `/v1/environments/${encodeURIComponent(environmentId)}/approvals/${encodeURIComponent(approvalId)}/approve`,
        body ?? {},
        options,
      ),
    reject: (environmentId: string, approvalId: string, reason?: string, options?: RequestOptions) =>
      this.post<ApprovalDto>(
        `/v1/environments/${encodeURIComponent(environmentId)}/approvals/${encodeURIComponent(approvalId)}/reject`,
        { reason },
        options,
      ),
  };

  readonly sessions = {
    list: async (environmentId: string, options?: RequestOptions): Promise<SessionDto[]> => {
      const res = await this.get<unknown>(
        `/v1/environments/${encodeURIComponent(environmentId)}/sessions`,
        options,
      );
      return this.unwrapArray<SessionDto>(res, "sessions");
    },
    get: (environmentId: string, sessionId: string, options?: RequestOptions) =>
      this.get<SessionDto>(
        `/v1/environments/${encodeURIComponent(environmentId)}/sessions/${encodeURIComponent(sessionId)}`,
        options,
      ),
    create: (
      environmentId: string,
      data: {
        name?: string;
        title?: string;
        purpose?: string;
        agentId?: string | null;
        context?: Record<string, unknown>;
      },
      options?: RequestOptions,
    ) => {
      const name = data.name ?? data.title ?? "New Task Session";
      const context = {
        ...(data.purpose ? { description: data.purpose, purpose: data.purpose } : {}),
        ...data.context,
      };
      return this.post<SessionDto>(
        `/v1/environments/${encodeURIComponent(environmentId)}/sessions`,
        { name, agentId: data.agentId, context },
        options,
      );
    },
    update: (
      environmentId: string,
      sessionId: string,
      data: { name?: string; status?: "active" | "paused" | "completed" | "cancelled"; context?: Record<string, unknown> },
      options?: RequestOptions,
    ) =>
      this.patch<SessionDto>(
        `/v1/environments/${encodeURIComponent(environmentId)}/sessions/${encodeURIComponent(sessionId)}`,
        data,
        options,
      ),
    listRuns: (environmentId: string, sessionId: string, options?: RequestOptions) =>
      this.get<SessionRunDto[]>(
        `/v1/environments/${encodeURIComponent(environmentId)}/sessions/${encodeURIComponent(sessionId)}/runs`,
        options,
      ),
    createRun: (
      environmentId: string,
      sessionId: string,
      data: { agentId: string },
      options?: RequestOptions,
    ) =>
      this.post<SessionRunDto>(
        `/v1/environments/${encodeURIComponent(environmentId)}/sessions/${encodeURIComponent(sessionId)}/runs`,
        data,
        options,
      ),
    updateRun: (
      environmentId: string,
      sessionId: string,
      runId: string,
      data: { status?: "running" | "paused" | "completed" | "failed"; checkpoint?: Record<string, unknown> },
      options?: RequestOptions,
    ) =>
      this.patch<SessionRunDto>(
        `/v1/environments/${encodeURIComponent(environmentId)}/sessions/${encodeURIComponent(sessionId)}/runs/${encodeURIComponent(runId)}`,
        data,
        options,
      ),
  };

  readonly payments = {
    createPayPalOrder: (
      environmentId: string,
      data: PayPalOrderRequest,
      options?: RequestOptions,
    ) =>
      this.post<{ actionId: string; orderId: string; approveUrl?: string }>(
        `/v1/environments/${encodeURIComponent(environmentId)}/payments/paypal/orders`,
        data,
        options,
      ),
    getPayPalOperation: (environmentId: string, actionId: string, options?: RequestOptions) =>
      this.get<PayPalOperationSummaryDto>(
        `/v1/environments/${encodeURIComponent(environmentId)}/payments/paypal/${encodeURIComponent(actionId)}`,
        options,
      ),
    capturePayPal: (environmentId: string, actionId: string, options?: RequestOptions) =>
      this.post<PayPalOperationSummaryDto>(
        `/v1/environments/${encodeURIComponent(environmentId)}/payments/paypal/${encodeURIComponent(actionId)}/capture`,
        {},
        options,
      ),
    captureOrder: (
      environmentId: string,
      data: {
        orderId: string;
        actionId?: string;
        approvalId?: string;
        amountMinor?: number;
        currency?: string;
      },
      options?: RequestOptions,
    ) =>
      this.post<{
        success: boolean;
        status: string;
        orderId: string;
        transactionId?: string | null;
        captureId?: string | null;
        amountMinor?: number;
        currency?: string;
      }>(
        `/v1/environments/${encodeURIComponent(environmentId)}/payments/paypal/capture`,
        data,
        options,
      ),
    listOperations: (
      environmentId: string,
      params?: { since?: string; limit?: number },
      options?: RequestOptions,
    ) => {
      const q = new URLSearchParams();
      if (params?.since) q.set("since", params.since);
      if (params?.limit) q.set("limit", String(params.limit));
      const qs = q.toString() ? `?${q.toString()}` : "";
      return this.get<PayPalOperationSummaryDto[]>(
        `/v1/environments/${encodeURIComponent(environmentId)}/payments/paypal/operations${qs}`,
        options,
      );
    },
  };

  readonly activity = {
    list: async (
      environmentId: string,
      params?: { since?: string; limit?: number },
      options?: RequestOptions,
    ): Promise<AuditEventDto[]> => {
      const q = new URLSearchParams();
      if (params?.since) q.set("since", params.since);
      if (params?.limit) q.set("limit", String(params.limit));
      const qs = q.toString() ? `?${q.toString()}` : "";
      const res = await this.get<unknown>(
        `/v1/environments/${encodeURIComponent(environmentId)}/activity${qs}`,
        options,
      );
      return this.unwrapArray<AuditEventDto>(res, "events");
    },
  };
}

// Default singleton client instance
export const apiClient = new ApiClient();
