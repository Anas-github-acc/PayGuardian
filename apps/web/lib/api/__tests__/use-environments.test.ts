import { describe, expect, it, vi, beforeEach } from "vitest";
import { apiClient } from "../client";
import { mapEnvironmentDto } from "../mappers/environment";
import { workspaceStore } from "../../../app/lib/workspace-store";
import type { EnvironmentDto, AgentDto, MandateDto } from "@payguardian/contracts";

describe("Environment Mappers and Workspace Store Integration", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    workspaceStore.setEnvironmentsList([]);
    workspaceStore.setEnvironmentsLoaded(false);
  });

  it("maps EnvironmentDto accurately into frontend Environment model", () => {
    const dto: EnvironmentDto = {
      id: "env-test-42",
      name: "Autonomous Logistics",
      purpose: "Fleet fuel and maintenance procurement",
      currency: "USD",
      budgetLimitMinor: 500000,
      status: "active",
      createdAt: "2026-11-01T00:00:00Z",
    };

    const mapped = mapEnvironmentDto(dto);
    expect(mapped.id).toBe("env-test-42");
    expect(mapped.name).toBe("Autonomous Logistics");
    expect(mapped.slug).toBe("autonomous-logistics");
    expect(mapped.budgetLimitMinor).toBe(500000);
    expect(mapped.spentMinor).toBe(0);
    expect(mapped.reservedMinor).toBe(0);
    expect(mapped.availableMinor).toBe(500000);
    expect(mapped.status).toBe("active");
    expect(mapped.agentCount).toBe(1);
    expect(mapped.maxDelegationDepth).toBe(2);
  });

  it("populates workspace store when setEnvironmentsList is called", () => {
    const fakeEnvs: EnvironmentDto[] = [
      {
        id: "env-prod-1",
        name: "Production Cloud",
        purpose: "Infra scale",
        currency: "USD",
        budgetLimitMinor: 2000000,
        status: "active",
        createdAt: "2026-11-01T00:00:00Z",
      },
    ];

    const mapped = fakeEnvs.map((e) => mapEnvironmentDto(e));
    workspaceStore.setEnvironmentsList(mapped);

    const state = workspaceStore.getState();
    expect(state.isEnvironmentsLoaded).toBe(true);
    expect(state.environmentsList).toHaveLength(1);
    expect(state.currentEnvironment?.id).toBe("env-prod-1");
  });

  it("handles zero environments from backend cleanly without inventing fake data", () => {
    workspaceStore.setEnvironmentsList([]);

    const state = workspaceStore.getState();
    expect(state.isEnvironmentsLoaded).toBe(true);
    expect(state.environmentsList).toHaveLength(0);
    expect(state.currentEnvironment).toBeNull();
    expect(state.currentEnvironmentId).toBeNull();
  });

  it("unwraps backend environment and agent creation correctly", async () => {
    const createdEnvDto: EnvironmentDto = {
      id: "env-new-123",
      name: "Hotel Logistics",
      purpose: "Hotel booking",
      currency: "USD",
      budgetLimitMinor: 1000000,
      status: "active",
      createdAt: "2026-11-03T00:00:00Z",
    };

    const rootAgentDto: AgentDto = {
      id: "agent-root-99",
      environmentId: "env-new-123",
      name: "Personal Agent",
      kind: "personal",
      parentAgentId: null,
      status: "active",
      createdAt: "2026-11-03T00:00:00Z",
    };

    const rootMandateDto: MandateDto = {
      id: "mandate-root-11",
      environmentId: "env-new-123",
      issuerUserId: "user-dev-local",
      holderAgentId: "agent-root-99",
      parentMandateId: null,
      budgetLimitMinor: 1000000,
      allocatedMinor: 1000000,
      spentMinor: 0,
      reservedMinor: 0,
      currency: "USD",
      permittedActions: ["*"],
      expiresAt: "2027-01-01T00:00:00Z",
      canDelegate: true,
      maxDelegationDepth: 2,
      approvalRequired: true,
      state: "active",
      revokedAt: null,
      createdAt: "2026-11-03T00:00:00Z",
    };

    // Test unwrapping when API responds with wrapped { environment: ... } or raw
    vi.spyOn(apiClient, "post").mockImplementation(async (path) => {
      if (path === "/v1/environments") {
        return { environment: createdEnvDto } as unknown as never;
      }
      if (path.includes("/agents/root")) {
        return { agent: rootAgentDto } as unknown as never;
      }
      if (path.includes("/mandates/root")) {
        return { mandate: rootMandateDto } as unknown as never;
      }
      return {} as unknown as never;
    });

    const env = await apiClient.environments.create({
      name: "Hotel Logistics",
      purpose: "Hotel booking",
      currency: "USD",
      budgetLimitMinor: 1000000,
    });
    expect(env.id).toBe("env-new-123");

    const rootAgent = await apiClient.agents.createRoot(env.id, {
      name: "Personal Agent",
    });
    expect(rootAgent.id).toBe("agent-root-99");

    const rootMandate = await apiClient.mandates.createRoot(env.id, {
      holderAgentId: rootAgent.id,
      budgetLimitMinor: 1000000,
      currency: "USD",
      permittedActions: ["*"],
      expiresAt: "2027-01-01T00:00:00Z",
      canDelegate: true,
      maxDelegationDepth: 2,
      approvalRequired: true,
    });
    expect(rootMandate.id).toBe("mandate-root-11");
  });
});
