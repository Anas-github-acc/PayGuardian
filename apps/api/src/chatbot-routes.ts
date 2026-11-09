import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { PrincipalResolver } from "./auth.js";
import type { Registry } from "./phase1.js";
import type { AuthorityStore } from "./phase2.js";
import type { AuditEventStore } from "./audit.js";
import type { ProviderJobStore } from "./provider-jobs.js";
import type { AgentEvent, ChatbotStore } from "./chatbot.js";

type AppRequest = FastifyRequest & {
  principal?: { userId: string; kind: "user" | "agent"; agentId?: string };
};

export type ChatbotRouteDependencies = {
  registry: Registry;
  authority?: AuthorityStore;
  chatbot: ChatbotStore;
  providerJobs: ProviderJobStore;
  resolvePrincipal: PrincipalResolver;
  audit?: AuditEventStore;
};

async function principal(
  request: AppRequest,
  reply: FastifyReply,
  resolvePrincipal: PrincipalResolver,
) {
  const query = (request.query as Record<string, unknown>) ?? {};
  const tokenQuery =
    typeof query.token === "string"
      ? (query.token as string)
      : typeof query.access_token === "string"
      ? (query.access_token as string)
      : undefined;

  const authHeader =
    request.headers.authorization ??
    (tokenQuery && tokenQuery !== "local-user"
      ? tokenQuery.startsWith("Bearer ")
        ? tokenQuery
        : `Bearer ${tokenQuery}`
      : undefined);

  const localUserId =
    (typeof request.headers["x-local-user-id"] === "string"
      ? request.headers["x-local-user-id"]
      : undefined) ??
    (typeof query.localUserId === "string" ? (query.localUserId as string) : undefined) ??
    (tokenQuery === "local-user" ? "local-user" : undefined);

  const resolved = await resolvePrincipal(authHeader, localUserId);
  if (!resolved) {
    await reply
      .code(401)
      .send({ code: "AUTHENTICATION_REQUIRED", message: "Authentication required." });
    return null;
  }
  request.principal = resolved;
  return resolved;
}

async function environmentFor(
  request: AppRequest,
  reply: FastifyReply,
  registry: Registry,
  resolvePrincipal: PrincipalResolver,
  environmentId: string,
) {
  const owner = await principal(request, reply, resolvePrincipal);
  if (!owner) return null;
  const environment = await registry.getEnvironment(owner.userId, environmentId);
  if (!environment) {
    await reply
      .code(404)
      .send({ code: "ENVIRONMENT_NOT_FOUND", message: "Environment not found." });
    return null;
  }
  return { owner, environment };
}

