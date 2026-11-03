import { describe, expect, it } from "vitest";
import { mapAgentDtoToSpecialist } from "../mappers/library";
import { mapSessionDtoToItem, mapSessionsToItems } from "../mappers/sessions";
import { getMemoryVaultUnavailableState } from "../mappers/memory";
import * as workspaceDefaults from "../../../components/workspace/workspace-defaults";
import * as agentTypes from "../../../components/agents/types";
import type { AgentDto, SessionDto } from "@payguardian/contracts";

describe("Milestone 4: Screen 5 (Library), Screen 6 (Sessions), and Screen 7 (Memory) Integration", () => {
  describe("Screen 5 (Library) Integration & Fixture Removal", () => {
    it("maps AgentDto to SpecialistAgent with integer minor units and role awareness", () => {
      const rootAgentDto: AgentDto = {
        id: "agt-root-1",
        environmentId: "env-1",
        name: "Main Orchestrator",
        kind: "orchestrator",
        parentAgentId: null,
        status: "active",
        createdAt: "2026-11-01T00:00:00Z",
      };

      const childAgentDto: AgentDto = {
        id: "agt-child-1",
        environmentId: "env-1",
        name: "Travel Specialist",
        kind: "logistics",
        parentAgentId: "agt-root-1",
        status: "active",
        createdAt: "2026-11-01T00:05:00Z",
      };

      const rootSpecialist = mapAgentDtoToSpecialist(rootAgentDto);
      expect(rootSpecialist.id).toBe("agt-root-1");
      expect(rootSpecialist.role).toBe("orchestrator");
      expect(rootSpecialist.authorityTier).toContain("Tier 1");
      expect(rootSpecialist.tierLevel).toBe(1);
      expect(rootSpecialist.recommendedBudgetMinor).toBe(100000); // Integer minor units ($1,000.00)
      expect(rootSpecialist.isAttached).toBe(true);

      const childSpecialist = mapAgentDtoToSpecialist(childAgentDto);
      expect(childSpecialist.id).toBe("agt-child-1");
      expect(childSpecialist.role).toBe("subagent");
      expect(childSpecialist.authorityTier).toContain("Tier 2");
      expect(childSpecialist.tierLevel).toBe(2);
      expect(childSpecialist.recommendedBudgetMinor).toBe(100000);
      expect(childSpecialist.isAttached).toBe(true);
    });

    it("confirms CATALOG_AGENTS mock fixture array is completely deleted from types", () => {
      // In accordance with R2 and the integrity mandate, CATALOG_AGENTS must not exist
      expect((agentTypes as Record<string, unknown>).CATALOG_AGENTS).toBeUndefined();
    });
  });

  describe("Screen 6 (Sessions) Integration & Fixture Removal", () => {
    it("maps backend SessionDto objects to component SessionItem prop format without client-side fake IDs", () => {
      const activeSession: SessionDto = {
        id: "sess-prod-01",
        environmentId: "env-1",
        agentId: "agt-root-1",
        name: "Goa Logistics Thread",
        status: "active",
        context: { description: "Flight procurement and hotel bookings for conference" },
        createdAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
        updatedAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
      };

      const pausedSession: SessionDto = {
        id: "sess-prod-02",
        environmentId: "env-1",
        agentId: null,
        name: "Awaiting Human Sign-off",
        status: "paused",
        context: {},
        createdAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
        updatedAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
      };

      const completedSession: SessionDto = {
        id: "sess-prod-03",
        environmentId: "env-1",
        agentId: null,
        name: "Completed Reconciliations",
        status: "completed",
        context: { description: "Audited ledger entries" },
        createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
        updatedAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
      };

      const singleItem = mapSessionDtoToItem(activeSession);
      expect(singleItem.id).toBe("sess-prod-01");
      expect(singleItem.status).toBe("active");

      const items = mapSessionsToItems([activeSession, pausedSession, completedSession]);

      expect(items).toHaveLength(3);

      expect(items[0].id).toBe("sess-prod-01");
      expect(items[0].title).toBe("Goa Logistics Thread");
      expect(items[0].description).toBe("Flight procurement and hotel bookings for conference");
      expect(items[0].status).toBe("active");
      expect(items[0].lastActivity).toContain("5m ago");
      expect(items[0].agentCount).toBe(1);

      expect(items[1].id).toBe("sess-prod-02");
      expect(items[1].status).toBe("waiting for you");
      expect(items[1].lastActivity).toContain("1h ago");
      expect(items[1].agentCount).toBe(0);

      expect(items[2].id).toBe("sess-prod-03");
      expect(items[2].status).toBe("done");
      expect(items[2].description).toBe("Audited ledger entries");
    });

    it("confirms INITIAL_SESSIONS mock fixture array is completely deleted", () => {
      expect((workspaceDefaults as Record<string, unknown>).INITIAL_SESSIONS).toBeUndefined();
    });
  });

  describe("Screen 7 (Memory) Integration & Unavailable State", () => {
    it("returns explicit unavailable state referencing GAP-MEM-01 per R2 (Never invent data)", () => {
      const state = getMemoryVaultUnavailableState();

      expect(state.isUnavailable).toBe(true);
      expect(state.items).toEqual([]);
      expect(state.reason).toContain("GAP-MEM-01");
      expect(state.reason).toContain("Fastify Gateway");
    });

    it("confirms INITIAL_MEMORIES mock fixture array is completely deleted", () => {
      expect((workspaceDefaults as Record<string, unknown>).INITIAL_MEMORIES).toBeUndefined();
    });
  });

  describe("Workspace Defaults Final Mock Cleanup", () => {
    it("guarantees zero mock array exports from workspace-defaults.ts", () => {
      const exportedKeys = Object.keys(workspaceDefaults);
      // Only type declarations/interfaces were in workspace-defaults.ts, which emit zero runtime objects
      // Ensure no mock arrays exist
      expect((workspaceDefaults as Record<string, unknown>).DEFAULT_GRAPH_NODES).toBeUndefined();
      expect((workspaceDefaults as Record<string, unknown>).DEFAULT_GRAPH_EDGES).toBeUndefined();
      expect((workspaceDefaults as Record<string, unknown>).INITIAL_ACTIVITIES).toBeUndefined();
      expect((workspaceDefaults as Record<string, unknown>).INITIAL_SESSIONS).toBeUndefined();
      expect((workspaceDefaults as Record<string, unknown>).INITIAL_MEMORIES).toBeUndefined();
      expect((workspaceDefaults as Record<string, unknown>).DEFAULT_CHAT_MESSAGES).toBeUndefined();
      expect(exportedKeys).toHaveLength(0);
    });
  });
});
