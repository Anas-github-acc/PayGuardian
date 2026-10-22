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

type Agent = { id: string; name: string; kind: string; parentAgentId: string | null };

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
  const [paymentOperations, setPaymentOperations] = useState<PaymentOperation[]>([]);
  const [operationsLoading, setOperationsLoading] = useState(false);
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
      const [agentResponse, paymentResponse] = await Promise.all([
        api<{ agents: Agent[] }>(`/v1/environments/${environmentId}/agents`),
        api<{ operations: PaymentOperation[] }>(
          `/v1/environments/${environmentId}/payments/paypal/operations?limit=50`,
        ),
      ]);
      setAgents(agentResponse.agents);
      setPaymentOperations(paymentResponse.operations);
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
      setPaymentOperations([]);
      return;
    }
    void loadEnvironmentData(selectedEnvironmentId).catch((error: unknown) => {
      setMessage(error instanceof Error ? error.message : "Unable to load environment data.");
      setAgents([]);
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
        <p className="note">
          Agent registration, mandates, budgets, and payments remain separately enforced by the
          gateway.
        </p>
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
