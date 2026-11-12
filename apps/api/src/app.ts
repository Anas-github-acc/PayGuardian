import Fastify, { type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import swagger from "@fastify/swagger";
import { loadRuntimeConfig, type RuntimeConfig } from "@payguardian/config";
import { createPrincipalResolver } from "./auth.js";
import { createAuditStore, type AuditEventStore } from "./audit.js";
import { createRegistry, createSupabaseClient, type Registry } from "./phase1.js";
import { registerPhase1Routes } from "./phase1-routes.js";
import { createAuthorityStore, type AuthorityStore } from "./phase2.js";
import { registerPhase2Routes } from "./phase2-routes.js";
import { createLedgerStore, type LedgerStore } from "./phase3.js";
import { registerPhase3Routes } from "./phase3-routes.js";
import {
  createPayPalOperationStore,
  createPayPalWorkerOrderStore,
  type PayPalClient,
  type PayPalOperationStore,
  type PayPalWorkerOrderStore,
} from "./paypal.js";
import { registerPayPalRoutes } from "./paypal-routes.js";
import { createProviderEventStore, type ProviderEventStore } from "./paypal-events.js";
import { createProviderJobStore, type ProviderJobStore } from "./provider-jobs.js";
import {
  createApprovalStore,
  createSessionStore,
  type ApprovalStore,
  type SessionStore,
} from "./phase4.js";
import { registerPhase4Routes } from "./phase4-routes.js";
import { registerPhase6Routes } from "./phase6-routes.js";
import { AGENT_CATALOG } from "./agent-catalog.js";
import { createChatbotStore, type ChatbotStore } from "./chatbot.js";
import { registerChatbotRoutes } from "./chatbot-routes.js";

export function buildApp(
  options: {
    logger?: boolean;
    registry?: Registry;
    authority?: AuthorityStore;
    ledger?: LedgerStore;
    approvals?: ApprovalStore;
    sessions?: SessionStore;
    chatbot?: ChatbotStore;
    paypalOperations?: PayPalOperationStore;
    paypalWorkerOrder?: PayPalWorkerOrderStore | null;
    paypal?: PayPalClient;
    providerEvents?: ProviderEventStore;
    providerJobs?: ProviderJobStore;
    audit?: AuditEventStore;
    config?: RuntimeConfig;
    resolvePrincipal?: ReturnType<typeof createPrincipalResolver>;
  } = {},
): FastifyInstance {
  const config = options.config ?? loadRuntimeConfig();
  const app = Fastify({ logger: options.logger ?? false });

  app.removeContentTypeParser("application/json");
  app.addContentTypeParser("application/json", { parseAs: "string" }, (_req, body: string, done) => {
    try {
      if (!body || body.trim() === "") {
        done(null, {});
        return;
      }
      done(null, JSON.parse(body));
    } catch (err) {
      done(err as Error, undefined);
    }
  });

  app.register(cors, { origin: process.env.CORS_ORIGIN ?? "http://localhost:3000" });

  app.register(swagger, {
    openapi: {
      info: {
        title: "PayGuardian Gateway API",
        description: "PayGuardian gateway API.",
        version: "0.2.0",
      },
      servers: [{ url: "http://localhost:3001" }],
      tags: [{ name: "system", description: "Service health and metadata" }],
    },
  });
  app.get("/docs/json", async () => app.swagger());

  const supabaseClient = createSupabaseClient();
  const registry = options.registry ?? createRegistry();
  const authority = options.authority ?? createAuthorityStore(supabaseClient);
  const ledger = options.ledger ?? createLedgerStore(supabaseClient);
  const approvals = options.approvals ?? createApprovalStore(supabaseClient);
  const sessions = options.sessions ?? createSessionStore(supabaseClient);
  const paypalOperations = options.paypalOperations ?? createPayPalOperationStore(supabaseClient);
  const paypalWorkerOrder =
    options.paypalWorkerOrder ?? createPayPalWorkerOrderStore(supabaseClient);
  const providerEvents = options.providerEvents ?? createProviderEventStore(supabaseClient);
  const providerJobs = options.providerJobs ?? createProviderJobStore(supabaseClient);
  const chatbot = options.chatbot ?? createChatbotStore(supabaseClient);
  const audit = options.audit ?? createAuditStore(supabaseClient);
  const resolvePrincipal =
    options.resolvePrincipal ?? createPrincipalResolver(supabaseClient, config, registry);

  app.register(async (routes) => {
    routes.get(
      "/health",
      {
        schema: {
          tags: ["system"],
          response: {
            200: {
              type: "object",
              required: ["status", "service", "phase"],
              properties: {
                status: { type: "string", enum: ["ok"] },
                service: { type: "string" },
                phase: { type: "string" },
              },
            },
          },
        },
      },
      async () => ({
        status: "ok",
        service: "gateway-api",
        phase: "repository-and-deployment-proof",
      }),
    );

    routes.get(
      "/v1/system/status",
      {
        schema: {
          tags: ["system"],
          response: {
            200: {
              type: "object",
              required: ["service", "authorityEnforcement"],
              properties: {
                service: { type: "string" },
                authorityEnforcement: { type: "string", enum: ["not-enabled"] },
                message: { type: "string" },
              },
            },
          },
        },
      },
      async () => ({
        service: "gateway-api",
        authorityEnforcement: "not-enabled",
        message: "Phase 0 exposes health and contract proof only.",
      }),
    );

    routes.get(
      "/v1/models",
      {
        schema: {
          tags: ["system"],
          response: {
            200: {
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
                      default: { type: "boolean" },
                    },
                  },
                },
              },
            },
          },
        },
      },
      async () => {
        const apiKey = process.env.GEMINI_API_KEY;
        const primary = process.env.GEMINI_MODEL ?? "gemini-2.5-flash";

        const apinexModel = {
          id: "free/gpt-6-luna",
          label: "APInex GPT-6 Luna (Free)",
          provider: "APInex",
          default: true,
        };

        const googleModels: Array<{ id: string; label: string; provider: string; default: boolean }> = [];

        // If a Google AI API key is configured, dynamically discover available models from Google AI
        if (apiKey) {
          try {
            const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
            if (res.ok) {
              const data = (await res.json()) as { models?: Array<any> };
              if (Array.isArray(data.models)) {
                for (const m of data.models) {
                  if (
                    m.name &&
                    m.supportedGenerationMethods?.includes("generateContent") &&
                    m.name.includes("gemini")
                  ) {
                    const id = m.name.replace(/^models\//, "");
                    googleModels.push({
                      id,
                      label: m.displayName || id.replace(/-/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase()),
                      provider: "Google Gemini",
                      default: false,
                    });
                  }
                }
              }
            }
          } catch (err) {
            // fallback to default catalog on network or key issue
          }
        }

        if (googleModels.length === 0) {
          googleModels.push(
            { id: "gemini-3.8-flash", label: "Gemini 3.8 Flash (Free)", provider: "Google Gemini", default: false },
            { id: "gemini-2.5-flash", label: "Gemini 2.5 Flash", provider: "Google Gemini", default: false },
            { id: "gemini-2.5-pro", label: "Gemini 2.5 Pro", provider: "Google Gemini", default: false },
            { id: "gemini-2.5-flash-lite", label: "Gemini 2.5 Flash-Lite (Free)", provider: "Google Gemini", default: false },
          );
        }

        return { models: [apinexModel, ...googleModels] };
      },
    );

    routes.get(
      "/v1/agents/catalog",
      {
        schema: {
          tags: ["agents"],
          response: {
            200: {
              type: "object",
              required: ["catalog"],
              properties: {
                catalog: {
                  type: "array",
                },
              },
            },
          },
        },
      },
      async () => {
        return { catalog: AGENT_CATALOG };
      },
    );
  });

  registerPhase1Routes(app, { registry, resolvePrincipal, audit });
  registerPhase2Routes(app, { registry, authority, ledger, approvals, resolvePrincipal, audit });
  registerPhase3Routes(app, { registry, authority, ledger, resolvePrincipal, audit, approvals });
  registerPhase4Routes(app, { registry, authority, approvals, sessions, resolvePrincipal, audit });
  registerPayPalRoutes(app, {
    registry,
    authority,
    ledger,
    operations: paypalOperations,
    workerOrder: paypalWorkerOrder,
    paypal: options.paypal,
    providerEvents,
    providerJobs,
    resolvePrincipal,
    approvals,
    audit,
  });
  registerPhase6Routes(app, { registry, authority, resolvePrincipal, audit });
  registerChatbotRoutes(app, { registry, authority, chatbot, providerJobs, resolvePrincipal, audit, approvals });

  return app;
}
