import Fastify, { type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
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

export function buildApp(
  options: {
    logger?: boolean;
    registry?: Registry;
    authority?: AuthorityStore;
    ledger?: LedgerStore;
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

  app.register(swaggerUi, { routePrefix: "/docs" });

  const supabaseClient = createSupabaseClient();
  const registry = options.registry ?? createRegistry();
  const authority = options.authority ?? createAuthorityStore(supabaseClient);
  const ledger = options.ledger ?? createLedgerStore(supabaseClient);
  const paypalOperations = options.paypalOperations ?? createPayPalOperationStore(supabaseClient);
  const paypalWorkerOrder =
    options.paypalWorkerOrder ?? createPayPalWorkerOrderStore(supabaseClient);
  const providerEvents = options.providerEvents ?? createProviderEventStore(supabaseClient);
  const providerJobs = options.providerJobs ?? createProviderJobStore(supabaseClient);
  const audit = options.audit ?? createAuditStore(supabaseClient);
  const resolvePrincipal =
    options.resolvePrincipal ?? createPrincipalResolver(supabaseClient, config);

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
  });

  registerPhase1Routes(app, { registry, resolvePrincipal, audit });
  registerPhase2Routes(app, { registry, authority, resolvePrincipal, audit });
  registerPhase3Routes(app, { registry, authority, ledger, resolvePrincipal, audit });
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
  });

  return app;
}
