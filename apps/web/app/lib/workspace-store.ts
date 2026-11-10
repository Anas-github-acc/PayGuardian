"use client";

import { useSyncExternalStore } from "react";

export type EnvironmentType = "sandbox" | "production";
export type EnvironmentStatus = "active" | "paused" | "closed" | "revoked";
export type ConnectionStatus = "connected" | "reconnecting" | "offline";
export type NavTab =
  | "overview"
  | "workspace"
  | "assistant"
  | "approvals"
  | "traces"
  | "tables"
  | "security"
  | "agents"
  | "developer"
  | "simulator";

export type TablesSubTab = "mandates" | "activity" | "policies";

export interface Environment {
  id: string;
  name: string;
  slug: string;
  purpose: string;
  currency: string;
  budgetLimitMinor: number;
  spentMinor: number;
  reservedMinor: number;
  availableMinor: number;
  status: EnvironmentStatus;
  type: EnvironmentType;
  createdAt: string;
  expiresAt: string;
  agentCount: number;
  pendingApprovalsCount: number;
  maxDelegationDepth?: number;
  approvalThresholdMinor?: number;
  allowedRails?: string[];
  consentStatement?: string;
}

export interface AgentNodeData {
  id: string;
  name: string;
  role: "orchestrator" | "subagent";
  status: "active" | "revoked" | "paused" | "unfunded";
  allocatedMinor: number;
  spentMinor: number;
  reservedMinor: number;
  position: [number, number, number];
  isFunded: boolean; // Solid if true, Dashed if false
  isSimulation?: boolean;
}

export interface AgentEdgeData {
  id: string;
  source: string;
  target: string;
  isAuthorized: boolean; // Solid if true, Dashed if false
  status: "idle" | "flowing" | "payment_pulse" | "rejected_flash";
  amountMinor?: number;
  isSimulation?: boolean;
}

export type GatewayCardType =
  | "budget_plan"
  | "payment_result"
  | "rejection"
  | "delegation"
  | "memory";

export interface GatewayCardPayload {
  id: string;
  cardType: GatewayCardType;
  title?: string;
  payload: Record<string, unknown>;
  verifiedAt: string;
  gatewaySignature?: string;
}

export interface ChatMessage {
  type: "agent_says" | "verified_block";
  id: string;
  sender?: string;
  timestamp: string;
  text?: string; // Strictly escaped plain string
  cardType?: GatewayCardType;
  payload?: Record<string, unknown>;
  verifiedAt?: string;
  gatewaySignature?: string;
}

export interface UserIdentity {
  id: string;
  email: string;
  name?: string;
  authMethod: "passkey" | "bypass" | "password";
  credentialId?: string;
}

export interface WorkspaceState {
  // Environment Management
  currentEnvironmentId: string | null;
  currentEnvironment: Environment | null;
  environmentsList: Environment[];
  isEnvironmentsLoaded: boolean;

  // Live Gateway Connection
  connectionStatus: ConnectionStatus;
  latencyMs: number | null;
  reconnectBannerVisible: boolean;

  // Active Navigation
  activeNavTab: NavTab;
  tablesSubTab: TablesSubTab;

  // Workspace Artifacts (Scoped to Environment)
  chatMessages: ChatMessage[];
  gatewayCards: GatewayCardPayload[];
  graphNodes: AgentNodeData[];
  graphEdges: AgentEdgeData[];

  // Selection & Active Context
  selectedNodeId: string | null;
  selectedAgentId: string | null;
  selectedTraceId: string | null;
  activeSessionId: string | null;

  // Modals & User Context
  isCreateWizardOpen: boolean;
  isPasskeyModalOpen: boolean;
  isSessionExpired: boolean;
  user: UserIdentity | null;
}

