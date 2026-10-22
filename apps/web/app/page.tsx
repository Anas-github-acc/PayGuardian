"use client";

import { useEffect, useState, type FormEvent } from "react";
import { AuthBoundary, useAuth } from "./auth-provider";
import { apiRequest } from "./lib/api";
import { AgentsGrid } from "./components/agents-grid";
import { PaymentOperationsGrid } from "./components/payment-operations-grid";
import type { PaymentOperation } from "./components/payment-operations-grid-data";

type Environment = {
  id: string;
  name: string;
  purpose: string;
  currency: string;
  budgetLimitMinor: number;
  status: string;
};

type Agent = {
  id: string;
  name: string;
  kind: string;
  parentAgentId: string | null;
  status: "active" | "disabled" | "revoked";
};

type Mandate = {
  id: string;
  holderAgentId: string;
  parentMandateId: string | null;
  budgetLimitMinor: number;
  allocatedMinor: number;
  spentMinor: number;
  reservedMinor: number;
  currency: string;
  permittedActions: string[];
  expiresAt: string;
  state: "active" | "expired" | "revoked";
  revokedAt: string | null;
};

type ActivityEvent = {
  id: string;
  eventType: string;
  outcome: "success" | "denied" | "failure";
  reasonCode: string | null;
  createdAt: string;
  actorType: string;
};

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001";
export default function HomePage() {
  return (
    <AuthBoundary>
      <Dashboard />
    </AuthBoundary>
  );
}

