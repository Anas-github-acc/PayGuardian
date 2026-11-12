/**
 * Client-side cache for Mandates table values (agent, limit, spent, reserved, available).
 * Stores values in localStorage scoped by environment ID for instantaneous UI display.
 */

export interface CachedMandateRow {
  id: string;
  holderAgentId: string;
  agentName: string;
  role: "orchestrator" | "subagent";
  budgetLimitMinor: number;
  spentMinor: number;
  reservedMinor: number;
  availableMinor: number;
  currency: string;
  updatedAt: string;
}

const STORAGE_PREFIX = "pg_mandates_cache_";

export function getCachedMandates(environmentId?: string | null): CachedMandateRow[] {
  if (typeof window === "undefined" || !environmentId) return [];
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${environmentId}`);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed;
    }
  } catch (err) {
    console.warn("Failed to read cached mandates:", err);
  }
  return [];
}

export function saveCachedMandates(environmentId: string, mandates: CachedMandateRow[]): void {
  if (typeof window === "undefined" || !environmentId) return;
  try {
    localStorage.setItem(`${STORAGE_PREFIX}${environmentId}`, JSON.stringify(mandates));
  } catch (err) {
    console.warn("Failed to persist mandates cache:", err);
  }
}
