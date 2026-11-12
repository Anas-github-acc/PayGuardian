import { randomUUID } from "node:crypto";
import { EventEmitter } from "node:events";
import type { SupabaseClient } from "@supabase/supabase-js";

export type MessageRole = "user" | "assistant" | "system";
export type RunStatus = "queued" | "running" | "completed" | "failed" | "cancelled";
export type TaskStatus = "queued" | "running" | "completed" | "failed" | "cancelled";

export type Conversation = {
  id: string;
  environmentId: string;
  userId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
};

export type CreateConversationInput = {
  environmentId: string;
  userId: string;
  title?: string;
};

export type Message = {
  id: string;
  conversationId: string;
  role: MessageRole;
  content: string;
  sender?: string | null;
  createdAt: string;
};

export type CreateMessageInput = {
  conversationId: string;
  role: MessageRole;
  content: string;
  sender?: string | null;
};

export type AgentRun = {
  id: string;
  conversationId: string;
  environmentId: string;
  status: RunStatus;
  createdAt: string;
  updatedAt: string;
  completedAt?: string | null;
};

export type CreateRunInput = {
  conversationId: string;
  environmentId: string;
  status?: RunStatus;
};

export type AgentTask = {
  id: string;
  runId: string;
  agentId: string;
  parentTaskId?: string | null;
  status: TaskStatus;
  createdAt: string;
  updatedAt: string;
  completedAt?: string | null;
};

export type CreateTaskInput = {
  runId: string;
  agentId: string;
  parentTaskId?: string | null;
  status?: TaskStatus;
};

export type AgentEvent = {
  id: number;
  runId: string;
  taskId: string | null;
  eventType: string;
  payload: Record<string, unknown>;
  createdAt: string;
};

export type AppendEventInput = {
  runId: string;
  taskId?: string | null;
  eventType: string;
  payload?: Record<string, unknown> | unknown;
};

export type ListEventsAfterInput = {
  runId: string;
  afterId?: number | string | null;
};

export interface ChatbotStore {
  // Conversation management
  createConversation(input: CreateConversationInput): Promise<Conversation>;
  listConversations(environmentId: string, userId: string): Promise<Conversation[]>;
  getConversation(conversationId: string): Promise<Conversation | null>;
  getConversation(environmentId: string, conversationId: string): Promise<Conversation | null>;
  listMessages(conversationId: string): Promise<Message[]>;
  createMessage(input: CreateMessageInput): Promise<Message>;

  // Run & Task management
  createRun(input: CreateRunInput): Promise<AgentRun>;
  getRun(runId: string): Promise<AgentRun | null>;
  getRun(environmentId: string, runId: string): Promise<AgentRun | null>;
  listTasks(runId: string): Promise<AgentTask[]>;
  createTask(input: CreateTaskInput): Promise<AgentTask>;
  updateTaskStatus(taskId: string, status: TaskStatus): Promise<AgentTask | null>;
  updateRunStatus(runId: string, status: RunStatus): Promise<AgentRun | null>;

  // Event persistence & fetching
  appendEvent(input: AppendEventInput): Promise<AgentEvent>;
  listEventsAfter(input: ListEventsAfterInput): Promise<AgentEvent[]>;

  // Real-time helper
  subscribeEvents?(runId: string, listener: (event: AgentEvent) => void): () => void;
}

export class InMemoryChatbotStore implements ChatbotStore {
  private conversations = new Map<string, Conversation>();
  private messages = new Map<string, Message>();
  private runs = new Map<string, AgentRun>();
  private tasks = new Map<string, AgentTask>();
  private events: AgentEvent[] = [];
  private nextEventId = 1;
  private emitter = new EventEmitter();

  constructor() {
    this.emitter.setMaxListeners(100);
  }

  async createConversation(input: CreateConversationInput): Promise<Conversation> {
    const now = new Date().toISOString();
    const conversation: Conversation = {
      id: randomUUID(),
      environmentId: input.environmentId,
      userId: input.userId,
      title: input.title?.trim() || "New Conversation",
      createdAt: now,
      updatedAt: now,
    };
    this.conversations.set(conversation.id, conversation);
    return conversation;
  }

