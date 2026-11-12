import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "./app.js";
import { InMemoryChatbotStore } from "./chatbot.js";
import { InMemoryRegistry } from "./phase1.js";
import { InMemoryProviderJobStore } from "./provider-jobs.js";

const apps = new Set<FastifyInstance>();

afterEach(async () => {
  await Promise.all([...apps].map((app) => app.close()));
  apps.clear();
});

async function setupTestApp() {
  const registry = new InMemoryRegistry();
  const chatbot = new InMemoryChatbotStore();
  const providerJobs = new InMemoryProviderJobStore();

  const app = buildApp({
    registry,
    chatbot,
    providerJobs,
    resolvePrincipal: async (authorization, localUserId) => {
      if (localUserId) return { userId: localUserId, kind: "user" };
      if (authorization?.startsWith("Bearer user_")) {
        return { userId: authorization.slice("Bearer user_".length), kind: "user" };
      }
      return null;
    },
  });
  apps.add(app);

  const env = await registry.createEnvironment({
    ownerUserId: "alice",
    name: "Production Workspace",
    purpose: "Agent test environment",
    currency: "USD",
    budgetLimitMinor: 50_000,
  });

  return { app, registry, chatbot, providerJobs, environmentId: env.id };
}

describe("Chatbot Domain Store", () => {
  it("manages conversations, messages, runs, tasks, and events in memory", async () => {
    const store = new InMemoryChatbotStore();

    // 1. Conversation
    const conv = await store.createConversation({
      environmentId: "env-1",
      userId: "user-1",
      title: "Trip to Tokyo",
    });
    expect(conv.id).toBeDefined();
    expect(conv.title).toBe("Trip to Tokyo");

    const convList = await store.listConversations("env-1", "user-1");
    expect(convList).toHaveLength(1);
    expect(convList[0].id).toBe(conv.id);

    const fetchedConv = await store.getConversation("env-1", conv.id);
    expect(fetchedConv?.id).toBe(conv.id);

    // 2. Messages
    const msg1 = await store.createMessage({
      conversationId: conv.id,
      role: "user",
      content: "Book a hotel in Shinjuku",
      sender: "user-1",
    });
    const msg2 = await store.createMessage({
      conversationId: conv.id,
      role: "assistant",
      content: "I found 3 hotels matching your preferences.",
    });

    const messages = await store.listMessages(conv.id);
    expect(messages).toHaveLength(2);
    expect(messages[0].content).toBe("Book a hotel in Shinjuku");
    expect(messages[1].content).toBe("I found 3 hotels matching your preferences.");

    // 3. Runs and Tasks
    const run = await store.createRun({
      conversationId: conv.id,
      environmentId: "env-1",
    });
    expect(run.status).toBe("queued");

    const task = await store.createTask({
      runId: run.id,
      agentId: "hotel",
    });
    expect(task.status).toBe("queued");
    expect(task.agentId).toBe("hotel");

    const tasks = await store.listTasks(run.id);
    expect(tasks).toHaveLength(1);
    expect(tasks[0].id).toBe(task.id);

    const updatedTask = await store.updateTaskStatus(task.id, "running");
    expect(updatedTask?.status).toBe("running");

    const updatedRun = await store.updateRunStatus(run.id, "completed");
    expect(updatedRun?.status).toBe("completed");
    expect(updatedRun?.completedAt).toBeDefined();

    // 4. Events and Event Listeners
    let eventCallbackCount = 0;
    const unsub = store.subscribeEvents(run.id, () => {
      eventCallbackCount++;
    });

    const ev1 = await store.appendEvent({
      runId: run.id,
      taskId: task.id,
      eventType: "thought",
      payload: { text: "Searching hotel inventory" },
    });
    const ev2 = await store.appendEvent({
      runId: run.id,
      taskId: task.id,
      eventType: "action_call",
      payload: { action: "search_hotels", city: "Tokyo" },
    });

    expect(eventCallbackCount).toBe(2);
    unsub();

    const allEvents = await store.listEventsAfter({ runId: run.id });
    expect(allEvents).toHaveLength(2);
    expect(allEvents[0].id).toBe(ev1.id);
    expect(allEvents[1].id).toBe(ev2.id);

    const afterFirst = await store.listEventsAfter({ runId: run.id, afterId: ev1.id });
    expect(afterFirst).toHaveLength(1);
    expect(afterFirst[0].id).toBe(ev2.id);
  });
});