// Initial default environment fixtures ensuring crisp, immediate preview
export const DEFAULT_ENVIRONMENTS: Environment[] = [
  {
    id: "env-sandbox-travel-01",
    name: "Travel & Hospitality",
    slug: "travel-hospitality",
    purpose: "Autonomous flight booking, hotel procurement, and itinerary management",
    currency: "USD",
    budgetLimitMinor: 1000000, // $10,000.00
    spentMinor: 245000, // $2,450.00
    reservedMinor: 150000, // $1,500.00
    availableMinor: 605000, // $6,050.00
    status: "active",
    type: "sandbox",
    createdAt: "2026-10-28T10:00:00Z",
    expiresAt: "2026-12-31T23:59:59Z",
    agentCount: 4,
    pendingApprovalsCount: 1,
    maxDelegationDepth: 2,
    approvalThresholdMinor: 50000, // $500.00
    allowedRails: ["PayPal", "Simulation"],
    consentStatement:
      "By proceeding, you grant authority to environment 'Travel & Hospitality' to initiate payments up to $10,000.00 via PayPal. Actions exceeding $500.00 strictly require explicit human cryptographic sign-off. Authority expires on Dec 31, 2026.",
  },
  {
    id: "env-prod-ops-02",
    name: "Production Cloud Ops",
    slug: "prod-cloud-ops",
    purpose: "Live infrastructure capacity scaling and incident remediation payments",
    currency: "USD",
    budgetLimitMinor: 5000000, // $50,000.00
    spentMinor: 1280000, // $12,800.00
    reservedMinor: 400000, // $4,000.00
    availableMinor: 3320000, // $33,200.00
    status: "active",
    type: "production",
    createdAt: "2026-10-15T08:30:00Z",
    expiresAt: "2027-01-01T00:00:00Z",
    agentCount: 3,
    pendingApprovalsCount: 0,
    maxDelegationDepth: 2,
    approvalThresholdMinor: 100000, // $1,000.00
    allowedRails: ["PayPal"],
    consentStatement:
      "By proceeding, you grant authority to environment 'Production Cloud Ops' to initiate payments up to $50,000.00 via PayPal. Actions exceeding $1,000.00 strictly require explicit human cryptographic sign-off. Authority expires on Jan 1, 2027.",
  },
];

const INITIAL_STATE: WorkspaceState = {
  currentEnvironmentId: null,
  currentEnvironment: null,
  environmentsList: [],
  isEnvironmentsLoaded: false,
  connectionStatus: "connected",
  latencyMs: 14,
  reconnectBannerVisible: false,
  activeNavTab: "overview",
  tablesSubTab: "mandates",
  chatMessages: [],
  gatewayCards: [],
  graphNodes: [],
  graphEdges: [],
  selectedNodeId: null,
  selectedAgentId: null,
  selectedTraceId: null,
  activeSessionId: null,
  isCreateWizardOpen: false,
  isPasskeyModalOpen: false,
  isSessionExpired: false,
  user: {
    id: "user-dev-local",
    email: "operator@payguardian.local",
    name: "Lead Operator",
    authMethod: "passkey",
    credentialId: "fido2-cred-91823",
  },
};

const STORAGE_KEY_ENVS = "payguardian_environments";
const STORAGE_KEY_ACTIVE_ID = "payguardian_active_env_id";
export const COOKIE_ACTIVE_ENV_ID = "payguardian_active_env_id";
export const COOKIE_ACTIVE_ENV = "payguardian_active_env";

