import { describe, expect, it } from "vitest";
import { mapApprovalDtoToItem, mapApprovalsToItems } from "../../../lib/api/mappers/approvals";
import { mapBackendTraceToView } from "../../../lib/api/mappers/payment-trace";
import { apiClient } from "../../../lib/api/client";
import type { ApprovalDto, AgentDto, MandateDto } from "@payguardian/contracts";

describe("Screen 3 (Approvals) & Screen 4 (Payment Trace) Integration Contracts", () => {
  const mockAgents: AgentDto[] = [
    {
      id: "agt-root",
      environmentId: "env-1",
      name: "Main Orchestrator",
      kind: "orchestrator",
      parentAgentId: null,
      status: "active",
      createdAt: "2026-11-01T00:00:00Z",
    },
    {
      id: "agt-procure",
      environmentId: "env-1",
      name: "Procurement Subagent",
      kind: "specialist",
      parentAgentId: "agt-root",
      status: "active",
      createdAt: "2026-11-01T00:01:00Z",
    },
  ];

  const mockMandates: MandateDto[] = [
    {
      id: "man-root",
      environmentId: "env-1",
      issuerUserId: "usr-1",
      holderAgentId: "agt-root",
      parentMandateId: null,
      budgetLimitMinor: 1000000,
      allocatedMinor: 500000,
      spentMinor: 200000,
      reservedMinor: 50000,
      currency: "USD",
      permittedActions: ["*"],
      expiresAt: "2026-12-01T00:00:00Z",
      canDelegate: true,
      maxDelegationDepth: 2,
      approvalRequired: false,
      state: "active",
      revokedAt: null,
      createdAt: "2026-11-01T00:00:00Z",
    },
    {
      id: "man-procure",
      environmentId: "env-1",
      issuerUserId: "usr-1",
      holderAgentId: "agt-procure",
      parentMandateId: "man-root",
      budgetLimitMinor: 500000, // $5,000.00
      allocatedMinor: 500000,
      spentMinor: 100000, // $1,000.00
      reservedMinor: 50000, // $500.00
      currency: "USD",
      permittedActions: ["vendor.pay"],
      expiresAt: "2026-12-01T00:00:00Z",
      canDelegate: false,
      maxDelegationDepth: 0,
      approvalRequired: true,
      state: "active",
      revokedAt: null,
      createdAt: "2026-11-01T00:01:00Z",
    },
  ];

  describe("Screen 3 (Approvals) Data Mapping & Gating", () => {
    it("permits approve and reject actions when amount is within mandate budget", () => {
      const dto: ApprovalDto = {
        id: "appr-valid-1",
        environmentId: "env-1",
        mandateId: "man-procure",
        agentId: "agt-procure",
        action: "vendor.pay",
        amountMinor: 250000, // $2,500.00 (within $5,000.00 limit)
        currency: "USD",
        requestHash: "0xhash999",
        status: "pending",
        approvedBy: null,
        approvedAt: null,
        rejectionReason: null,
        createdAt: "2026-11-01T14:00:00Z",
        updatedAt: "2026-11-01T14:00:00Z",
      };

      const item = mapApprovalDtoToItem(dto, mockAgents, mockMandates);

      expect(item.id).toBe("appr-valid-1");
      expect(item.amountMinor).toBe(250000);
      expect(item.currency).toBe("USD");
      expect(item.isHardLimitExceeded).toBe(false);
      expect(item.allowedActions).toEqual(["approve", "reject"]);
      expect(item.ancestorChain).toHaveLength(3);
      expect(item.ancestorChain[0].name).toBe("You (Operator)");
      expect(item.ancestorChain[1].name).toBe("Main Orchestrator");
      expect(item.ancestorChain[2].name).toBe("Procurement Subagent");
    });

    it("locks approve action and only permits reject when hard limit is exceeded", () => {
      const dto: ApprovalDto = {
        id: "appr-exceeded-2",
        environmentId: "env-1",
        mandateId: "man-procure",
        agentId: "agt-procure",
        action: "vendor.pay",
        amountMinor: 600000, // $6,000.00 (exceeds $5,000.00 limit)
        currency: "USD",
        requestHash: "0xhash888",
        status: "pending",
        approvedBy: null,
        approvedAt: null,
        rejectionReason: null,
        createdAt: "2026-11-01T14:00:00Z",
        updatedAt: "2026-11-01T14:00:00Z",
      };

      const item = mapApprovalDtoToItem(dto, mockAgents, mockMandates);

      expect(item.isHardLimitExceeded).toBe(true);
      expect(item.allowedActions).toEqual(["reject"]);
      expect(item.hardLimitExceededReason).toBe("Requested amount exceeds limit of 500000");
    });

    it("respects backend-provided allowed_actions over client computation", () => {
      const dtoWithBackendAllowed = {
        id: "appr-custom-3",
        environmentId: "env-1",
        mandateId: "man-procure",
        agentId: "agt-procure",
        action: "vendor.pay",
        amountMinor: 10000,
        currency: "USD",
        requestHash: "0xhash777",
        status: "pending" as const,
        approvedBy: null,
        approvedAt: null,
        rejectionReason: null,
        createdAt: "2026-11-01T14:00:00Z",
        updatedAt: "2026-11-01T14:00:00Z",
        allowed_actions: ["reject"],
      } as unknown as ApprovalDto;

      const item = mapApprovalDtoToItem(dtoWithBackendAllowed, mockAgents, mockMandates);

      expect(item.allowedActions).toEqual(["reject"]);
    });

    it("disallows all actions once an approval is decided", () => {
      const approvedDto: ApprovalDto = {
        id: "appr-approved",
        environmentId: "env-1",
        mandateId: "man-procure",
        agentId: "agt-procure",
        action: "vendor.pay",
        amountMinor: 10000,
        currency: "USD",
        requestHash: "0xhash666",
        status: "approved",
        approvedBy: "operator@payguardian.local",
        approvedAt: "2026-11-01T15:00:00Z",
        rejectionReason: null,
        createdAt: "2026-11-01T14:00:00Z",
        updatedAt: "2026-11-01T15:00:00Z",
      };

      const item = mapApprovalDtoToItem(approvedDto, mockAgents, mockMandates);
      expect(item.allowedActions).toEqual([]);
      expect(item.status).toBe("approved");
    });

    it("batch maps approval dtos into items correctly", () => {
      const dtos: ApprovalDto[] = [
        {
          id: "appr-a",
          environmentId: "env-1",
          mandateId: "man-procure",
          agentId: "agt-procure",
          action: "vendor.pay",
          amountMinor: 10000,
          currency: "USD",
          requestHash: "0xa",
          status: "pending",
          approvedBy: null,
          approvedAt: null,
          rejectionReason: null,
          createdAt: "2026-11-01T14:00:00Z",
          updatedAt: "2026-11-01T14:00:00Z",
        },
        {
          id: "appr-b",
          environmentId: "env-1",
          mandateId: "man-procure",
          agentId: "agt-procure",
          action: "vendor.pay",
          amountMinor: 800000,
          currency: "USD",
          requestHash: "0xb",
          status: "pending",
          approvedBy: null,
          approvedAt: null,
          rejectionReason: null,
          createdAt: "2026-11-01T14:00:00Z",
          updatedAt: "2026-11-01T14:00:00Z",
        },
      ];

      const items = mapApprovalsToItems(dtos, mockAgents, mockMandates);
      expect(items).toHaveLength(2);
      expect(items[0].allowedActions).toEqual(["approve", "reject"]);
      expect(items[1].allowedActions).toEqual(["reject"]);
    });
  });

  describe("Screen 4 (Payment Trace) Live Data Mapping & GAP-TRC-01 Compliance", () => {
    it("maps real action, agent, mandate chain, operation, and reservation data", () => {
      const trace = mapBackendTraceToView({
        action: {
          id: "act-real-1",
          environmentId: "env-live",
          amountMinor: 89000,
          currency: "USD",
          authorizationState: "authorized",
          executionState: "reserved",
          createdAt: "2026-11-01T18:00:00Z",
        },
        agent: {
          id: "agt-procure",
          environmentId: "env-live",
          name: "Procurement Agent",
          kind: "specialist",
          parentAgentId: "agt-root",
          status: "active",
          createdAt: "2026-11-01T00:00:00Z",
        },
        mandateChain: [
          {
            id: "man-root",
            environmentId: "env-live",
            issuerUserId: "usr-1",
            holderAgentId: "agt-root",
            parentMandateId: null,
            budgetLimitMinor: 1000000,
            allocatedMinor: 500000,
            spentMinor: 100000,
            reservedMinor: 89000,
            currency: "USD",
            permittedActions: ["*"],
            expiresAt: "2026-12-01T00:00:00Z",
            canDelegate: true,
            maxDelegationDepth: 1,
            approvalRequired: false,
            state: "active",
            revokedAt: null,
            createdAt: "2026-11-01T00:00:00Z",
          },
          {
            id: "man-procure",
            environmentId: "env-live",
            issuerUserId: "usr-1",
            holderAgentId: "agt-procure",
            parentMandateId: "man-root",
            budgetLimitMinor: 500000,
            allocatedMinor: 500000,
            spentMinor: 50000,
            reservedMinor: 89000,
            currency: "USD",
            permittedActions: ["vendor.pay"],
            expiresAt: "2026-12-01T00:00:00Z",
            canDelegate: false,
            maxDelegationDepth: 0,
            approvalRequired: false,
            state: "active",
            revokedAt: null,
            createdAt: "2026-11-01T00:00:00Z",
          },
        ],
        reservation: {
          actionId: "act-real-1",
          accountId: "acc-1",
          amountMinor: 89000,
          state: "held",
        },
      });

      expect(trace.id).toBe("trace-act-real-1");
      expect(trace.amountMinor).toBe(89000);
      expect(trace.currency).toBe("USD");
      expect(trace.status).toBe("pending_capture");
      expect(trace.uncertainStateNotice).toBeDefined();

      // Auth chain mapped from real mandate chain
      expect(trace.authChain).toHaveLength(2);
      expect(trace.authChain[0].name).toBe("Root Authority");
      expect(trace.authChain[0].availableMinor).toBe(811000); // 1000000 - 100000 - 89000
      expect(trace.authChain[1].name).toBe("Delegated Agent (agt-proc)");
      expect(trace.authChain[1].availableMinor).toBe(361000); // 500000 - 50000 - 89000

      // Per R2: Never invent data (GAP-TRC-01)
      expect(trace.totalLatencyMs).toBe(0);
      expect(trace.stages).toHaveLength(0);
      expect(trace.checklist).toHaveLength(0);

      // Raw record preserves all upstream metadata
      expect(trace.rawRecord.action).toBeDefined();
      expect(trace.rawRecord.agent).toBeDefined();
      expect(trace.rawRecord.mandateChain).toHaveLength(2);
      expect(trace.rawRecord.reservation).toBeDefined();
    });

    it("verifies ApiClient exposes actions and trace endpoints", () => {
      expect(apiClient.actions).toBeDefined();
      expect(typeof apiClient.actions.get).toBe("function");
      expect(typeof apiClient.actions.getTrace).toBe("function");
      expect(apiClient.approvals).toBeDefined();
      expect(typeof apiClient.approvals.approve).toBe("function");
      expect(typeof apiClient.approvals.reject).toBe("function");
    });
  });
});