  async listConversations(environmentId: string, userId: string): Promise<Conversation[]> {
    return [...this.conversations.values()]
      .filter((c) => c.environmentId === environmentId && c.userId === userId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async getConversation(arg1: string, arg2?: string): Promise<Conversation | null> {
    const conversationId = arg2 ?? arg1;
    const environmentId = arg2 ? arg1 : null;
    const conversation = this.conversations.get(conversationId);
    if (!conversation) return null;
    if (environmentId && conversation.environmentId !== environmentId) return null;
    return conversation;
  }

  async listMessages(conversationId: string): Promise<Message[]> {
    return [...this.messages.values()]
      .filter((m) => m.conversationId === conversationId)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  async createMessage(input: CreateMessageInput): Promise<Message> {
    const now = new Date().toISOString();
    const message: Message = {
      id: randomUUID(),
      conversationId: input.conversationId,
      role: input.role,
      content: input.content,
      sender: input.sender ?? null,
      createdAt: now,
    };
    this.messages.set(message.id, message);
    const conv = this.conversations.get(input.conversationId);
    if (conv) {
      conv.updatedAt = now;
    }
    return message;
  }

  async createRun(input: CreateRunInput): Promise<AgentRun> {
    const now = new Date().toISOString();
    const run: AgentRun = {
      id: randomUUID(),
      conversationId: input.conversationId,
      environmentId: input.environmentId,
      status: input.status ?? "queued",
      createdAt: now,
      updatedAt: now,
      completedAt: null,
    };
    this.runs.set(run.id, run);
    return run;
  }

  async getRun(arg1: string, arg2?: string): Promise<AgentRun | null> {
    const runId = arg2 ?? arg1;
    const environmentId = arg2 ? arg1 : null;
    const run = this.runs.get(runId);
    if (!run) return null;
    if (environmentId && run.environmentId !== environmentId) return null;
    return run;
  }

  async listTasks(runId: string): Promise<AgentTask[]> {
    return [...this.tasks.values()]
      .filter((t) => t.runId === runId)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  async createTask(input: CreateTaskInput): Promise<AgentTask> {
    const now = new Date().toISOString();
    const task: AgentTask = {
      id: randomUUID(),
      runId: input.runId,
      agentId: input.agentId,
      parentTaskId: input.parentTaskId ?? null,
      status: input.status ?? "queued",
      createdAt: now,
      updatedAt: now,
      completedAt: null,
    };
    this.tasks.set(task.id, task);
    return task;
  }

  async updateTaskStatus(taskId: string, status: TaskStatus): Promise<AgentTask | null> {
    const task = this.tasks.get(taskId);
    if (!task) return null;
    const now = new Date().toISOString();
    task.status = status;
    task.updatedAt = now;
    if (status === "completed" || status === "failed" || status === "cancelled") {
      task.completedAt = now;
    }
    return task;
  }

  async updateRunStatus(runId: string, status: RunStatus): Promise<AgentRun | null> {
    const run = this.runs.get(runId);
    if (!run) return null;
    const now = new Date().toISOString();
    run.status = status;
    run.updatedAt = now;
    if (status === "completed" || status === "failed" || status === "cancelled") {
      run.completedAt = now;
    }
    return run;
  }

  async appendEvent(input: AppendEventInput): Promise<AgentEvent> {
    const event: AgentEvent = {
      id: this.nextEventId++,
      runId: input.runId,
      taskId: input.taskId ?? null,
      eventType: input.eventType,
      payload:
        input.payload && typeof input.payload === "object"
          ? (input.payload as Record<string, unknown>)
          : { value: input.payload },
      createdAt: new Date().toISOString(),
    };
    this.events.push(event);
    this.emitter.emit(`event:${input.runId}`, event);
    return event;
  }

  async listEventsAfter(input: ListEventsAfterInput): Promise<AgentEvent[]> {
    const afterId = input.afterId != null ? Number(input.afterId) : null;
    return this.events
      .filter((e) => {
        if (e.runId !== input.runId) return false;
        if (afterId != null && !Number.isNaN(afterId) && e.id <= afterId) return false;
        return true;
      })
      .sort((a, b) => a.id - b.id);
  }

  subscribeEvents(runId: string, listener: (event: AgentEvent) => void): () => void {
    const channel = `event:${runId}`;
    this.emitter.on(channel, listener);
    return () => {
      this.emitter.off(channel, listener);
    };
  }
}

export class SupabaseChatbotStore implements ChatbotStore {
  constructor(private readonly client: SupabaseClient) {}

  async createConversation(input: CreateConversationInput): Promise<Conversation> {
    const { data, error } = await this.client
      .from("conversations")
      .insert({
        environment_id: input.environmentId,
        user_id: input.userId,
        title: input.title?.trim() || "New Conversation",
      })
      .select("id, environment_id, user_id, title, created_at, updated_at")
      .single();
    if (error) throw error;
    return mapConversation(data);
  }

  async listConversations(environmentId: string, userId: string): Promise<Conversation[]> {
    const { data, error } = await this.client
      .from("conversations")
      .select("id, environment_id, user_id, title, created_at, updated_at")
      .eq("environment_id", environmentId)
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []).map(mapConversation);
  }

  async getConversation(arg1: string, arg2?: string): Promise<Conversation | null> {
    const conversationId = arg2 ?? arg1;
    const environmentId = arg2 ? arg1 : null;
    let query = this.client
      .from("conversations")
      .select("id, environment_id, user_id, title, created_at, updated_at")
      .eq("id", conversationId);
    if (environmentId) {
      query = query.eq("environment_id", environmentId);
    }
    const { data, error } = await query.maybeSingle();
    if (error) throw error;
    return data ? mapConversation(data) : null;
  }

  async listMessages(conversationId: string): Promise<Message[]> {
    const { data, error } = await this.client
      .from("messages")
      .select("id, conversation_id, sender_type, content, sender_id, created_at")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true });
    if (error) throw error;
    return (data ?? []).map(mapMessage);
  }

  async createMessage(input: CreateMessageInput): Promise<Message> {
    const { data, error } = await this.client
      .from("messages")
      .insert({
        conversation_id: input.conversationId,
        sender_type: input.role,
        content: input.content,
        sender_id: input.sender ?? null,
      })
      .select("id, conversation_id, sender_type, content, sender_id, created_at")
      .single();
    if (error) throw error;

    // Update conversation updated_at
    await this.client
      .from("conversations")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", input.conversationId);

    return mapMessage(data);
  }

  async createRun(input: CreateRunInput): Promise<AgentRun> {
    const { data, error } = await this.client
      .from("agent_runs")
      .insert({
        conversation_id: input.conversationId,
        environment_id: input.environmentId,
        status: input.status ?? "queued",
      })
      .select("id, conversation_id, environment_id, status, created_at, updated_at, completed_at")
      .single();
    if (error) throw error;
    return mapRun(data);
  }

  async getRun(arg1: string, arg2?: string): Promise<AgentRun | null> {
    const runId = arg2 ?? arg1;
    const environmentId = arg2 ? arg1 : null;
    let query = this.client
      .from("agent_runs")
      .select("id, conversation_id, environment_id, status, created_at, updated_at, completed_at")
      .eq("id", runId);
    if (environmentId) {
      query = query.eq("environment_id", environmentId);
    }
    const { data, error } = await query.maybeSingle();
    if (error) throw error;
    return data ? mapRun(data) : null;
  }

  async listTasks(runId: string): Promise<AgentTask[]> {
    const { data, error } = await this.client
      .from("agent_tasks")
      .select("id, run_id, agent_id, parent_task_id, status, created_at, updated_at, completed_at")
      .eq("run_id", runId)
      .order("created_at", { ascending: true });
    if (error) throw error;
    return (data ?? []).map(mapTask);
  }

  async createTask(input: CreateTaskInput): Promise<AgentTask> {
    const { data, error } = await this.client
      .from("agent_tasks")
      .insert({
        run_id: input.runId,
        agent_id: input.agentId,
        parent_task_id: input.parentTaskId ?? null,
        status: input.status ?? "queued",
      })
      .select("id, run_id, agent_id, parent_task_id, status, created_at, updated_at, completed_at")
      .single();
    if (error) throw error;
    return mapTask(data);
  }

  async updateTaskStatus(taskId: string, status: TaskStatus): Promise<AgentTask | null> {
    const now = new Date().toISOString();
    const updateData: Record<string, unknown> = {
      status,
      updated_at: now,
    };
    if (status === "completed" || status === "failed" || status === "cancelled") {
      updateData.completed_at = now;
    }
    const { data, error } = await this.client
      .from("agent_tasks")
      .update(updateData)
      .eq("id", taskId)
      .select("id, run_id, agent_id, parent_task_id, status, created_at, updated_at, completed_at")
      .maybeSingle();
    if (error) throw error;
    return data ? mapTask(data) : null;
  }

  async updateRunStatus(runId: string, status: RunStatus): Promise<AgentRun | null> {
    const now = new Date().toISOString();
    const updateData: Record<string, unknown> = {
      status,
      updated_at: now,
    };
    if (status === "completed" || status === "failed" || status === "cancelled") {
      updateData.completed_at = now;
    }
    const { data, error } = await this.client
      .from("agent_runs")
      .update(updateData)
      .eq("id", runId)
      .select("id, conversation_id, environment_id, status, created_at, updated_at, completed_at")
      .maybeSingle();
    if (error) throw error;
    return data ? mapRun(data) : null;
  }

  async appendEvent(input: AppendEventInput): Promise<AgentEvent> {
    const isUuid =
      input.taskId &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(input.taskId);
    let { data, error } = await this.client
      .from("agent_events")
      .insert({
        run_id: input.runId,
        task_id: isUuid ? input.taskId : null,
        event_type: input.eventType,
        payload:
          input.payload && typeof input.payload === "object"
            ? input.payload
            : { value: input.payload },
      })
      .select("id, run_id, task_id, event_type, payload, created_at")
      .single();

    if (error && input.taskId) {
      // Retry with null task_id if foreign key or type error
      const retry = await this.client
        .from("agent_events")
        .insert({
          run_id: input.runId,
          task_id: null,
          event_type: input.eventType,
          payload:
            input.payload && typeof input.payload === "object"
              ? input.payload
              : { value: input.payload },
        })
        .select("id, run_id, task_id, event_type, payload, created_at")
        .single();

      if (!retry.error) {
        data = retry.data;
        error = null;
      }
    }

    if (error || !data) throw error ?? new Error("Failed to append event");
    return mapEvent(data);
  }

  async listEventsAfter(input: ListEventsAfterInput): Promise<AgentEvent[]> {
    let query = this.client
      .from("agent_events")
      .select("id, run_id, task_id, event_type, payload, created_at")
      .eq("run_id", input.runId)
      .order("id", { ascending: true });

    if (input.afterId != null) {
      const numericId = Number(input.afterId);
      if (!Number.isNaN(numericId) && numericId >= 0) {
        query = query.gt("id", numericId);
      }
    }

    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []).map(mapEvent);
  }
}

