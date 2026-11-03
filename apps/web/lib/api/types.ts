export interface SessionItem {
  id: string;
  title: string;
  description?: string;
  status: "active" | "waiting for you" | "done";
  lastActivity: string;
  agentCount: number;
}

export interface MemoryItem {
  id: string;
  category: "session" | "environment" | "agent";
  key: string;
  value: string;
  contextSnippet?: string;
  agentName?: string;
  savedAt: string;
  isRevoked?: boolean;
}

export interface ActivityFeedItem {
  id: string;
  timestamp: string;
  actorName: string;
  action: string;
  amountMinor?: number;
  currency?: string;
  outcome: "success" | "denied" | "pending";
  reasonCode?: string;
  isSimulation?: boolean;
  traceId?: string;
}
