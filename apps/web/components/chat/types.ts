import type { GatewayCardType } from "../../app/lib/workspace-store";

export type { GatewayCardType };

export interface AgentSaysMessage {
  type: "agent_says";
  id: string;
  sender: string;
  timestamp: string;
  text: string; // Plain string, strictly escaped
  role?: string;
}

export interface VerifiedBlockMessage {
  type: "verified_block";
  id: string;
  cardType: GatewayCardType;
  payload: Record<string, unknown>;
  verifiedAt: string;
  gatewaySignature?: string;
  sender?: string;
  text?: string;
}

export type ChatMessageItem = AgentSaysMessage | VerifiedBlockMessage;