function Dashboard() {
  const { isLocalDevelopment, session, user, signOut } = useAuth();
  const localUserId = process.env.NEXT_PUBLIC_LOCAL_USER_ID ?? "local-user";
  const [environments, setEnvironments] = useState<Environment[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [mandates, setMandates] = useState<Mandate[]>([]);
  const [activity, setActivity] = useState<ActivityEvent[]>([]);
  const [paymentOperations, setPaymentOperations] = useState<PaymentOperation[]>([]);
  const [operationsLoading, setOperationsLoading] = useState(false);
  const [controlLoading, setControlLoading] = useState<string | null>(null);
  const [selectedEnvironmentId, setSelectedEnvironmentId] = useState<string>();
  const [name, setName] = useState("Travel");
  const [purpose, setPurpose] = useState("Trip planning");
  const [budget, setBudget] = useState("10000");
  const [message, setMessage] = useState(
    isLocalDevelopment ? "Local development mode: Supabase Auth is not configured." : "",
  );

  async function api<T>(path: string, init?: RequestInit): Promise<T> {
    return apiRequest<T>(
      apiBaseUrl,
      path,
      session,
      init,
      isLocalDevelopment ? localUserId : undefined,
    );
  }

  async function loadEnvironmentData(environmentId: string) {
    setOperationsLoading(true);
    try {
      const [agentResponse, paymentResponse, mandateResponse, activityResponse] = await Promise.all(
        [
          api<{ agents: Agent[] }>(`/v1/environments/${environmentId}/agents`),
          api<{ operations: PaymentOperation[] }>(
            `/v1/environments/${environmentId}/payments/paypal/operations?limit=50`,
          ),
          api<{ mandates: Mandate[] }>(`/v1/environments/${environmentId}/mandates`),
          api<{ events: ActivityEvent[] }>(`/v1/environments/${environmentId}/activity`),
        ],
      );
      setAgents(agentResponse.agents);
      setPaymentOperations(paymentResponse.operations);
      setMandates(mandateResponse.mandates);
      setActivity(activityResponse.events);
    } finally {
      setOperationsLoading(false);
    }
  }

  async function refreshEnvironments() {
    const response = await api<{ environments: Environment[] }>("/v1/environments");
    setEnvironments(response.environments);
    setSelectedEnvironmentId((current) => {
      if (current && response.environments.some((environment) => environment.id === current)) {
        return current;
      }
      return response.environments[0]?.id;
    });
  }

  useEffect(() => {
    void refreshEnvironments().catch((error: unknown) => {
      setMessage(error instanceof Error ? error.message : "Unable to load environments.");
    });
  }, []);

  useEffect(() => {
    if (!selectedEnvironmentId) {
      setAgents([]);
      setMandates([]);
      setActivity([]);
      setPaymentOperations([]);
      return;
    }
    void loadEnvironmentData(selectedEnvironmentId).catch((error: unknown) => {
      setMessage(error instanceof Error ? error.message : "Unable to load environment data.");
      setAgents([]);
      setMandates([]);
      setActivity([]);
      setPaymentOperations([]);
    });
  }, [selectedEnvironmentId]);

  async function createEnvironment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      const response = await api<{ environment: Environment }>("/v1/environments", {
        method: "POST",
        body: JSON.stringify({ name, purpose, currency: "INR", budgetLimitMinor: Number(budget) }),
      });
      setSelectedEnvironmentId(response.environment.id);
      setMessage("Environment created. Register a Personal Agent through the gateway API next.");
      await refreshEnvironments();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to create environment.");
    }
  }

  async function refreshSelectedEnvironment() {
    await refreshEnvironments();
    if (selectedEnvironmentId) await loadEnvironmentData(selectedEnvironmentId);
  }

  async function controlEnvironment(action: "pause" | "resume" | "revoke") {
    if (!selectedEnvironmentId) return;
    if (
      action === "revoke" &&
      !window.confirm("Revoke this environment? Future protected actions will be denied.")
    ) {
      return;
    }
    setControlLoading(`environment-${action}`);
    try {
      await api(`/v1/environments/${selectedEnvironmentId}/${action}`, { method: "POST" });
      setMessage(`Environment ${action === "revoke" ? "revoked" : `${action}d`}.`);
      await refreshSelectedEnvironment();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to update environment.");
    } finally {
      setControlLoading(null);
    }
  }

  async function controlAgent(agentId: string, action: "disable" | "revoke") {
    if (!selectedEnvironmentId) return;
    if (
      action === "revoke" &&
      !window.confirm("Revoke this agent and its descendants? This cannot be undone.")
    ) {
      return;
    }
    setControlLoading(`agent-${agentId}-${action}`);
    try {
      await api(`/v1/environments/${selectedEnvironmentId}/agents/${agentId}/${action}`, {
        method: "POST",
      });
      setMessage(
        `Agent ${action === "revoke" ? "revoked" : "disabled"}. Descendants are blocked too.`,
      );
      await loadEnvironmentData(selectedEnvironmentId);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to update agent.");
    } finally {
      setControlLoading(null);
    }
  }

  async function revokeMandate(mandateId: string) {
    if (
      !window.confirm("Revoke this mandate and all delegated descendants? This cannot be undone.")
    ) {
      return;
    }
    setControlLoading(`mandate-${mandateId}`);
    try {
      await api(`/v1/mandates/${mandateId}/revocations`, { method: "POST" });
      setMessage("Mandate revoked. Descendant mandates are blocked by the gateway.");
      if (selectedEnvironmentId) await loadEnvironmentData(selectedEnvironmentId);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to revoke mandate.");
    } finally {
      setControlLoading(null);
    }
  }

  const selectedEnvironment = environments.find(
    (environment) => environment.id === selectedEnvironmentId,
  );

  return (
    <main className="shell">
      <section className="hero" aria-labelledby="page-title">
        <div className="topbar">
          <p className="eyebrow">Delegation Gateway · Phase 6 foundation</p>
          <button type="button" onClick={() => void signOut()}>
            Sign out
          </button>
        </div>
        <h1 id="page-title">PayGuardian</h1>
        <p className="lede">
          A safe boundary for Personal Agents and specialist agents to request bounded authority.
        </p>
        <div className="status" role="status">
          <span className="status-dot" aria-hidden="true" />
          {isLocalDevelopment
            ? "Local development authentication"
            : `Signed in as ${user?.email ?? "authenticated user"}`}
        </div>
      </section>

      <section className="card" aria-labelledby="setup-title">
        <h2 id="setup-title">Create an environment</h2>
        <p className="note">{message}</p>
        <form className="form" onSubmit={createEnvironment}>
          <label>
            Environment name
            <input value={name} onChange={(event) => setName(event.target.value)} />
          </label>
          <label>
            Purpose
            <input value={purpose} onChange={(event) => setPurpose(event.target.value)} />
          </label>
          <label>
            Budget in minor units
            <input
              inputMode="numeric"
              value={budget}
              onChange={(event) => setBudget(event.target.value)}
            />
          </label>
          <button type="submit">Create environment</button>
        </form>
      </section>

      <section className="card" aria-labelledby="environment-title">
        <h2 id="environment-title">Environments</h2>
        {environments.length === 0 ? <p className="muted">No environments yet.</p> : null}
        <ul>
          {environments.map((environment) => (
            <li key={environment.id}>
              <button
                className="link-button"
                type="button"
                onClick={() => setSelectedEnvironmentId(environment.id)}
              >
                {environment.name}
              </button>{" "}
              <span className="muted">
                {environment.purpose} · {environment.budgetLimitMinor} {environment.currency} ·{" "}
                {environment.status}
              </span>
            </li>
          ))}
        </ul>
        <h3>Registered agents</h3>
        {agents.length === 0 ? (
          <p className="muted">No agents registered for the selected environment.</p>
        ) : null}
        <AgentsGrid agents={agents} />
        <div className="control-panel" aria-label="Environment emergency controls">
          <h3>Emergency controls</h3>
          <p className="muted">
            Pausing blocks new setup, delegation, ledger mutations, and protected actions. Existing
            in-flight reconciliation remains available.
          </p>
          <div className="action-row">
            {selectedEnvironment?.status === "active" ? (
              <button
                type="button"
                onClick={() => void controlEnvironment("pause")}
                disabled={controlLoading !== null}
              >
                {controlLoading === "environment-pause" ? "Pausing…" : "Pause environment"}
              </button>
            ) : null}
            {selectedEnvironment?.status === "paused" ? (
              <button
                type="button"
                onClick={() => void controlEnvironment("resume")}
                disabled={controlLoading !== null}
              >
                {controlLoading === "environment-resume" ? "Resuming…" : "Resume environment"}
              </button>
            ) : null}
            {selectedEnvironment && selectedEnvironment.status !== "revoked" ? (
              <button
                className="danger-button"
                type="button"
                onClick={() => void controlEnvironment("revoke")}
                disabled={controlLoading !== null}
              >
                {controlLoading === "environment-revoke" ? "Revoking…" : "Revoke environment"}
              </button>
            ) : null}
          </div>
        </div>
        <div className="control-panel" aria-label="Agent controls">
          <h3>Agent controls</h3>
          {agents.length === 0 ? <p className="muted">No agent controls available.</p> : null}
          <ul className="control-list">
            {agents.map((agent) => (
              <li key={agent.id}>
                <span>
                  <strong>{agent.name}</strong> <span className="muted">({agent.status})</span>
                </span>
                <span className="inline-actions">
                  {agent.status === "active" ? (
                    <button
                      type="button"
                      onClick={() => void controlAgent(agent.id, "disable")}
                      disabled={controlLoading !== null}
                    >
                      Disable
                    </button>
                  ) : null}
                  {agent.status !== "revoked" ? (
                    <button
                      className="danger-button"
                      type="button"
                      onClick={() => void controlAgent(agent.id, "revoke")}
                      disabled={controlLoading !== null}
                    >
                      Revoke
                    </button>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        </div>
        <p className="note">
          Agent registration, mandates, budgets, and payments remain separately enforced by the
          gateway.
        </p>
      </section>

      <section className="card card-wide" aria-labelledby="mandates-title">
        <h2 id="mandates-title">Mandates</h2>
        <p className="muted">Authority grants and current budget usage for this environment.</p>
        {mandates.length === 0 ? <p className="muted">No mandates recorded.</p> : null}
        <ul className="mandate-list">
          {mandates.map((mandate) => (
            <li key={mandate.id}>
              <div>
                <strong>{mandate.id}</strong>
                <span className="muted">
                  {mandate.state} · holder {mandate.holderAgentId} · {mandate.spentMinor}/
                  {mandate.budgetLimitMinor} {mandate.currency} spent
                </span>
              </div>
              {mandate.state === "active" ? (
                <button
                  className="danger-button"
                  type="button"
                  onClick={() => void revokeMandate(mandate.id)}
                  disabled={controlLoading !== null}
                >
                  {controlLoading === `mandate-${mandate.id}` ? "Revoking…" : "Revoke mandate"}
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      </section>

      <section className="card card-wide" aria-labelledby="activity-title">
        <h2 id="activity-title">Activity</h2>
        <p className="muted">Append-only gateway events for the selected environment.</p>
        {activity.length === 0 ? <p className="muted">No activity recorded.</p> : null}
        <ol className="activity-list">
          {[...activity].reverse().map((event) => (
            <li key={event.id}>
              <div>
                <strong>{event.eventType}</strong>
                <span className="muted">
                  {event.outcome} · {event.actorType} · {new Date(event.createdAt).toLocaleString()}
                </span>
              </div>
              {event.reasonCode ? <span className="muted">{event.reasonCode}</span> : null}
            </li>
          ))}
        </ol>
      </section>

      <section className="card card-wide" aria-labelledby="payment-operations-title">
        <h2 id="payment-operations-title">Recent PayPal operations</h2>
        <p className="muted">
          {selectedEnvironmentId
            ? operationsLoading
              ? "Loading operations…"
              : "Read-only provider and reconciliation status for the selected environment."
            : "Select an environment to inspect payment operations."}
        </p>
        <PaymentOperationsGrid operations={paymentOperations} />
      </section>
    </main>
  );
}
