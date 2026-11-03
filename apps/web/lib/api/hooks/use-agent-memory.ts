"use client";

import { useMemo } from "react";
import { getMemoryVaultUnavailableState } from "../mappers/memory";
import type { MemoryItem } from "../types";

export interface UseAgentMemoryResult {
  memories: MemoryItem[];
  isUnavailable: true;
  reason: string;
}

export function useAgentMemory(_environmentId?: string | null): UseAgentMemoryResult {
  void _environmentId;
  // Screen 8 (Memory) has zero backend representation in Fastify Gateway
  // Render explicit unavailable state per R2 specification
  return useMemo(() => {
    const state = getMemoryVaultUnavailableState();
    return {
      memories: state.items,
      isUnavailable: true,
      reason: state.reason,
    };
  }, []);
}