function mapConversation(row: Record<string, unknown>): Conversation {
  return {
    id: String(row.id),
    environmentId: String(row.environment_id),
    userId: String(row.user_id),
    title: String(row.title),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function mapMessage(row: Record<string, unknown>): Message {
  return {
    id: String(row.id),
    conversationId: String(row.conversation_id),
    role: ((row.sender_type ?? row.role) as MessageRole) || "user",
    content: String(row.content),
    sender: row.sender_id ? String(row.sender_id) : row.sender ? String(row.sender) : null,
    createdAt: String(row.created_at),
  };
}

function mapRun(row: Record<string, unknown>): AgentRun {
  return {
    id: String(row.id),
    conversationId: String(row.conversation_id),
    environmentId: String(row.environment_id),
    status: row.status as RunStatus,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    completedAt: row.completed_at ? String(row.completed_at) : null,
  };
}

function mapTask(row: Record<string, unknown>): AgentTask {
  return {
    id: String(row.id),
    runId: String(row.run_id),
    agentId: String(row.agent_id),
    parentTaskId: row.parent_task_id ? String(row.parent_task_id) : null,
    status: row.status as TaskStatus,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    completedAt: row.completed_at ? String(row.completed_at) : null,
  };
}

function mapEvent(row: Record<string, unknown>): AgentEvent {
  return {
    id: Number(row.id),
    runId: String(row.run_id),
    taskId: row.task_id ? String(row.task_id) : null,
    eventType: String(row.event_type),
    payload: (row.payload ?? {}) as Record<string, unknown>,
    createdAt: String(row.created_at),
  };
}

export function createChatbotStore(client: SupabaseClient | null = null): ChatbotStore {
  const mode = process.env.DATABASE_MODE ?? "memory";
  if (mode === "supabase" && client) {
    return new SupabaseChatbotStore(client);
  }
  return new InMemoryChatbotStore();
}
