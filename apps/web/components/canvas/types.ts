import type {
  AgentNodeData as BaseAgentNodeData,
  AgentEdgeData as BaseAgentEdgeData,
} from "../../app/lib/workspace-store";

export type NodeStatus = "active" | "revoked" | "paused" | "unfunded";
export type NodeRole = "orchestrator" | "subagent";
export type EdgeStatus = "idle" | "flowing" | "payment_pulse" | "rejected_flash";

export interface ExtendedAgentNodeData extends BaseAgentNodeData {
  publisherSource?: "platform" | "third-party" | "custom";
  mandateId?: string;
  allowedRails?: string[];
  maxDepth?: number;
  purpose?: string;
  singleTransactionLimitMinor?: number;
  parentAgentId?: string | null;
}

export type AgentNodeData = ExtendedAgentNodeData;
export type AgentEdgeData = BaseAgentEdgeData;

export type CanvasViewFilter = "all" | "funded" | "unfunded";
export type CanvasViewMode = "3d" | "list";

export interface CanvasSelectionState {
  selectedNodeId: string | null;
  hoveredNodeId: string | null;
}