describe("Chatbot API Routes", () => {
  it("creates and lists conversations for an environment", async () => {
    const { app, environmentId } = await setupTestApp();

    // Unauthorized without credentials
    const unauth = await app.inject({
      method: "POST",
      url: `/v1/environments/${environmentId}/conversations`,
      payload: { title: "Test Conversation" },
    });
    expect(unauth.statusCode).toBe(401);

    // Create conversation
    const createRes = await app.inject({
      method: "POST",
      url: `/v1/environments/${environmentId}/conversations`,
      headers: { "x-local-user-id": "alice" },
      payload: { title: "Travel Planning" },
    });
    expect(createRes.statusCode).toBe(201);
    const body = createRes.json();
    expect(body.conversation).toBeDefined();
    expect(body.conversation.title).toBe("Travel Planning");
    expect(body.conversation.environmentId).toBe(environmentId);

    // List conversations
    const listRes = await app.inject({
      method: "GET",
      url: `/v1/environments/${environmentId}/conversations`,
      headers: { "x-local-user-id": "alice" },
    });
    expect(listRes.statusCode).toBe(200);
    const listBody = listRes.json();
    expect(listBody.conversations).toHaveLength(1);
    expect(listBody.conversations[0].id).toBe(body.conversation.id);

    // Another user has no access to alice's environment
    const bobRes = await app.inject({
      method: "GET",
      url: `/v1/environments/${environmentId}/conversations`,
      headers: { "x-local-user-id": "bob" },
    });
    expect(bobRes.statusCode).toBe(404);
  });

  it("posts user messages, queues agent runs, tasks, and provider jobs", async () => {
    const { app, providerJobs, environmentId } = await setupTestApp();

    // Create conversation
    const createRes = await app.inject({
      method: "POST",
      url: `/v1/environments/${environmentId}/conversations`,
      headers: { "x-local-user-id": "alice" },
      payload: { title: "Expense Help" },
    });
    const conversationId = createRes.json().conversation.id;

    // Reject empty message
    const emptyRes = await app.inject({
      method: "POST",
      url: `/v1/environments/${environmentId}/conversations/${conversationId}/messages`,
      headers: { "x-local-user-id": "alice" },
      payload: { content: "   " },
    });
    expect(emptyRes.statusCode).toBe(400);

    // Post valid message
    const postRes = await app.inject({
      method: "POST",
      url: `/v1/environments/${environmentId}/conversations/${conversationId}/messages`,
      headers: { "x-local-user-id": "alice" },
      payload: { content: "Please prepare payment batch for March" },
    });
    expect(postRes.statusCode).toBe(201);
    const postBody = postRes.json();
    expect(postBody.conversationId).toBe(conversationId);
    expect(postBody.messageId).toBeDefined();
    expect(postBody.runId).toBeDefined();
    expect(postBody.rootTaskId).toBeDefined();

    // Verify provider job enqueued
    const queuedJobs = await providerJobs.list({ provider: "agent_runtime" });
    expect(queuedJobs).toHaveLength(1);
    expect(queuedJobs[0]).toMatchObject({
      provider: "agent_runtime",
      intent: "agent.run_task",
      status: "queued",
      payload: {
        runId: postBody.runId,
        taskId: postBody.rootTaskId,
        conversationId,
        environmentId,
        message: "Please prepare payment batch for March",
      },
    });

    // Verify message is saved in conversation messages list
    const getMsgsRes = await app.inject({
      method: "GET",
      url: `/v1/environments/${environmentId}/conversations/${conversationId}/messages`,
      headers: { "x-local-user-id": "alice" },
    });
    expect(getMsgsRes.statusCode).toBe(200);
    const msgs = getMsgsRes.json().messages;
    expect(msgs).toHaveLength(1);
    expect(msgs[0].content).toBe("Please prepare payment batch for March");
    expect(msgs[0].role).toBe("user");

    // Verify context window endpoint returns assembled context and token estimates
    const contextRes = await app.inject({
      method: "GET",
      url: `/v1/environments/${environmentId}/conversations/${conversationId}/context`,
      headers: { "x-local-user-id": "alice" },
    });
    expect(contextRes.statusCode).toBe(200);
    const contextBody = contextRes.json();
    expect(contextBody.conversationId).toBe(conversationId);
    expect(contextBody.mandate).toBeDefined();
    expect(contextBody.subagents).toBeInstanceOf(Array);
    expect(contextBody.systemInstruction).toContain("PayGuardian Personal Agent Orchestrator");
    expect(contextBody.fullPromptText).toContain("Please prepare payment batch for March");
    expect(contextBody.estimatedTokens).toBeGreaterThan(0);
  });

  it("replays events with Last-Event-ID filtering", async () => {
    const { app, chatbot, environmentId } = await setupTestApp();

    const conv = await chatbot.createConversation({
      environmentId,
      userId: "alice",
      title: "SSE Replay Test",
    });
    const run = await chatbot.createRun({
      conversationId: conv.id,
      environmentId,
    });
    const task = await chatbot.createTask({
      runId: run.id,
      agentId: "personal",
    });

    const ev1 = await chatbot.appendEvent({
      runId: run.id,
      taskId: task.id,
      eventType: "agent.started",
      payload: { step: 1 },
    });
    const ev2 = await chatbot.appendEvent({
      runId: run.id,
      taskId: task.id,
      eventType: "agent.thought",
      payload: { step: 2, note: "Analyzing intent" },
    });
    const ev3 = await chatbot.appendEvent({
      runId: run.id,
      taskId: task.id,
      eventType: "agent.completed",
      payload: { step: 3, result: "done" },
    });

    // 1. Replay all events (no Last-Event-ID)
    const streamRes = await app.inject({
      method: "GET",
      url: `/v1/environments/${environmentId}/runs/${run.id}/stream?once=true`,
      headers: { "x-local-user-id": "alice" },
    });
    expect(streamRes.statusCode).toBe(200);
    expect(streamRes.headers["content-type"]).toBe("text/event-stream");
    const streamText = streamRes.body;
    expect(streamText).toContain(`id: ${ev1.id}\nevent: agent.started\ndata: {"step":1}`);
    expect(streamText).toContain(
      `id: ${ev2.id}\nevent: agent.thought\ndata: {"step":2,"note":"Analyzing intent"}`,
    );
    expect(streamText).toContain(
      `id: ${ev3.id}\nevent: agent.completed\ndata: {"step":3,"result":"done"}`,
    );

    // 2. Replay with Last-Event-ID header (should skip ev1)
    const filteredRes = await app.inject({
      method: "GET",
      url: `/v1/environments/${environmentId}/runs/${run.id}/stream?once=true`,
      headers: {
        "x-local-user-id": "alice",
        "last-event-id": String(ev1.id),
      },
    });
    expect(filteredRes.statusCode).toBe(200);
    const filteredText = filteredRes.body;
    expect(filteredText).not.toContain(`id: ${ev1.id}\n`);
    expect(filteredText).toContain(`id: ${ev2.id}\nevent: agent.thought`);
    expect(filteredText).toContain(`id: ${ev3.id}\nevent: agent.completed`);

    // 3. Replay with query parameter ?lastEventId=... (should skip ev1 and ev2)
    const queryParamRes = await app.inject({
      method: "GET",
      url: `/v1/environments/${environmentId}/runs/${run.id}/stream?once=true&lastEventId=${ev2.id}`,
      headers: { "x-local-user-id": "alice" },
    });
    expect(queryParamRes.statusCode).toBe(200);
    const queryParamText = queryParamRes.body;
    expect(queryParamText).not.toContain(`id: ${ev1.id}\n`);
    expect(queryParamText).not.toContain(`id: ${ev2.id}\n`);
    expect(queryParamText).toContain(`id: ${ev3.id}\nevent: agent.completed`);
  });

  it("handles live streaming of events over HTTP SSE connection", async () => {
    const { app, chatbot, environmentId } = await setupTestApp();

    const conv = await chatbot.createConversation({
      environmentId,
      userId: "alice",
      title: "Live SSE Test",
    });
    const run = await chatbot.createRun({
      conversationId: conv.id,
      environmentId,
    });
    const task = await chatbot.createTask({
      runId: run.id,
      agentId: "personal",
    });

    // Start HTTP server
    await app.listen({ port: 0, host: "127.0.0.1" });
    const address = app.server.address() as AddressInfo;

    const controller = new AbortController();
    const sseResponse = await fetch(
      `http://127.0.0.1:${address.port}/v1/environments/${environmentId}/runs/${run.id}/stream`,
      {
        headers: { "x-local-user-id": "alice" },
        signal: controller.signal,
      },
    );

    expect(sseResponse.status).toBe(200);
    expect(sseResponse.headers.get("content-type")).toBe("text/event-stream");

    const reader = sseResponse.body?.getReader();
    expect(reader).toBeDefined();

    const decoder = new TextDecoder();
    let accumulated = "";

    // Append an event while stream is open
    await chatbot.appendEvent({
      runId: run.id,
      taskId: task.id,
      eventType: "agent.live_ping",
      payload: { message: "Hello live stream" },
    });

    // Read chunks until event is seen
    while (!accumulated.includes("agent.live_ping")) {
      const { value, done } = await reader!.read();
      if (done) break;
      accumulated += decoder.decode(value, { stream: true });
    }

    expect(accumulated).toContain("event: agent.live_ping");
    expect(accumulated).toContain('data: {"message":"Hello live stream"}');

    // Abort client connection to verify clean shutdown
    controller.abort();
  });
});
