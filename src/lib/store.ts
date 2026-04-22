import { BASE_PROMPT } from "@/lib/ai/prompt";
import type { CandidateRow, ChatMessage, ListingIntake, ListingThread } from "@/lib/types";

interface ThreadStore {
  threadsByTenant: Map<string, Map<string, ListingThread>>;
}

declare global {
  // eslint-disable-next-line no-var
  var __timpani_store__: ThreadStore | undefined;
}

const store: ThreadStore =
  globalThis.__timpani_store__ ?? {
    threadsByTenant: new Map<string, Map<string, ListingThread>>(),
  };

if (!globalThis.__timpani_store__) {
  globalThis.__timpani_store__ = store;
}

function nowIso(): string {
  return new Date().toISOString();
}

function id(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

export function listThreads(): ListingThread[] {
  return [...store.threadsByTenant.values()]
    .flatMap((threads) => [...threads.values()])
    .sort((a, b) =>
    b.updatedAt.localeCompare(a.updatedAt),
    );
}

function getTenantThreads(tenantId: string) {
  const existing = store.threadsByTenant.get(tenantId);
  if (existing) return existing;

  const seeded = new Map<string, ListingThread>();
  store.threadsByTenant.set(tenantId, seeded);
  return seeded;
}

export function getThread(tenantId: string, threadId: string): ListingThread | null {
  return getTenantThreads(tenantId).get(threadId) ?? null;
}

export function createThread(tenantId: string, intake: ListingIntake): ListingThread {
  const ts = nowIso();
  const thread: ListingThread = {
    id: id("thread"),
    title: intake.address,
    createdAt: ts,
    updatedAt: ts,
    intake,
    basePrompt: BASE_PROMPT,
    currentPrompt: BASE_PROMPT,
    messages: [
      {
        id: id("msg"),
        role: "system",
        content: "Thread created from listing intake.",
        createdAt: ts,
      },
    ],
    candidates: [],
    rawCsv: "",
  };

  getTenantThreads(tenantId).set(thread.id, thread);
  return thread;
}

export function updateThread(tenantId: string, thread: ListingThread): ListingThread {
  thread.updatedAt = nowIso();
  getTenantThreads(tenantId).set(thread.id, thread);
  return thread;
}

export function addMessage(
  tenantId: string,
  thread: ListingThread,
  role: ChatMessage["role"],
  content: string,
): ListingThread {
  thread.messages.push({
    id: id("msg"),
    role,
    content,
    createdAt: nowIso(),
  });
  return updateThread(tenantId, thread);
}

export function setRunOutput(
  tenantId: string,
  thread: ListingThread,
  candidates: CandidateRow[],
  rawCsv: string,
): ListingThread {
  thread.candidates = candidates;
  thread.rawCsv = rawCsv;
  return updateThread(tenantId, thread);
}

export function cloneThread(tenantId: string, thread: ListingThread): ListingThread {
  const ts = nowIso();
  const cloned: ListingThread = {
    ...thread,
    id: id("thread"),
    title: `${thread.title} (clone)`,
    createdAt: ts,
    updatedAt: ts,
    messages: [
      {
        id: id("msg"),
        role: "system",
        content: `Cloned from ${thread.id}`,
        createdAt: ts,
      },
    ],
  };
  getTenantThreads(tenantId).set(cloned.id, cloned);
  return cloned;
}

export function listThreadsForTenant(tenantId: string): ListingThread[] {
  return [...getTenantThreads(tenantId).values()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}
