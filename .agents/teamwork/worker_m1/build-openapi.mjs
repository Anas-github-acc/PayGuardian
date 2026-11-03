import fs from "node:fs";
import path from "node:path";

const openapi = {
  openapi: "3.1.0",
  info: {
    title: "PayGuardian API",
    description: "PayGuardian Gateway REST API and Agent Runtime specifications",
    version: "1.0.0"
  },
  servers: [
    {
      url: "http://127.0.0.1:3001",
      description: "Fastify Gateway API"
    },
    {
      url: "/api/proxy",
      description: "Next.js API Proxy"
    }
  ],
  paths: {
    "/health": {
      get: {
        operationId: "getHealth",
        summary: "Gateway Health Check",
        responses: {
          "200": {
            description: "Service health status",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/HealthResponse" }
              }
            }
          }
        }
      }
    },
    "/v1/system/status": {
      get: {
        operationId: "getSystemStatus",
        summary: "System Status",
        responses: {
          "200": {
            description: "System status",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/SystemStatusResponse" }
              }
            }
          }
        }
      }
    },
    "/v1/models": {
      get: {
        operationId: "listModels",
        summary: "List Available Models",
        responses: {
          "200": {
            description: "List of models",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["models"],
                  properties: {
                    models: {
                      type: "array",
                      items: {
                        type: "object",
                        required: ["id", "label", "provider"],
                        properties: {
                          id: { type: "string" },
                          label: { type: "string" },
                          provider: { type: "string" },
                          default: { type: "boolean" }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    },
    "/v1/environments": {
      get: {
        operationId: "listEnvironments",
        summary: "List user environments",
        responses: {
          "200": {
            description: "List of environments",
            content: {
              "application/json": {
                schema: {
                  type: "array",
                  items: { $ref: "#/components/schemas/EnvironmentDto" }
                }
              }
            }
          }
        }
      },
      post: {
        operationId: "createEnvironment",
        summary: "Create an isolated environment",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/CreateEnvironmentRequest" }
            }
          }
        },
        responses: {
          "201": {
            description: "Environment created",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/EnvironmentDto" }
              }
            }
          }
        }
      }
    },
    "/v1/environments/{environmentId}": {
      get: {
        operationId: "getEnvironment",
        summary: "Get environment details",
        parameters: [
          {
            name: "environmentId",
            in: "path",
            required: true,
            schema: { type: "string" }
          }
        ],
        responses: {
          "200": {
            description: "Environment details",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/EnvironmentDto" }
              }
            }
          }
        }
      }
    },
    "/v1/environments/{environmentId}/pause": {
      post: {
        operationId: "pauseEnvironment",
        summary: "Pause environment",
        parameters: [
          {
            name: "environmentId",
            in: "path",
            required: true,
            schema: { type: "string" }
          }
        ],
        responses: {
          "200": {
            description: "Updated environment",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/EnvironmentDto" }
              }
            }
          }
        }
      }
    },
    "/v1/environments/{environmentId}/resume": {
      post: {
        operationId: "resumeEnvironment",
        summary: "Resume environment",
        parameters: [
          {
            name: "environmentId",
            in: "path",
            required: true,
            schema: { type: "string" }
          }
        ],
        responses: {
          "200": {
            description: "Updated environment",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/EnvironmentDto" }
              }
            }
          }
        }
      }
    },
    "/v1/environments/{environmentId}/revoke": {
      post: {
        operationId: "revokeEnvironment",
        summary: "Revoke environment",
        parameters: [
          {
            name: "environmentId",
            in: "path",
            required: true,
            schema: { type: "string" }
          }
        ],
        responses: {
          "200": {
            description: "Updated environment",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/EnvironmentDto" }
              }
            }
          }
        }
      }
    },
    "/v1/environments/{environmentId}/agents": {
      get: {
        operationId: "listAgents",
        summary: "List agents in environment",
        parameters: [
          {
            name: "environmentId",
            in: "path",
            required: true,
            schema: { type: "string" }
          }
        ],
        responses: {
          "200": {
            description: "List of agents",
            content: {
              "application/json": {
                schema: {
                  type: "array",
                  items: { $ref: "#/components/schemas/AgentDto" }
                }
              }
            }
          }
        }
      }
    },
    "/v1/environments/{environmentId}/agents/root": {
      post: {
        operationId: "createRootAgent",
        summary: "Register root agent",
        parameters: [
          {
            name: "environmentId",
            in: "path",
            required: true,
            schema: { type: "string" }
          }
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/CreateRootAgentRequest" }
            }
          }
        },
        responses: {
          "201": {
            description: "Root agent created",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/AgentDto" }
              }
            }
          }
        }
      }
    },
    "/v1/environments/{environmentId}/agents/children": {
      post: {
        operationId: "registerChildAgent",
        summary: "Register child agent",
        parameters: [
          {
            name: "environmentId",
            in: "path",
            required: true,
            schema: { type: "string" }
          }
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/RegisterChildAgentRequest" }
            }
          }
        },
        responses: {
          "201": {
            description: "Child agent registered",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/AgentDto" }
              }
            }
          }
        }
      }
    },
    "/v1/environments/{environmentId}/agents/{agentId}/disable": {
      post: {
        operationId: "disableAgent",
        summary: "Disable an agent",
        parameters: [
          {
            name: "environmentId",
            in: "path",
            required: true,
            schema: { type: "string" }
          },
          {
            name: "agentId",
            in: "path",
            required: true,
            schema: { type: "string" }
          }
        ],
        responses: {
          "200": {
            description: "Disabled agent",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/AgentDto" }
              }
            }
          }
        }
      }
    },
    "/v1/environments/{environmentId}/agents/{agentId}/revoke": {
      post: {
        operationId: "revokeAgent",
        summary: "Revoke an agent",
        parameters: [
          {
            name: "environmentId",
            in: "path",
            required: true,
            schema: { type: "string" }
          },
          {
            name: "agentId",
            in: "path",
            required: true,
            schema: { type: "string" }
          }
        ],
        responses: {
          "200": {
            description: "Revoked agent",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/AgentDto" }
              }
            }
          }
        }
      }
    },
    "/v1/environments/{environmentId}/mandates": {
      get: {
        operationId: "listMandates",
        summary: "List mandates in environment",
        parameters: [
          {
            name: "environmentId",
            in: "path",
            required: true,
            schema: { type: "string" }
          }
        ],
        responses: {
          "200": {
            description: "List of mandates",
            content: {
              "application/json": {
                schema: {
                  type: "array",
                  items: { $ref: "#/components/schemas/MandateDto" }
                }
              }
            }
          }
        }
      }
    },
    "/v1/environments/{environmentId}/mandates/root": {
      post: {
        operationId: "createRootMandate",
        summary: "Create root mandate",
        parameters: [
          {
            name: "environmentId",
            in: "path",
            required: true,
            schema: { type: "string" }
          }
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/CreateRootMandateRequest" }
            }
          }
        },
        responses: {
          "201": {
            description: "Created mandate",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/MandateDto" }
              }
            }
          }
        }
      }
    },
    "/v1/mandates/{mandateId}": {
      get: {
        operationId: "getMandate",
        summary: "Get mandate details",
        parameters: [
          {
            name: "mandateId",
            in: "path",
            required: true,
            schema: { type: "string" }
          }
        ],
        responses: {
          "200": {
            description: "Mandate details",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/MandateDto" }
              }
            }
          }
        }
      }
    },
    "/v1/mandates/{mandateId}/delegations": {
      post: {
        operationId: "delegateMandate",
        summary: "Delegate narrower mandate to child agent",
        parameters: [
          {
            name: "mandateId",
            in: "path",
            required: true,
            schema: { type: "string" }
          }
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/DelegateMandateRequest" }
            }
          }
        },
        responses: {
          "201": {
            description: "Delegated child mandate",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/MandateDto" }
              }
            }
          }
        }
      }
    },
    "/v1/mandates/{mandateId}/revocations": {
      post: {
        operationId: "revokeMandate",
        summary: "Revoke mandate cascade",
        parameters: [
          {
            name: "mandateId",
            in: "path",
            required: true,
            schema: { type: "string" }
          }
        ],
        responses: {
          "200": {
            description: "Revoked mandate",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/MandateDto" }
              }
            }
          }
        }
      }
    },
    "/v1/mandates/{mandateId}/check": {
      post: {
        operationId: "checkMandatePolicy",
        summary: "Check mandate policy without executing",
        parameters: [
          {
            name: "mandateId",
            in: "path",
            required: true,
            schema: { type: "string" }
          }
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["action", "amountMinor", "currency"],
                properties: {
                  action: { type: "string" },
                  amountMinor: { type: "integer" },
                  currency: { type: "string" }
                }
              }
            }
          }
        },
        responses: {
          "200": {
            description: "Policy check result",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/PolicyDecisionDto" }
              }
            }
          }
        }
      }
    },
    "/v1/environments/{environmentId}/ledger/accounts": {
      get: {
        operationId: "listLedgerAccounts",
        summary: "List ledger accounts in environment",
        parameters: [
          {
            name: "environmentId",
            in: "path",
            required: true,
            schema: { type: "string" }
          }
        ],
        responses: {
          "200": {
            description: "List of ledger accounts",
            content: {
              "application/json": {
                schema: {
                  type: "array",
                  items: { $ref: "#/components/schemas/LedgerAccountDto" }
                }
              }
            }
          }
        }
      },
      post: {
        operationId: "createLedgerAccount",
        summary: "Create ledger account",
        parameters: [
          {
            name: "environmentId",
            in: "path",
            required: true,
            schema: { type: "string" }
          }
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["mandateId", "currency"],
                properties: {
                  mandateId: { type: "string" },
                  parentAccountId: { type: ["string", "null"] },
                  currency: { type: "string" },
                  initialDepositMinor: { type: "integer" }
                }
              }
            }
          }
        },
        responses: {
          "201": {
            description: "Created ledger account",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/LedgerAccountDto" }
              }
            }
          }
        }
      }
    },
    "/v1/environments/{environmentId}/ledger/accounts/{accountId}": {
      get: {
        operationId: "getLedgerAccount",
        summary: "Get ledger account details",
        parameters: [
          {
            name: "environmentId",
            in: "path",
            required: true,
            schema: { type: "string" }
          },
          {
            name: "accountId",
            in: "path",
            required: true,
            schema: { type: "string" }
          }
        ],
        responses: {
          "200": {
            description: "Ledger account details",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/LedgerAccountDto" }
              }
            }
          }
        }
      }
    },
    "/v1/environments/{environmentId}/ledger/allocations": {
      post: {
        operationId: "allocateLedgerFunds",
        summary: "Transfer budget between ledger accounts",
        parameters: [
          {
            name: "environmentId",
            in: "path",
            required: true,
            schema: { type: "string" }
          }
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["fromAccountId", "toAccountId", "amountMinor"],
                properties: {
                  fromAccountId: { type: "string" },
                  toAccountId: { type: "string" },
                  amountMinor: { type: "integer" }
                }
              }
            }
          }
        },
        responses: {
          "200": {
            description: "Allocation result",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["success", "allocationId"],
                  properties: {
                    success: { type: "boolean" },
                    allocationId: { type: "string" }
                  }
                }
              }
            }
          }
        }
      }
    },
    "/v1/environments/{environmentId}/actions/reserve": {
      post: {
        operationId: "reserveAction",
        summary: "Reserve funds for protected action",
        parameters: [
          {
            name: "environmentId",
            in: "path",
            required: true,
            schema: { type: "string" }
          }
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ActionReserveRequest" }
            }
          }
        },
        responses: {
          "200": {
            description: "Reservation response",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ActionReserveResponse" }
              }
            }
          }
        }
      }
    },
    "/v1/environments/{environmentId}/actions/{actionId}/capture": {
      post: {
        operationId: "captureAction",
        summary: "Capture held reservation",
        parameters: [
          {
            name: "environmentId",
            in: "path",
            required: true,
            schema: { type: "string" }
          },
          {
            name: "actionId",
            in: "path",
            required: true,
            schema: { type: "string" }
          }
        ],
        requestBody: {
          required: false,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  amountMinor: { type: "integer" }
                }
              }
            }
          }
        },
        responses: {
          "200": {
            description: "Capture result",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["success", "capturedMinor"],
                  properties: {
                    success: { type: "boolean" },
                    capturedMinor: { type: "integer" }
                  }
                }
              }
            }
          }
        }
      }
    },
    "/v1/environments/{environmentId}/actions/{actionId}/release": {
      post: {
        operationId: "releaseAction",
        summary: "Release held reservation back to account",
        parameters: [
          {
            name: "environmentId",
            in: "path",
            required: true,
            schema: { type: "string" }
          },
          {
            name: "actionId",
            in: "path",
            required: true,
            schema: { type: "string" }
          }
        ],
        responses: {
          "200": {
            description: "Release result",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["success", "releasedMinor"],
                  properties: {
                    success: { type: "boolean" },
                    releasedMinor: { type: "integer" }
                  }
                }
              }
            }
          }
        }
      }
    },
    "/v1/environments/{environmentId}/actions/simulate": {
      post: {
        operationId: "simulateAction",
        summary: "Simulate action execution",
        parameters: [
          {
            name: "environmentId",
            in: "path",
            required: true,
            schema: { type: "string" }
          }
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["agentId", "mandateId", "action", "amountMinor", "currency"],
                properties: {
                  agentId: { type: "string" },
                  mandateId: { type: "string" },
                  action: { type: "string" },
                  amountMinor: { type: "integer" },
                  currency: { type: "string" }
                }
              }
            }
          }
        },
        responses: {
          "200": {
            description: "Simulation result",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["allowed"],
                  properties: {
                    allowed: { type: "boolean" },
                    reason: { type: "string" }
                  }
                }
              }
            }
          }
        }
      }
    },
    "/v1/environments/{environmentId}/approvals": {
      get: {
        operationId: "listApprovals",
        summary: "List approvals in environment",
        parameters: [
          {
            name: "environmentId",
            in: "path",
            required: true,
            schema: { type: "string" }
          },
          {
            name: "status",
            in: "query",
            required: false,
            schema: { type: "string", enum: ["pending", "approved", "rejected"] }
          }
        ],
        responses: {
          "200": {
            description: "List of approvals",
            content: {
              "application/json": {
                schema: {
                  type: "array",
                  items: { $ref: "#/components/schemas/ApprovalDto" }
                }
              }
            }
          }
        }
      },
      post: {
        operationId: "createApproval",
        summary: "Submit action for human approval",
        parameters: [
          {
            name: "environmentId",
            in: "path",
            required: true,
            schema: { type: "string" }
          }
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["mandateId", "agentId", "action", "amountMinor", "currency", "requestHash"],
                properties: {
                  mandateId: { type: "string" },
                  agentId: { type: "string" },
                  action: { type: "string" },
                  amountMinor: { type: "integer" },
                  currency: { type: "string" },
                  requestHash: { type: "string" }
                }
              }
            }
          }
        },
        responses: {
          "201": {
            description: "Created approval request",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ApprovalDto" }
              }
            }
          }
        }
      }
    },
    "/v1/environments/{environmentId}/approvals/{approvalId}": {
      get: {
        operationId: "getApproval",
        summary: "Get approval details",
        parameters: [
          {
            name: "environmentId",
            in: "path",
            required: true,
            schema: { type: "string" }
          },
          {
            name: "approvalId",
            in: "path",
            required: true,
            schema: { type: "string" }
          }
        ],
        responses: {
          "200": {
            description: "Approval details",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ApprovalDto" }
              }
            }
          }
        }
      }
    },
    "/v1/environments/{environmentId}/approvals/{approvalId}/approve": {
      post: {
        operationId: "approveApproval",
        summary: "Approve approval request",
        parameters: [
          {
            name: "environmentId",
            in: "path",
            required: true,
            schema: { type: "string" }
          },
          {
            name: "approvalId",
            in: "path",
            required: true,
            schema: { type: "string" }
          }
        ],
        responses: {
          "200": {
            description: "Approved approval",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ApprovalDto" }
              }
            }
          }
        }
      }
    },
    "/v1/environments/{environmentId}/approvals/{approvalId}/reject": {
      post: {
        operationId: "rejectApproval",
        summary: "Reject approval request",
        parameters: [
          {
            name: "environmentId",
            in: "path",
            required: true,
            schema: { type: "string" }
          },
          {
            name: "approvalId",
            in: "path",
            required: true,
            schema: { type: "string" }
          }
        ],
        requestBody: {
          required: false,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  reason: { type: "string" }
                }
              }
            }
          }
        },
        responses: {
          "200": {
            description: "Rejected approval",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ApprovalDto" }
              }
            }
          }
        }
      }
    },
    "/v1/environments/{environmentId}/sessions": {
      get: {
        operationId: "listSessions",
        summary: "List sessions in environment",
        parameters: [
          {
            name: "environmentId",
            in: "path",
            required: true,
            schema: { type: "string" }
          }
        ],
        responses: {
          "200": {
            description: "List of sessions",
            content: {
              "application/json": {
                schema: {
                  type: "array",
                  items: { $ref: "#/components/schemas/SessionDto" }
                }
              }
            }
          }
        }
      },
      post: {
        operationId: "createSession",
        summary: "Create a session",
        parameters: [
          {
            name: "environmentId",
            in: "path",
            required: true,
            schema: { type: "string" }
          }
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["name"],
                properties: {
                  name: { type: "string" },
                  agentId: { type: ["string", "null"] },
                  context: { type: "object", additionalProperties: true }
                }
              }
            }
          }
        },
        responses: {
          "201": {
            description: "Created session",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/SessionDto" }
              }
            }
          }
        }
      }
    },
    "/v1/environments/{environmentId}/sessions/{sessionId}": {
      get: {
        operationId: "getSession",
        summary: "Get session details",
        parameters: [
          {
            name: "environmentId",
            in: "path",
            required: true,
            schema: { type: "string" }
          },
          {
            name: "sessionId",
            in: "path",
            required: true,
            schema: { type: "string" }
          }
        ],
        responses: {
          "200": {
            description: "Session details",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/SessionDto" }
              }
            }
          }
        }
      },
      patch: {
        operationId: "updateSession",
        summary: "Update session status or context",
        parameters: [
          {
            name: "environmentId",
            in: "path",
            required: true,
            schema: { type: "string" }
          },
          {
            name: "sessionId",
            in: "path",
            required: true,
            schema: { type: "string" }
          }
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  status: {
                    type: "string",
                    enum: ["active", "paused", "completed", "cancelled"]
                  },
                  context: { type: "object", additionalProperties: true }
                }
              }
            }
          }
        },
        responses: {
          "200": {
            description: "Updated session",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/SessionDto" }
              }
            }
          }
        }
      }
    },
    "/v1/environments/{environmentId}/sessions/{sessionId}/runs": {
      get: {
        operationId: "listSessionRuns",
        summary: "List session runs",
        parameters: [
          {
            name: "environmentId",
            in: "path",
            required: true,
            schema: { type: "string" }
          },
          {
            name: "sessionId",
            in: "path",
            required: true,
            schema: { type: "string" }
          }
        ],
        responses: {
          "200": {
            description: "List of session runs",
            content: {
              "application/json": {
                schema: {
                  type: "array",
                  items: { $ref: "#/components/schemas/SessionRunDto" }
                }
              }
            }
          }
        }
      },
      post: {
        operationId: "createSessionRun",
        summary: "Start a session run",
        parameters: [
          {
            name: "environmentId",
            in: "path",
            required: true,
            schema: { type: "string" }
          },
          {
            name: "sessionId",
            in: "path",
            required: true,
            schema: { type: "string" }
          }
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["agentId"],
                properties: {
                  agentId: { type: "string" }
                }
              }
            }
          }
        },
        responses: {
          "201": {
            description: "Created session run",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/SessionRunDto" }
              }
            }
          }
        }
      }
    },
    "/v1/environments/{environmentId}/sessions/{sessionId}/runs/{runId}": {
      patch: {
        operationId: "updateSessionRun",
        summary: "Update run checkpoint or status",
        parameters: [
          {
            name: "environmentId",
            in: "path",
            required: true,
            schema: { type: "string" }
          },
          {
            name: "sessionId",
            in: "path",
            required: true,
            schema: { type: "string" }
          },
          {
            name: "runId",
            in: "path",
            required: true,
            schema: { type: "string" }
          }
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  status: {
                    type: "string",
                    enum: ["running", "paused", "completed", "failed"]
                  },
                  checkpoint: { type: "object", additionalProperties: true }
                }
              }
            }
          }
        },
        responses: {
          "200": {
            description: "Updated session run",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/SessionRunDto" }
              }
            }
          }
        }
      }
    },
    "/v1/environments/{environmentId}/payments/paypal/orders": {
      post: {
        operationId: "createPayPalOrder",
        summary: "Create idempotent PayPal Sandbox order",
        parameters: [
          {
            name: "environmentId",
            in: "path",
            required: true,
            schema: { type: "string" }
          }
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/PayPalOrderRequest" }
            }
          }
        },
        responses: {
          "201": {
            description: "PayPal order created",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["actionId", "orderId"],
                  properties: {
                    actionId: { type: "string" },
                    orderId: { type: "string" },
                    approveUrl: { type: "string" }
                  }
                }
              }
            }
          }
        }
      }
    },
    "/v1/environments/{environmentId}/payments/paypal/{actionId}": {
      get: {
        operationId: "getPayPalOperation",
        summary: "Get PayPal operation and reconciliation status",
        parameters: [
          {
            name: "environmentId",
            in: "path",
            required: true,
            schema: { type: "string" }
          },
          {
            name: "actionId",
            in: "path",
            required: true,
            schema: { type: "string" }
          }
        ],
        responses: {
          "200": {
            description: "PayPal operation summary",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/PayPalOperationSummaryDto" }
              }
            }
          }
        }
      }
    },
    "/v1/environments/{environmentId}/payments/paypal/{actionId}/capture": {
      post: {
        operationId: "capturePayPalOrder",
        summary: "Capture approved PayPal order",
        parameters: [
          {
            name: "environmentId",
            in: "path",
            required: true,
            schema: { type: "string" }
          },
          {
            name: "actionId",
            in: "path",
            required: true,
            schema: { type: "string" }
          }
        ],
        responses: {
          "200": {
            description: "Captured operation summary",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/PayPalOperationSummaryDto" }
              }
            }
          }
        }
      }
    },
    "/v1/environments/{environmentId}/payments/paypal/operations": {
      get: {
        operationId: "listPayPalOperations",
        summary: "List PayPal operations in environment",
        parameters: [
          {
            name: "environmentId",
            in: "path",
            required: true,
            schema: { type: "string" }
          },
          {
            name: "since",
            in: "query",
            required: false,
            schema: { type: "string" }
          },
          {
            name: "limit",
            in: "query",
            required: false,
            schema: { type: "integer" }
          }
        ],
        responses: {
          "200": {
            description: "List of PayPal operations",
            content: {
              "application/json": {
                schema: {
                  type: "array",
                  items: { $ref: "#/components/schemas/PayPalOperationSummaryDto" }
                }
              }
            }
          }
        }
      }
    },
    "/v1/webhooks/paypal": {
      post: {
        operationId: "handlePayPalWebhook",
        summary: "PayPal webhook handler",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { type: "object", additionalProperties: true }
            }
          }
        },
        responses: {
          "200": {
            description: "Webhook receipt",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["received"],
                  properties: {
                    received: { type: "boolean" }
                  }
                }
              }
            }
          }
        }
      }
    },
    "/v1/environments/{environmentId}/activity": {
      get: {
        operationId: "listActivityEvents",
        summary: "Retrieve tamper-evident audit activity events",
        parameters: [
          {
            name: "environmentId",
            in: "path",
            required: true,
            schema: { type: "string" }
          },
          {
            name: "since",
            in: "query",
            required: false,
            schema: { type: "string" }
          },
          {
            name: "limit",
            in: "query",
            required: false,
            schema: { type: "integer" }
          }
        ],
        responses: {
          "200": {
            description: "List of audit events",
            content: {
              "application/json": {
                schema: {
                  type: "array",
                  items: { $ref: "#/components/schemas/AuditEventDto" }
                }
              }
            }
          }
        }
      }
    },
    "/agents": {
      get: {
        operationId: "runtimeGetAgents",
        summary: "Agent Runtime available agents",
        responses: {
          "200": {
            description: "List of runtime agents",
            content: {
              "application/json": {
                schema: { type: "object", additionalProperties: true }
              }
            }
          }
        }
      }
    },
    "/tools": {
      get: {
        operationId: "runtimeGetTools",
        summary: "Agent Runtime available tools",
        responses: {
          "200": {
            description: "List of runtime tools",
            content: {
              "application/json": {
                schema: { type: "object", additionalProperties: true }
              }
            }
          }
        }
      }
    },
    "/run": {
      post: {
        operationId: "runtimeRunAgent",
        summary: "Execute agent prompt run",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/RunRequest" }
            }
          }
        },
        responses: {
          "200": {
            description: "Agent run response",
            content: {
              "application/json": {
                schema: { type: "object", additionalProperties: true }
              }
            }
          }
        }
      }
    }
  },
  components: {
    schemas: {
      HealthResponse: {
        type: "object",
        required: ["status", "service", "phase"],
        properties: {
          status: { type: "string", enum: ["ok"] },
          service: { type: "string" },
          phase: { type: "string" }
        }
      },
      SystemStatusResponse: {
        type: "object",
        required: ["service", "authorityEnforcement", "message"],
        properties: {
          service: { type: "string" },
          authorityEnforcement: { type: "string" },
          message: { type: "string" }
        }
      },
      EnvironmentDto: {
        type: "object",
        required: [
          "id",
          "name",
          "purpose",
          "currency",
          "budgetLimitMinor",
          "status",
          "createdAt"
        ],
        properties: {
          id: { type: "string" },
          name: { type: "string" },
          purpose: { type: "string" },
          currency: { type: "string" },
          budgetLimitMinor: { type: "integer" },
          status: { type: "string", enum: ["active", "paused", "revoked"] },
          createdAt: { type: "string" }
        }
      },
      CreateEnvironmentRequest: {
        type: "object",
        required: ["name", "purpose", "currency", "budgetLimitMinor"],
        properties: {
          name: { type: "string" },
          purpose: { type: "string" },
          currency: { type: "string" },
          budgetLimitMinor: { type: "integer" }
        }
      },
      AgentDto: {
        type: "object",
        required: [
          "id",
          "environmentId",
          "name",
          "kind",
          "status",
          "createdAt"
        ],
        properties: {
          id: { type: "string" },
          environmentId: { type: "string" },
          name: { type: "string" },
          kind: { type: "string" },
          parentAgentId: { type: ["string", "null"] },
          status: { type: "string", enum: ["active", "disabled", "revoked"] },
          createdAt: { type: "string" }
        }
      },
      CreateRootAgentRequest: {
        type: "object",
        required: ["name"],
        properties: {
          name: { type: "string" },
          capabilities: {
            type: "array",
            items: { type: "string" }
          }
        }
      },
      RegisterChildAgentRequest: {
        type: "object",
        required: ["parentAgentId", "name", "kind"],
        properties: {
          parentAgentId: { type: "string" },
          name: { type: "string" },
          kind: { type: "string" },
          capabilities: {
            type: "array",
            items: { type: "string" }
          }
        }
      },
      MandateDto: {
        type: "object",
        required: [
          "id",
          "environmentId",
          "issuerUserId",
          "holderAgentId",
          "budgetLimitMinor",
          "allocatedMinor",
          "spentMinor",
          "reservedMinor",
          "currency",
          "permittedActions",
          "expiresAt",
          "canDelegate",
          "maxDelegationDepth",
          "approvalRequired",
          "state",
          "createdAt"
        ],
        properties: {
          id: { type: "string" },
          environmentId: { type: "string" },
          issuerUserId: { type: "string" },
          holderAgentId: { type: "string" },
          parentMandateId: { type: ["string", "null"] },
          budgetLimitMinor: { type: "integer" },
          allocatedMinor: { type: "integer" },
          spentMinor: { type: "integer" },
          reservedMinor: { type: "integer" },
          currency: { type: "string" },
          permittedActions: {
            type: "array",
            items: { type: "string" }
          },
          expiresAt: { type: "string" },
          canDelegate: { type: "boolean" },
          maxDelegationDepth: { type: "integer" },
          approvalRequired: { type: "boolean" },
          state: { type: "string", enum: ["active", "expired", "revoked"] },
          revokedAt: { type: ["string", "null"] },
          createdAt: { type: "string" }
        }
      },
      CreateRootMandateRequest: {
        type: "object",
        required: [
          "holderAgentId",
          "budgetLimitMinor",
          "currency",
          "permittedActions",
          "expiresAt",
          "canDelegate",
          "maxDelegationDepth",
          "approvalRequired"
        ],
        properties: {
          holderAgentId: { type: "string" },
          budgetLimitMinor: { type: "integer" },
          currency: { type: "string" },
          permittedActions: {
            type: "array",
            items: { type: "string" }
          },
          expiresAt: { type: "string" },
          canDelegate: { type: "boolean" },
          maxDelegationDepth: { type: "integer" },
          approvalRequired: { type: "boolean" }
        }
      },
      DelegateMandateRequest: {
        type: "object",
        required: [
          "holderAgentId",
          "budgetLimitMinor",
          "currency",
          "permittedActions",
          "expiresAt",
          "canDelegate",
          "maxDelegationDepth",
          "approvalRequired"
        ],
        properties: {
          holderAgentId: { type: "string" },
          budgetLimitMinor: { type: "integer" },
          currency: { type: "string" },
          permittedActions: {
            type: "array",
            items: { type: "string" }
          },
          expiresAt: { type: "string" },
          canDelegate: { type: "boolean" },
          maxDelegationDepth: { type: "integer" },
          approvalRequired: { type: "boolean" }
        }
      },
      PolicyDecisionDto: {
        type: "object",
        required: ["allowed", "code", "reason"],
        properties: {
          allowed: { type: "boolean" },
          code: {
            type: "string",
            enum: [
              "ALLOW",
              "MANDATE_NOT_FOUND",
              "MANDATE_REVOKED",
              "MANDATE_EXPIRED",
              "ACTION_NOT_PERMITTED",
              "BUDGET_EXCEEDED",
              "DELEGATION_NOT_PERMITTED",
              "DELEGATION_DEPTH_EXCEEDED",
              "CURRENCY_MISMATCH",
              "APPROVAL_REQUIRED"
            ]
          },
          reason: { type: "string" }
        }
      },
      LedgerAccountDto: {
        type: "object",
        required: [
          "id",
          "environmentId",
          "mandateId",
          "currency",
          "availableMinor",
          "reservedMinor",
          "capturedMinor"
        ],
        properties: {
          id: { type: "string" },
          environmentId: { type: "string" },
          mandateId: { type: "string" },
          parentAccountId: { type: ["string", "null"] },
          currency: { type: "string" },
          availableMinor: { type: "integer" },
          reservedMinor: { type: "integer" },
          capturedMinor: { type: "integer" }
        }
      },
      ActionReserveRequest: {
        type: "object",
        required: [
          "agentId",
          "mandateId",
          "ledgerAccountId",
          "idempotencyKey",
          "requestHash",
          "action",
          "amountMinor",
          "currency"
        ],
        properties: {
          agentId: { type: "string" },
          mandateId: { type: "string" },
          ledgerAccountId: { type: "string" },
          idempotencyKey: { type: "string" },
          requestHash: { type: "string" },
          action: { type: "string" },
          amountMinor: { type: "integer" },
          currency: { type: "string" },
          approvalId: { type: "string" }
        }
      },
      ActionReserveResponse: {
        type: "object",
        required: ["action", "reservation"],
        properties: {
          action: {
            type: "object",
            required: [
              "id",
              "environmentId",
              "agentId",
              "mandateId",
              "idempotencyKey",
              "requestHash",
              "action",
              "amountMinor",
              "currency",
              "authorizationState",
              "executionState",
              "createdAt"
            ],
            properties: {
              id: { type: "string" },
              environmentId: { type: "string" },
              agentId: { type: "string" },
              mandateId: { type: "string" },
              idempotencyKey: { type: "string" },
              requestHash: { type: "string" },
              action: { type: "string" },
              amountMinor: { type: "integer" },
              currency: { type: "string" },
              authorizationState: { type: "string" },
              executionState: { type: "string" },
              createdAt: { type: "string" }
            }
          },
          reservation: {
            type: "object",
            required: ["actionId", "accountId", "amountMinor", "state"],
            properties: {
              actionId: { type: "string" },
              accountId: { type: "string" },
              amountMinor: { type: "integer" },
              state: { type: "string", enum: ["held", "captured", "released"] }
            }
          }
        }
      },
      ApprovalDto: {
        type: "object",
        required: [
          "id",
          "environmentId",
          "mandateId",
          "agentId",
          "action",
          "amountMinor",
          "currency",
          "requestHash",
          "status",
          "createdAt",
          "updatedAt"
        ],
        properties: {
          id: { type: "string" },
          environmentId: { type: "string" },
          mandateId: { type: "string" },
          agentId: { type: "string" },
          action: { type: "string" },
          amountMinor: { type: "integer" },
          currency: { type: "string" },
          requestHash: { type: "string" },
          status: { type: "string", enum: ["pending", "approved", "rejected"] },
          approvedBy: { type: ["string", "null"] },
          approvedAt: { type: ["string", "null"] },
          rejectionReason: { type: ["string", "null"] },
          createdAt: { type: "string" },
          updatedAt: { type: "string" }
        }
      },
      SessionDto: {
        type: "object",
        required: [
          "id",
          "environmentId",
          "name",
          "status",
          "context",
          "createdAt",
          "updatedAt"
        ],
        properties: {
          id: { type: "string" },
          environmentId: { type: "string" },
          agentId: { type: ["string", "null"] },
          name: { type: "string" },
          status: {
            type: "string",
            enum: ["active", "paused", "completed", "cancelled"]
          },
          context: { type: "object", additionalProperties: true },
          createdAt: { type: "string" },
          updatedAt: { type: "string" }
        }
      },
      SessionRunDto: {
        type: "object",
        required: [
          "id",
          "sessionId",
          "agentId",
          "status",
          "checkpoint",
          "createdAt",
          "updatedAt"
        ],
        properties: {
          id: { type: "string" },
          sessionId: { type: "string" },
          agentId: { type: "string" },
          status: {
            type: "string",
            enum: ["running", "paused", "completed", "failed"]
          },
          checkpoint: { type: "object", additionalProperties: true },
          createdAt: { type: "string" },
          updatedAt: { type: "string" }
        }
      },
      PayPalOrderRequest: {
        type: "object",
        required: [
          "agentId",
          "mandateId",
          "ledgerAccountId",
          "idempotencyKey",
          "requestHash",
          "action",
          "amountMinor",
          "currency"
        ],
        properties: {
          agentId: { type: "string" },
          mandateId: { type: "string" },
          ledgerAccountId: { type: "string" },
          idempotencyKey: { type: "string" },
          requestHash: { type: "string" },
          action: { type: "string" },
          amountMinor: { type: "integer" },
          currency: { type: "string", enum: ["USD"] },
          approvalId: { type: "string" },
          returnUrl: { type: "string" },
          cancelUrl: { type: "string" }
        }
      },
      PayPalOperationSummaryDto: {
        type: "object",
        required: [
          "actionId",
          "provider",
          "status",
          "reconciliationState",
          "createdAt",
          "updatedAt"
        ],
        properties: {
          actionId: { type: "string" },
          provider: { type: "string", enum: ["paypal"] },
          providerOrderId: { type: ["string", "null"] },
          status: { type: "string" },
          observedProviderStatus: { type: ["string", "null"] },
          captureId: { type: ["string", "null"] },
          reconciliationState: {
            type: "string",
            enum: ["pending", "resolved", "uncertain"]
          },
          amountMinor: { type: ["integer", "null"] },
          currency: { type: ["string", "null"] },
          authorizationState: { type: ["string", "null"] },
          executionState: { type: ["string", "null"] },
          lastCheckedAt: { type: ["string", "null"] },
          lastEventAt: { type: ["string", "null"] },
          lastErrorCode: { type: ["string", "null"] },
          createdAt: { type: "string" },
          updatedAt: { type: "string" }
        }
      },
      AuditEventDto: {
        type: "object",
        required: [
          "id",
          "environmentId",
          "actorType",
          "eventType",
          "outcome",
          "payload",
          "eventHash",
          "createdAt"
        ],
        properties: {
          id: { type: "string" },
          environmentId: { type: "string" },
          actorType: {
            type: "string",
            enum: ["user", "agent", "service", "system"]
          },
          actorId: { type: ["string", "null"] },
          sessionId: { type: ["string", "null"] },
          mandateId: { type: ["string", "null"] },
          actionId: { type: ["string", "null"] },
          eventType: { type: "string" },
          outcome: {
            type: "string",
            enum: ["success", "denied", "failure"]
          },
          reasonCode: { type: ["string", "null"] },
          payload: { type: "object", additionalProperties: true },
          previousHash: { type: ["string", "null"] },
          eventHash: { type: "string" },
          createdAt: { type: "string" }
        }
      },
      RunRequest: {
        type: "object",
        required: ["message"],
        properties: {
          agent: { type: "string", default: "personal" },
          message: { type: "string" },
          dry_run: { type: "boolean", default: true },
          environment_id: { type: ["string", "null"] },
          mandate_id: { type: ["string", "null"] },
          action: { type: ["string", "null"] },
          amount_minor: { type: ["integer", "null"] },
          currency: { type: "string", default: "USD" },
          parameters: { type: ["object", "null"], additionalProperties: true }
        }
      }
    }
  }
};

const outputPath = path.resolve(process.cwd(), "apps/web/openapi.json");
fs.writeFileSync(outputPath, JSON.stringify(openapi, null, 2), "utf-8");
console.log(`Successfully generated ${outputPath}`);
