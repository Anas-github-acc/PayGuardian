import type { MemoryItem } from "../types";

export interface MemoryVaultState {
  isUnavailable: true;
  reason: string;
  items: MemoryItem[];
}

export function getMemoryVaultUnavailableState(): MemoryVaultState {
  return {
    isUnavailable: true,
    reason:
      "Agent Memory Vault API is not implemented in Fastify Gateway backend (Contract Gap GAP-MEM-01).",
    items: [],
  };
}