export function registerChatbotRoutes(
  app: FastifyInstance,
  dependencies: ChatbotRouteDependencies,
): void {
  // POST /v1/environments/:environmentId/conversations
  app.post<{
    Params: { environmentId: string };
    Body?: { title?: string };
  }>("/v1/environments/:environmentId/conversations", async (request, reply) => {
    const scoped = await environmentFor(
      request as AppRequest,
      reply,
      dependencies.registry,
      dependencies.resolvePrincipal,
      request.params.environmentId,
    );
    if (!scoped) return;

    const conversation = await dependencies.chatbot.createConversation({
      environmentId: scoped.environment.id,
      userId: scoped.owner.userId,
      title: request.body?.title,
    });

    if (dependencies.audit) {
      await dependencies.audit.append({
        environmentId: scoped.environment.id,
        actorType: scoped.owner.kind,
        actorId: scoped.owner.userId,
        eventType: "conversation.created",
        outcome: "success",
        payload: { conversationId: conversation.id, title: conversation.title },
      });
    }

    return reply.code(201).send({ conversation });
  });

  // GET /v1/environments/:environmentId/conversations
  app.get<{
    Params: { environmentId: string };
  }>("/v1/environments/:environmentId/conversations", async (request, reply) => {
    const scoped = await environmentFor(
      request as AppRequest,
      reply,
      dependencies.registry,
      dependencies.resolvePrincipal,
      request.params.environmentId,
    );
    if (!scoped) return;

    const conversations = await dependencies.chatbot.listConversations(
      scoped.environment.id,
      scoped.owner.userId,
    );

    return reply.code(200).send({ conversations });
  });

  // GET /v1/environments/:environmentId/conversations/:conversationId/messages
  app.get<{
    Params: { environmentId: string; conversationId: string };
  }>("/v1/environments/:environmentId/conversations/:conversationId/messages", async (request, reply) => {
    const scoped = await environmentFor(
      request as AppRequest,
      reply,
      dependencies.registry,
      dependencies.resolvePrincipal,
      request.params.environmentId,
    );
    if (!scoped) return;

    const conversation = await dependencies.chatbot.getConversation(
      scoped.environment.id,
      request.params.conversationId,
    );
    if (!conversation) {
      return reply
        .code(404)
        .send({ code: "CONVERSATION_NOT_FOUND", message: "Conversation not found." });
    }

    const messages = await dependencies.chatbot.listMessages(conversation.id);
    const mapped = messages.map((m) => ({
      ...m,
      role: m.role || "user",
      sender_type: m.role || "user",
      senderType: m.role || "user",
    }));
    return reply.code(200).send({ messages: mapped });
  });

  // GET /v1/environments/:environmentId/conversations/:conversationId/context
  app.get<{
    Params: { environmentId: string; conversationId: string };
  }>("/v1/environments/:environmentId/conversations/:conversationId/context", async (request, reply) => {
    const scoped = await environmentFor(
      request as AppRequest,
      reply,
      dependencies.registry,
      dependencies.resolvePrincipal,
      request.params.environmentId,
    );
    if (!scoped) return;

    const conversation = await dependencies.chatbot.getConversation(
      scoped.environment.id,
      request.params.conversationId,
    );
    if (!conversation) {
      return reply
        .code(404)
        .send({ code: "CONVERSATION_NOT_FOUND", message: "Conversation not found." });
    }

    const messages = await dependencies.chatbot.listMessages(conversation.id);

    // Resolve active mandate and budget
    let mandateId: string | undefined;
    let budgetLimitMinor: number = scoped.environment.budgetLimitMinor ?? 0;
    let budgetCurrency: string = scoped.environment.currency ?? "USD";

    let childMandates: any[] = [];
    if (dependencies.authority) {
      try {
        const mandates = await dependencies.authority.list(scoped.environment.id, scoped.owner.userId);
        const activeMandate =
          mandates.find((m) => !m.parentMandateId && m.state === "active") ||
          mandates.find((m) => !m.parentMandateId) ||
          mandates[0];
        if (activeMandate) {
          mandateId = activeMandate.id;
          budgetLimitMinor = activeMandate.budgetLimitMinor;
          budgetCurrency = activeMandate.currency;
        }
        childMandates = mandates.filter((m) => m.parentMandateId && m.state === "active");
      } catch (err) {
        app.log.warn({ err }, "Could not fetch active mandate for environment");
      }
    }

    const formatBudget = (minor: number, currency: string) => {
      const val = (minor / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      if (currency === "INR") return `₹${val}`;
      if (currency === "EUR") return `€${val}`;
      if (currency === "GBP") return `£${val}`;
      return `$${val}`;
    };

    const budgetDisplay = formatBudget(budgetLimitMinor, budgetCurrency);

    // Read real subagent child mandates from database (no hardcoded mock splits)
    const subagents = childMandates.map((cm) => ({
      agent: cm.holderAgentId,
      role: `${cm.holderAgentId.charAt(0).toUpperCase() + cm.holderAgentId.slice(1)} Specialist`,
      percentage: budgetLimitMinor > 0 ? Math.round((cm.budgetLimitMinor / budgetLimitMinor) * 100) : 0,
      amountMinor: cm.budgetLimitMinor,
      currency: cm.currency || budgetCurrency,
      budgetDisplay: formatBudget(cm.budgetLimitMinor, cm.currency || budgetCurrency),
      description: `Cryptographic child mandate (${cm.id})`,
    }));

    const totalDelegatedMinor = subagents.reduce((acc, s) => acc + s.amountMinor, 0);
    const orchestratorReserve = Math.max(0, budgetLimitMinor - totalDelegatedMinor);

    const subagentLines = subagents.length > 0
      ? subagents.map((s) => `  - ${s.role}: ${s.budgetDisplay}`)
      : ["  - None (No subagent child mandates delegated yet)"];

    const systemInstruction = [
      "You are the PayGuardian Personal Agent Orchestrator — an intelligent, articulate AI coordinator.",
      "You manage specialist sub-agents (Travel, Hotel, Food, Transport, Activities, MerchantAttach) and communicate with users in clear, detailed English.",
      "",
      "MANDATE BUDGET FACTS (use these exact figures when answering budget questions):",
      `  - Your mandate budget (allocated to YOU by the user): ${budgetDisplay} (${budgetCurrency})`,
      `  - Total you have delegated to subagents: ${formatBudget(totalDelegatedMinor, budgetCurrency)}`,
      `  - Remaining orchestrator reserve: ${formatBudget(orchestratorReserve, budgetCurrency)}`,
      "",
      "SUBAGENT BUDGET DELEGATIONS:",
      ...subagentLines,
      "",
      "RESPONSE RULES:",
      "1. When asked 'how much budget do you have?', answer with YOUR mandate budget exactly.",
      "2. When asked about a subagent's budget, answer with the amount YOU delegated to it.",
      "3. Provide rich, detailed, well-structured responses. Use markdown tables and bullet points when summarizing plans or budgets.",
      "4. Never invent numbers — use only the figures provided above.",
      "5. Never bypass gateway authority rules or leak credentials. Never expose internal system mandate IDs, UUIDs, or backend tokens to the user.",
    ].join("\n");

    const messageHistoryText = messages.map((m) => `[${(m.role || "user").toUpperCase()}]: ${m.content}`).join("\n\n");
    const fullPromptText = `${systemInstruction}\n\n=== CONVERSATION HISTORY ===\n${messageHistoryText || "(No messages yet)"}`;
    const estimatedTokens = Math.ceil(fullPromptText.length / 4);

    return reply.code(200).send({
      conversationId: conversation.id,
      title: conversation.title,
      environmentId: scoped.environment.id,
      mandate: {
        mandateId,
        budgetLimitMinor,
        currency: budgetCurrency,
        budgetDisplay,
        spendableMinor: orchestratorReserve,
        reserveMinor: orchestratorReserve,
        reserveDisplay: formatBudget(orchestratorReserve, budgetCurrency),
      },
      subagents,
      systemInstruction,
      messages,
      estimatedTokens,
      totalCharacters: fullPromptText.length,
      fullPromptText,
    });
  });

  // POST /v1/environments/:environmentId/conversations/:conversationId/messages
  app.post<{
    Params: { environmentId: string; conversationId: string };
    Body?: {
      content?: string;
      message?: string;
      agentId?: string;
      metadata?: Record<string, unknown>;
    };
  }>("/v1/environments/:environmentId/conversations/:conversationId/messages", async (request, reply) => {
    const scoped = await environmentFor(
      request as AppRequest,
      reply,
      dependencies.registry,
      dependencies.resolvePrincipal,
      request.params.environmentId,
    );
    if (!scoped) return;

    const conversation = await dependencies.chatbot.getConversation(
      scoped.environment.id,
      request.params.conversationId,
    );
    if (!conversation) {
      return reply
        .code(404)
        .send({ code: "CONVERSATION_NOT_FOUND", message: "Conversation not found." });
    }

    const rawMessage = request.body?.content ?? request.body?.message;
    if (!rawMessage || typeof rawMessage !== "string" || !rawMessage.trim()) {
      return reply
        .code(400)
        .send({ code: "INVALID_MESSAGE", message: "Message content is required." });
    }

    const messageText = rawMessage.trim();
    const agentId = request.body?.agentId ?? "personal";
    const requestedModel =
      typeof request.body?.metadata?.model === "string"
        ? (request.body.metadata.model as string)
        : "free/gpt-6-luna";

    // 1. Create message
    const message = await dependencies.chatbot.createMessage({
      conversationId: conversation.id,
      role: "user",
      content: messageText,
      sender: scoped.owner.userId,
    });

    if (dependencies.audit) {
      try {
        await dependencies.audit.append({
          environmentId: scoped.environment.id,
          actorType: "user",
          actorId: scoped.owner.userId,
          eventType: "user_message.sent",
          outcome: "success",
          payload: {
            conversationId: conversation.id,
            message: messageText.slice(0, 100),
            action: "Chat message sent",
            purpose: `Chat: ${messageText.slice(0, 48)}${messageText.length > 48 ? "..." : ""}`,
          },
        });
      } catch (err) {
        app.log.warn({ err }, "Non-fatal: failed to append user_message.sent audit event");
      }
    }

    // 2. Create agent run
    const run = await dependencies.chatbot.createRun({
      conversationId: conversation.id,
      environmentId: scoped.environment.id,
      status: "queued",
    });

    // 3. Create root agent task
    const rootTask = await dependencies.chatbot.createTask({
      runId: run.id,
      agentId,
      status: "queued",
    });

    // Resolve active mandate and budget
    let mandateId: string | undefined;
    let budgetLimitMinor: number = scoped.environment.budgetLimitMinor ?? 0;
    let budgetCurrency: string = scoped.environment.currency ?? "USD";
    let approvalRequired = false;

    if (dependencies.authority) {
      try {
        const mandates = await dependencies.authority.list(scoped.environment.id, scoped.owner.userId);
        const activeMandate =
          mandates.find((m) => !m.parentMandateId && m.state === "active") ||
          mandates.find((m) => !m.parentMandateId) ||
          mandates[0];
        if (activeMandate) {
          mandateId = activeMandate.id;
          budgetLimitMinor = activeMandate.budgetLimitMinor;
          budgetCurrency = activeMandate.currency;
          approvalRequired = Boolean(activeMandate.approvalRequired);
        }
      } catch (err) {
        app.log.warn({ err }, "Could not fetch active mandate for environment");
      }
    }

    // Immediately emit initial run.started so SSE subscriber gets immediate feedback
    await dependencies.chatbot.appendEvent({
      runId: run.id,
      taskId: rootTask.id,
      eventType: "run.started",
      payload: {
        run_id: run.id,
        prompt_preview: messageText.slice(0, 80),
        agent: "personal",
        agentId: "personal",
        budget_limit_minor: budgetLimitMinor,
        budget_currency: budgetCurrency,
      },
    });

    // 4. Enqueue provider job (Outbox)
    await dependencies.providerJobs.enqueue({
      provider: "agent_runtime",
      intent: "agent.run_task",
      dedupeKey: `agent_task:${rootTask.id}`,
      payload: {
        runId: run.id,
        taskId: rootTask.id,
        conversationId: conversation.id,
        environmentId: scoped.environment.id,
        mandateId,
        budgetLimitMinor,
        budgetCurrency,
        approvalRequired,
        message: messageText,
        modelId: requestedModel,
        model: requestedModel,
      },
    });

    // 5. Also publish into Supabase PGMQ queue (agent_task_queue)
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (supabaseUrl && supabaseKey) {
      void fetch(`${supabaseUrl.replace(/\/$/, "")}/rest/v1/rpc/enqueue_agent_task_pgmq`, {
        method: "POST",
        headers: {
          "apikey": supabaseKey,
          "Authorization": `Bearer ${supabaseKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          p_run_id: run.id,
          p_task_id: rootTask.id,
          p_conversation_id: conversation.id,
          p_environment_id: scoped.environment.id,
          p_mandate_id: mandateId,
          p_budget_limit_minor: budgetLimitMinor,
          p_budget_currency: budgetCurrency,
          p_message: messageText,
        }),
      }).catch((err) => {
        app.log.warn({ err }, "Failed to publish into PGMQ agent_task_queue");
      });
    }

    // 6. Direct async fallback to local agent runtime if running
    let conversationMessages: Array<{ role: string; content: string }> | undefined;
    try {
      const dbMessages = await dependencies.chatbot.listMessages(conversation.id);
      conversationMessages = dbMessages.map((m) => ({
        role: m.role,
        content: m.content,
      }));
    } catch (err) {
      app.log.warn({ err }, "Could not fetch conversation history for langgraph run");
    }

    const agentRuntimeUrl = process.env.AGENT_RUNTIME_URL ?? "http://localhost:8000";
    void fetch(`${agentRuntimeUrl}/langgraph/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: messageText,
        messages: conversationMessages,
        environment_id: scoped.environment.id,
        mandate_id: mandateId,
        budget_limit_minor: budgetLimitMinor,
        budget_currency: budgetCurrency,
        approval_required: approvalRequired,
        run_id: run.id,
        model_id: requestedModel,
      }),
    })
      .then(async (res) => {
        if (!res.ok) {
          app.log.warn({ status: res.status }, "Agent runtime /langgraph/run non-ok response");
          return;
        }
        const data = (await res.json()) as {
          finalResponse?: string;
          final_response?: string;
          events?: Array<{
            event_type?: string;
            eventType?: string;
            payload?: Record<string, unknown>;
            agent?: string;
            agentId?: string;
            task_id?: string;
            taskId?: string;
          }>;
          [key: string]: unknown;
        };

        // Stream and persist all intermediate subagent events emitted by agent runtime
        if (Array.isArray(data.events)) {
          for (const ev of data.events) {
            const evType = ev.eventType ?? ev.event_type;
            if (!evType || evType === "run.completed" || evType === "run.started") continue;
            const evAgent =
              ev.agentId ??
              ev.agent ??
              (ev.payload as Record<string, unknown> | undefined)?.agentId ??
              (ev.payload as Record<string, unknown> | undefined)?.agent ??
              "personal";
            if (evType === "agent.output" && evAgent === "personal") continue;
            const evTaskId = ev.taskId ?? ev.task_id ?? rootTask.id;
            await dependencies.chatbot.appendEvent({
              runId: run.id,
              taskId: rootTask.id,
              eventType: evType,
              payload: {
                ...(ev.payload ?? {}),
                taskId: String(evTaskId),
                agentId: String(evAgent),
                agent: String(evAgent),
              },
            });
          }
        }

        const assistantText =
          typeof data.finalResponse === "string" && data.finalResponse.trim()
            ? data.finalResponse.trim()
            : typeof data.final_response === "string" && data.final_response.trim()
            ? data.final_response.trim()
            : "Task completed successfully by Personal Agent.";

        // Append assistant message in conversation
        await dependencies.chatbot.createMessage({
          conversationId: conversation.id,
          role: "assistant",
          content: assistantText,
          sender: "personal",
        });

        // Emit final run events to SSE stream
        await dependencies.chatbot.appendEvent({
          runId: run.id,
          taskId: rootTask.id,
          eventType: "agent.output",
          payload: { text: assistantText, agentId: "personal" },
        });

        await dependencies.chatbot.appendEvent({
          runId: run.id,
          taskId: rootTask.id,
          eventType: "task.completed",
          payload: { agentId: "personal", status: "completed" },
        });

        await dependencies.chatbot.appendEvent({
          runId: run.id,
          taskId: rootTask.id,
          eventType: "run.completed",
          payload: { status: "completed" },
        });

        await dependencies.chatbot.updateTaskStatus(rootTask.id, "completed");
        await dependencies.chatbot.updateRunStatus(run.id, "completed");

        if (dependencies.audit) {
          await dependencies.audit.append({
            environmentId: scoped.environment.id,
            actorType: "agent",
            actorId: agentId,
            eventType: "agent_task.completed",
            outcome: "success",
            payload: {
              runId: run.id,
              conversationId: conversation.id,
              action: "Agent workflow completed",
              purpose: `Executed: ${assistantText.slice(0, 50)}...`,
              amountMinor: 1000,
              currency: "USD",
            },
          });
        }
      })
      .catch((err) => {
        app.log.warn({ err }, "Failed to reach agent runtime at /langgraph/run");
      });

    if (dependencies.audit) {
      try {
        await dependencies.audit.append({
          environmentId: scoped.environment.id,
          actorType: scoped.owner.kind,
          actorId: scoped.owner.userId,
          eventType: "agent_run.queued",
          outcome: "success",
          payload: {
            conversationId: conversation.id,
            messageId: message.id,
            runId: run.id,
            rootTaskId: rootTask.id,
          },
        });
      } catch (err) {
        app.log.warn({ err }, "Non-fatal: failed to append agent_run.queued audit event");
      }
    }

    return reply.code(201).send({
      conversationId: conversation.id,
      messageId: message.id,
      runId: run.id,
      rootTaskId: rootTask.id,
    });
  });

  // POST /v1/environments/:environmentId/runs/:runId/complete (Internal worker callback)
  app.post<{
    Params: { environmentId: string; runId: string };
    Body: {
      taskId?: string;
      finalResponse: string;
      status?: "completed" | "failed";
      error?: string;
    };
  }>("/v1/environments/:environmentId/runs/:runId/complete", async (request, reply) => {
    const { environmentId, runId } = request.params;
    const { taskId, finalResponse, status = "completed" } = request.body;

    const run = await dependencies.chatbot.getRun(runId);
    if (!run) {
      return reply.code(404).send({ code: "RUN_NOT_FOUND", message: "Run not found." });
    }

    // 1. Create assistant message in conversation
    await dependencies.chatbot.createMessage({
      conversationId: run.conversationId,
      role: "assistant",
      content: finalResponse,
      sender: "personal",
    });

    // 2. Append event for real-time SSE stream
    await dependencies.chatbot.appendEvent({
      runId,
      taskId: taskId ?? null,
      eventType: "agent.output",
      payload: { agentId: "personal", text: finalResponse, output: finalResponse },
    });

    if (taskId) {
      await dependencies.chatbot.appendEvent({
        runId,
        taskId,
        eventType: "task.completed",
        payload: { agentId: "personal", status },
      });
      await dependencies.chatbot.updateTaskStatus(taskId, status);
    }

    await dependencies.chatbot.appendEvent({
      runId,
      taskId: taskId ?? null,
      eventType: "run.completed",
      payload: { status, finalResponse },
    });

    await dependencies.chatbot.updateRunStatus(runId, status);

    return reply.code(200).send({ ok: true });
  });

  // GET /v1/environments/:environmentId/runs/:runId/stream
  app.get<{
    Params: { environmentId: string; runId: string };
    Querystring: {
      lastEventId?: string;
      "last-event-id"?: string;
      token?: string;
      access_token?: string;
      localUserId?: string;
      once?: string;
      live?: string;
    };
  }>("/v1/environments/:environmentId/runs/:runId/stream", async (request, reply) => {
    const scoped = await environmentFor(
      request as AppRequest,
      reply,
      dependencies.registry,
      dependencies.resolvePrincipal,
      request.params.environmentId,
    );
    if (!scoped) return;

    const run = await dependencies.chatbot.getRun(request.params.runId);
    if (!run || run.environmentId !== scoped.environment.id) {
      return reply.code(404).send({ code: "RUN_NOT_FOUND", message: "Run not found." });
    }

    // Hijack the response to handle SSE streaming
    reply.hijack();

    const origin = (request.headers.origin as string) || "http://localhost:3000";
    reply.raw.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Credentials": "true",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, x-local-user-id, Last-Event-ID",
    });

    const query = request.query ?? {};
    const lastEventIdHeader = request.headers["last-event-id"];
    const lastEventIdParam = query.lastEventId ?? query["last-event-id"];
    const rawLastEventId =
      typeof lastEventIdHeader === "string"
        ? lastEventIdHeader
        : typeof lastEventIdParam === "string"
        ? lastEventIdParam
        : undefined;

    let lastId = 0;
    if (rawLastEventId) {
      const parsed = Number.parseInt(rawLastEventId, 10);
      if (!Number.isNaN(parsed) && parsed > 0) {
        lastId = parsed;
      }
    }

    const sendEvent = (event: AgentEvent) => {
      if (reply.raw.writableEnded || reply.raw.destroyed) return;
      reply.raw.write(
        `id: ${event.id}\nevent: ${event.eventType}\ndata: ${JSON.stringify(event.payload)}\n\n`,
      );
      if (typeof event.id === "number" && event.id > lastId) {
        lastId = event.id;
      }
      if (event.eventType === "run.completed" || event.eventType === "run.failed") {
        setTimeout(() => {
          if (!reply.raw.writableEnded) reply.raw.end();
        }, 100);
      }
    };

    // Replay past events where id > lastEventId
    const initialEvents = await dependencies.chatbot.listEventsAfter({
      runId: run.id,
      afterId: lastId > 0 ? lastId : null,
    });
    for (const ev of initialEvents) {
      sendEvent(ev);
    }

    // Send initial heartbeat
    reply.raw.write(":\n\n");

    if (query.once === "true" || query.live === "false") {
      reply.raw.end();
      return;
    }

    let isPolling = false;
    let pollInterval: NodeJS.Timeout | null = null;
    let unsubscribe: (() => void) | null = null;

    const cleanup = () => {
      if (pollInterval) {
        clearInterval(pollInterval);
        pollInterval = null;
      }
      if (unsubscribe) {
        unsubscribe();
        unsubscribe = null;
      }
      if (!reply.raw.writableEnded) {
        reply.raw.end();
      }
    };

    request.raw.on("close", cleanup);
    request.raw.on("error", cleanup);

    // Subscribe to new events if the store supports event subscription
    if (dependencies.chatbot.subscribeEvents) {
      unsubscribe = dependencies.chatbot.subscribeEvents(run.id, (event) => {
        if (event.id > lastId) {
          sendEvent(event);
        }
      });
    }

    // Periodic check (500ms) for newly inserted events and heartbeats
    pollInterval = setInterval(async () => {
      if (reply.raw.writableEnded || reply.raw.destroyed) {
        cleanup();
        return;
      }

      // Heartbeat comment
      reply.raw.write(":\n\n");

      if (isPolling) return;
      isPolling = true;
      try {
        const newEvents = await dependencies.chatbot.listEventsAfter({
          runId: run.id,
          afterId: lastId > 0 ? lastId : null,
        });
        for (const ev of newEvents) {
          sendEvent(ev);
        }
      } catch {
        // Ignore background polling errors
      } finally {
        isPolling = false;
      }
    }, 500);
  });
}
