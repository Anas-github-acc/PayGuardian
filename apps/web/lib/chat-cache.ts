/**
 * IndexedDB chat cache for storing up to 10 previous conversations and their messages.
 */

export interface CachedConversation {
  id: string;
  environmentId: string;
  title: string;
  updatedAt: string;
  metadata?: Record<string, unknown>;
}

export interface CachedMessage {
  id: string;
  conversationId: string;
  senderType: "user" | "assistant" | "system";
  senderId?: string;
  content: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

const DB_NAME = "payguardian_chat_cache";
const DB_VERSION = 1;
const CONV_STORE = "conversations";
const MSG_STORE = "messages";
const MAX_CACHED_CONVERSATIONS = 10;

// In-memory fallback if indexedDB is not available (e.g. SSR or incognito)
const memoryConversations = new Map<string, CachedConversation>();
const memoryMessages = new Map<string, CachedMessage[]>();

function hasIndexedDB(): boolean {
  return typeof window !== "undefined" && typeof window.indexedDB !== "undefined";
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!hasIndexedDB()) {
      return reject(new Error("IndexedDB unavailable"));
    }
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(CONV_STORE)) {
        const convStore = db.createObjectStore(CONV_STORE, { keyPath: "id" });
        convStore.createIndex("updatedAt", "updatedAt", { unique: false });
        convStore.createIndex("environmentId", "environmentId", { unique: false });
      }
      if (!db.objectStoreNames.contains(MSG_STORE)) {
        const msgStore = db.createObjectStore(MSG_STORE, { keyPath: "id" });
        msgStore.createIndex("conversationId", "conversationId", { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveConversation(conversation: CachedConversation): Promise<void> {
  memoryConversations.set(conversation.id, conversation);

  if (!hasIndexedDB()) return;

  try {
    const db = await openDB();
    const tx = db.transaction([CONV_STORE, MSG_STORE], "readwrite");
    const convStore = tx.objectStore(CONV_STORE);
    convStore.put(conversation);

    // Enforce max 10 conversations
    const req = convStore.index("updatedAt").getAll();
    req.onsuccess = () => {
      const all: CachedConversation[] = req.result || [];
      if (all.length > MAX_CACHED_CONVERSATIONS) {
        // Sort descending by updatedAt
        all.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
        const toDelete = all.slice(MAX_CACHED_CONVERSATIONS);
        const msgStore = tx.objectStore(MSG_STORE);
        for (const item of toDelete) {
          convStore.delete(item.id);
          // Delete related messages
          const msgIdx = msgStore.index("conversationId");
          const msgReq = msgIdx.getAllKeys(item.id);
          msgReq.onsuccess = () => {
            for (const key of msgReq.result) {
              msgStore.delete(key);
            }
          };
        }
      }
    };
  } catch (err) {
    console.warn("Failed to persist conversation to IndexedDB:", err);
  }
}

export async function getCachedConversations(environmentId?: string): Promise<CachedConversation[]> {
  if (!hasIndexedDB()) {
    const arr = Array.from(memoryConversations.values());
    return environmentId ? arr.filter((c) => c.environmentId === environmentId) : arr;
  }

  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(CONV_STORE, "readonly");
      const store = tx.objectStore(CONV_STORE);
      const req = store.getAll();
      req.onsuccess = () => {
        let list: CachedConversation[] = req.result || [];
        if (environmentId) {
          list = list.filter((c) => c.environmentId === environmentId);
        }
        list.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
        resolve(list.slice(0, MAX_CACHED_CONVERSATIONS));
      };
      req.onerror = () => resolve([]);
    });
  } catch {
    return [];
  }
}

export async function deleteCachedConversation(conversationId: string): Promise<void> {
  memoryConversations.delete(conversationId);
  memoryMessages.delete(conversationId);

  if (!hasIndexedDB()) return;

  try {
    const db = await openDB();
    const tx = db.transaction([CONV_STORE, MSG_STORE], "readwrite");
    const convStore = tx.objectStore(CONV_STORE);
    convStore.delete(conversationId);

    const msgStore = tx.objectStore(MSG_STORE);
    const msgIdx = msgStore.index("conversationId");
    const msgReq = msgIdx.getAllKeys(conversationId);
    msgReq.onsuccess = () => {
      for (const key of msgReq.result) {
        msgStore.delete(key);
      }
    };
  } catch (err) {
    console.warn("Failed to delete conversation from IndexedDB:", err);
  }
}

export async function saveMessages(conversationId: string, messages: CachedMessage[]): Promise<void> {
  memoryMessages.set(conversationId, messages);

  if (!hasIndexedDB()) return;

  try {
    const db = await openDB();
    const tx = db.transaction(MSG_STORE, "readwrite");
    const store = tx.objectStore(MSG_STORE);
    for (const msg of messages) {
      store.put(msg);
    }
  } catch (err) {
    console.warn("Failed to persist messages to IndexedDB:", err);
  }
}

export async function getCachedMessages(conversationId: string): Promise<CachedMessage[]> {
  if (!hasIndexedDB()) {
    return memoryMessages.get(conversationId) || [];
  }

  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(MSG_STORE, "readonly");
      const store = tx.objectStore(MSG_STORE);
      const idx = store.index("conversationId");
      const req = idx.getAll(conversationId);
      req.onsuccess = () => {
        const list: CachedMessage[] = req.result || [];
        list.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        resolve(list);
      };
      req.onerror = () => resolve([]);
    });
  } catch {
    return [];
  }
}

export async function isConversationCached(conversationId: string): Promise<boolean> {
  if (!hasIndexedDB()) {
    return memoryMessages.has(conversationId) && (memoryMessages.get(conversationId)?.length ?? 0) > 0;
  }

  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(MSG_STORE, "readonly");
      const store = tx.objectStore(MSG_STORE);
      const idx = store.index("conversationId");
      const req = idx.count(conversationId);
      req.onsuccess = () => resolve(req.result > 0);
      req.onerror = () => resolve(false);
    });
  } catch {
    return false;
  }
}