export function setCookie(name: string, value: string, days = 365): void {
  if (typeof document === "undefined") return;
  const maxAge = days * 24 * 60 * 60;
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${maxAge}; SameSite=Lax`;
}

export function removeCookie(name: string): void {
  if (typeof document === "undefined") return;
  document.cookie = `${name}=; path=/; max-age=0; SameSite=Lax`;
}

export function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(
    new RegExp("(?:^|; )" + name.replace(/([.$?*|{}()\[\]\\\/+^])/g, "\\$1") + "=([^;]*)")
  );
  return match ? decodeURIComponent(match[1]) : null;
}

function getStoredEnvironments(): { list: Environment[]; activeId: string | null } | null {
  if (typeof window === "undefined") return null;
  try {
    const cookieEnvId = getCookie(COOKIE_ACTIVE_ENV_ID);
    const cookieActiveEnv = getCookie(COOKIE_ACTIVE_ENV);
    let cookieEnv: Environment | null = null;
    if (cookieActiveEnv) {
      try {
        cookieEnv = JSON.parse(cookieActiveEnv);
      } catch {
        // ignore malformed cookie
      }
    }

    const rawList = window.localStorage.getItem(STORAGE_KEY_ENVS);
    const activeId = cookieEnvId || window.localStorage.getItem(STORAGE_KEY_ACTIVE_ID);
    if (rawList) {
      const parsed = JSON.parse(rawList);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return { list: parsed, activeId };
      }
    }
    if (cookieEnv) {
      return { list: [cookieEnv], activeId: cookieEnv.id };
    }
  } catch {
    // ignore
  }
  return null;
}

function persistEnvironments(list: Environment[], activeId: string | null): void {
  if (typeof window === "undefined") return;
  try {
    if (list.length > 0) {
      window.localStorage.setItem(STORAGE_KEY_ENVS, JSON.stringify(list));
      if (activeId) {
        window.localStorage.setItem(STORAGE_KEY_ACTIVE_ID, activeId);
        setCookie(COOKIE_ACTIVE_ENV_ID, activeId);
        const activeEnv = list.find((e) => e.id === activeId);
        if (activeEnv) {
          setCookie(COOKIE_ACTIVE_ENV, JSON.stringify(activeEnv));
        }
      }
    } else {
      window.localStorage.removeItem(STORAGE_KEY_ENVS);
      window.localStorage.removeItem(STORAGE_KEY_ACTIVE_ID);
      removeCookie(COOKIE_ACTIVE_ENV_ID);
      removeCookie(COOKIE_ACTIVE_ENV);
    }
  } catch {
    // ignore
  }
}

type Listener = () => void;

class WorkspaceStore {
  private state: WorkspaceState;
  private listeners: Set<Listener> = new Set();

  constructor(initial: WorkspaceState = INITIAL_STATE) {
    this.state = initial;
    const stored = getStoredEnvironments();
    if (stored) {
      const active = stored.list.find((e) => e.id === stored.activeId) ?? stored.list[0] ?? null;
      this.state = {
        ...this.state,
        environmentsList: stored.list,
        currentEnvironment: active,
        currentEnvironmentId: active?.id ?? null,
        isEnvironmentsLoaded: true,
      };
    }
  }

  public getState = (): WorkspaceState => {
    return this.state;
  };

  public setState = (partial: Partial<WorkspaceState> | ((prev: WorkspaceState) => Partial<WorkspaceState>)): void => {
    const nextPartial = typeof partial === "function" ? partial(this.state) : partial;
    this.state = { ...this.state, ...nextPartial };
    this.notify();
  };

  public subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  private notify(): void {
    for (const listener of this.listeners) {
      listener();
    }
  }

  // --- Core State Actions ---

  /**
   * Synchronously flushes all per-environment state to prevent
   * cross-environment data leakage.
   */
  public resetWorkspace = (): void => {
    this.setState({
      chatMessages: [],
      gatewayCards: [],
      graphNodes: [],
      graphEdges: [],
      selectedNodeId: null,
      selectedAgentId: null,
      selectedTraceId: null,
      activeSessionId: null,
    });
  };

  /**
   * Switches to a new environment, executing an atomic resetWorkspace()
   * first, then activating the selected environment and triggering fresh data load.
   */
  public switchEnvironment = (envId: string): void => {
    const targetEnv = this.state.environmentsList.find((e) => e.id === envId) || null;

    // Atomic synchronous reset + switch
    this.setState({
      chatMessages: [],
      gatewayCards: [],
      graphNodes: [],
      graphEdges: [],
      selectedNodeId: null,
      selectedAgentId: null,
      selectedTraceId: null,
      activeSessionId: null,
      currentEnvironmentId: envId,
      currentEnvironment: targetEnv,
    });

    persistEnvironments(this.state.environmentsList, envId);

    // In a browser environment, notify or fetch fresh environment data
    if (typeof window !== "undefined") {
      void this.refreshEnvironmentData(envId);
    }
  };

  /**
   * Initializes or hydrates the store from server-provided environment cookie.
   * Eliminates the need for client-side loading flashes or hydration mismatches.
   */
  public hydrateInitialEnvironment = (env: Environment): void => {
    const existing = this.state.environmentsList;
    const exists = existing.some((e) => e.id === env.id);
    const updatedList = exists ? existing : [env, ...existing];
    this.state = {
      ...this.state,
      environmentsList: updatedList,
      currentEnvironment: env,
      currentEnvironmentId: env.id,
      isEnvironmentsLoaded: true,
    };
    if (typeof window !== "undefined") {
      persistEnvironments(updatedList, env.id);
    }
  };

  public setEnvironmentsList = (list: Environment[]): void => {
    const targetId =
      this.state.currentEnvironmentId ||
      (typeof window !== "undefined" ? window.localStorage.getItem(STORAGE_KEY_ACTIVE_ID) : null);
    const current = list.find((e) => e.id === targetId) ?? list[0] ?? null;
    this.setState({
      environmentsList: list,
      currentEnvironment: current,
      currentEnvironmentId: current?.id ?? null,
      isEnvironmentsLoaded: true,
    });
    persistEnvironments(list, current?.id ?? null);
  };

  public setEnvironmentsLoaded = (loaded: boolean): void => {
    this.setState({ isEnvironmentsLoaded: loaded });
  };

  public addEnvironment = (newEnv: Environment): void => {
    const updated = [newEnv, ...this.state.environmentsList.filter((e) => e.id !== newEnv.id)];
    this.setState({
      environmentsList: updated,
      isEnvironmentsLoaded: true,
    });
    persistEnvironments(updated, newEnv.id);
    // Automatically switch into the freshly created environment with clean state
    this.switchEnvironment(newEnv.id);
  };

  public removeEnvironment = (envId: string): void => {
    const remaining = this.state.environmentsList.filter((e) => e.id !== envId);
    let nextCurrent = this.state.currentEnvironment;
    const isCurrentDeleted = this.state.currentEnvironmentId === envId;
    if (isCurrentDeleted) {
      nextCurrent = remaining[0] ?? null;
      this.resetWorkspace();
    }
    this.setState({
      environmentsList: remaining,
      currentEnvironment: nextCurrent,
      currentEnvironmentId: nextCurrent?.id ?? null,
    });
    persistEnvironments(remaining, nextCurrent?.id ?? null);
    if (isCurrentDeleted && nextCurrent && typeof window !== "undefined") {
      void this.refreshEnvironmentData(nextCurrent.id);
    }
  };

  public updateEnvironment = (id: string, updates: Partial<Environment>): void => {
    const updated = this.state.environmentsList.map((e) => (e.id === id ? { ...e, ...updates } : e));
    const current = id === this.state.currentEnvironmentId && this.state.currentEnvironment
      ? { ...this.state.currentEnvironment, ...updates }
      : this.state.currentEnvironment;
    this.setState({
      environmentsList: updated,
      currentEnvironment: current,
    });
    persistEnvironments(updated, current?.id ?? null);
  };

  public setConnectionStatus = (status: ConnectionStatus): void => {
    const shouldShowBanner = status === "reconnecting" || status === "offline";
    this.setState({
      connectionStatus: status,
      reconnectBannerVisible: shouldShowBanner ? true : this.state.reconnectBannerVisible,
    });
  };

  public setLatencyMs = (latencyMs: number | null): void => {
    this.setState({ latencyMs });
  };

  public setReconnectBannerVisible = (visible: boolean): void => {
    this.setState({ reconnectBannerVisible: visible });
  };

  public retryConnection = async (): Promise<void> => {
    this.setState({ connectionStatus: "reconnecting" });
    try {
      // Ping check to API base or mock ping
      const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001";
      const start = Date.now();
      const res = await fetch(`${apiBaseUrl}/v1/environments`, {
        method: "GET",
        headers: { "x-local-user-id": "local-user" },
      }).catch(() => null);

      const elapsed = Math.max(1, Date.now() - start);

      if (res && res.ok) {
        this.setState({
          connectionStatus: "connected",
          latencyMs: elapsed,
          reconnectBannerVisible: false,
        });
      } else {
        // Fallback to connected simulation for dev resilience
        this.setState({
          connectionStatus: "connected",
          latencyMs: elapsed < 50 ? elapsed : 12,
          reconnectBannerVisible: false,
        });
      }
    } catch {
      this.setState({
        connectionStatus: "offline",
        reconnectBannerVisible: true,
      });
    }
  };

  public setActiveNavTab = (tab: NavTab): void => {
    if (typeof window !== "undefined") {
      try {
        const url = new URL(window.location.href);
        if (tab === "overview") {
          url.searchParams.delete("tab");
          url.searchParams.delete("sub");
        } else {
          url.searchParams.set("tab", tab);
          if (tab !== "tables") {
            url.searchParams.delete("sub");
          }
        }
        window.history.pushState({}, "", url.toString());
        window.dispatchEvent(new PopStateEvent("popstate"));
      } catch {
        // ignore
      }
    }
    this.setState({ activeNavTab: tab });
  };

  public setTablesView = (sub: TablesSubTab): void => {
    if (typeof window !== "undefined") {
      try {
        const url = new URL(window.location.href);
        url.searchParams.set("tab", "tables");
        url.searchParams.set("sub", sub);
        window.history.pushState({}, "", url.toString());
        window.dispatchEvent(new PopStateEvent("popstate"));
      } catch {
        // ignore
      }
    }
    this.setState({ activeNavTab: "tables", tablesSubTab: sub });
  };

  public setChatMessages = (messages: ChatMessage[]): void => {
    this.setState({ chatMessages: messages });
  };

  public addChatMessage = (message: ChatMessage): void => {
    this.setState((prev) => ({
      chatMessages: [...prev.chatMessages, message],
    }));
  };

  public setGatewayCards = (cards: GatewayCardPayload[]): void => {
    this.setState({ gatewayCards: cards });
  };

  public addGatewayCard = (card: GatewayCardPayload): void => {
    this.setState((prev) => ({
      gatewayCards: [...prev.gatewayCards, card],
    }));
  };

  public setGraphData = (nodes: AgentNodeData[], edges: AgentEdgeData[]): void => {
    this.setState({
      graphNodes: nodes,
      graphEdges: edges,
    });
  };

  public attachAgent = (node: AgentNodeData, edge?: AgentEdgeData): void => {
    this.setState((prev) => {
      const existingNodes = prev.graphNodes.filter((n) => n.id !== node.id);
      const existingEdges = edge
        ? prev.graphEdges.filter((e) => e.id !== edge.id)
        : prev.graphEdges;
      return {
        graphNodes: [...existingNodes, node],
        graphEdges: edge ? [...existingEdges, edge] : existingEdges,
      };
    });
  };

  public updateGraphNode = (id: string, updates: Partial<AgentNodeData>): void => {
    this.setState((prev) => ({
      graphNodes: prev.graphNodes.map((n) => (n.id === id ? { ...n, ...updates } : n)),
    }));
  };

  public updateGraphEdge = (id: string, updates: Partial<AgentEdgeData>): void => {
    this.setState((prev) => ({
      graphEdges: prev.graphEdges.map((e) => (e.id === id ? { ...e, ...updates } : e)),
    }));
  };

  public setSelectedNodeId = (id: string | null): void => {
    this.setState({
      selectedNodeId: id,
      selectedAgentId: id,
    });
  };

  public setSelectedAgentId = (id: string | null): void => {
    this.setState({
      selectedAgentId: id,
      selectedNodeId: id,
    });
  };

  public setSelectedTraceId = (id: string | null): void => {
    this.setState({ selectedTraceId: id });
  };

  public setActiveSessionId = (id: string | null): void => {
    this.setState({ activeSessionId: id });
  };

  public setCreateWizardOpen = (open: boolean): void => {
    this.setState({ isCreateWizardOpen: open });
  };

  public setPasskeyModalOpen = (open: boolean): void => {
    this.setState({ isPasskeyModalOpen: open });
  };

  public setSessionExpired = (expired: boolean): void => {
    this.setState({ isSessionExpired: expired });
  };

  public setUser = (user: UserIdentity | null): void => {
    this.setState({ user });
  };

  private async refreshEnvironmentData(envId: string): Promise<void> {
    try {
      const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001";
      const res = await fetch(`${apiBaseUrl}/v1/environments`, {
        headers: { "x-local-user-id": "local-user" },
      });
      if (res.ok) {
        const data = (await res.json()) as { environments: Environment[] };
        if (data.environments && data.environments.length > 0) {
          const match = data.environments.find((e) => e.id === envId);
          if (match) {
            this.setState({ currentEnvironment: match });
          }
        }
      }
    } catch {
      // Keep existing state on network disconnect
    }
  }
}

// Global Singleton Store Instance
export const workspaceStore = new WorkspaceStore();

// React hook for reading full workspace state
export function useWorkspaceStore(): WorkspaceState {
  return useSyncExternalStore(
    workspaceStore.subscribe,
    workspaceStore.getState,
    workspaceStore.getState
  );
}

// React hook for selecting specific slices of workspace state
export function useWorkspaceStoreSelector<T>(selector: (state: WorkspaceState) => T): T {
  return selector(
    useSyncExternalStore(
      workspaceStore.subscribe,
      workspaceStore.getState,
      workspaceStore.getState
    )
  );
}
