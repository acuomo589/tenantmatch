import { BASE_PROMPT } from "@/lib/ai/prompt";
import type { CandidateRow, ChatMessage, ListingIntake, ListingThread } from "@/lib/types";

interface ThreadStore {
  threads: Map<string, ListingThread>;
}

declare global {
  // eslint-disable-next-line no-var
  var __timpani_store__: ThreadStore | undefined;
}

const store: ThreadStore =
  globalThis.__timpani_store__ ?? {
    threads: new Map<string, ListingThread>(),
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
  return [...store.threads.values()].sort((a, b) =>
    b.updatedAt.localeCompare(a.updatedAt),
  );
}

export function getThread(threadId: string): ListingThread | null {
  return store.threads.get(threadId) ?? null;
}

export function createThread(intake: ListingIntake): ListingThread {
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

  store.threads.set(thread.id, thread);
  return thread;
}

export function updateThread(thread: ListingThread): ListingThread {
  thread.updatedAt = nowIso();
  store.threads.set(thread.id, thread);
  return thread;
}

export function addMessage(
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
  return updateThread(thread);
}

export function setRunOutput(
  thread: ListingThread,
  candidates: CandidateRow[],
  rawCsv: string,
): ListingThread {
  thread.candidates = candidates;
  thread.rawCsv = rawCsv;
  return updateThread(thread);
}

export function cloneThread(thread: ListingThread): ListingThread {
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
  store.threads.set(cloned.id, cloned);
  return cloned;
}
