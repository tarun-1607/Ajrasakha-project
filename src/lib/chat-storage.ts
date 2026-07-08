import type { UIMessage } from "ai";

export type ChatThread = {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messages: UIMessage[];
};

const INDEX_KEY = "ajrasakha:threads:index:v1";
const THREAD_KEY = (id: string) => `ajrasakha:thread:${id}:v1`;

function isBrowser() {
  return typeof window !== "undefined";
}

function safeParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export type ThreadSummary = Pick<ChatThread, "id" | "title" | "updatedAt" | "createdAt">;

export function listThreads(): ThreadSummary[] {
  if (!isBrowser()) return [];
  const summaries = safeParse<ThreadSummary[]>(
    localStorage.getItem(INDEX_KEY),
    [],
  );
  return [...summaries].sort((a, b) => b.updatedAt - a.updatedAt);
}

export function loadThread(id: string): ChatThread | null {
  if (!isBrowser()) return null;
  return safeParse<ChatThread | null>(
    localStorage.getItem(THREAD_KEY(id)),
    null,
  );
}

function writeIndex(index: ThreadSummary[]) {
  localStorage.setItem(INDEX_KEY, JSON.stringify(index));
}

export function saveThread(thread: ChatThread) {
  if (!isBrowser()) return;
  localStorage.setItem(THREAD_KEY(thread.id), JSON.stringify(thread));
  const index = listThreads();
  const rest = index.filter((t) => t.id !== thread.id);
  const summary: ThreadSummary = {
    id: thread.id,
    title: thread.title,
    createdAt: thread.createdAt,
    updatedAt: thread.updatedAt,
  };
  writeIndex([summary, ...rest]);
}

export function deleteThread(id: string) {
  if (!isBrowser()) return;
  localStorage.removeItem(THREAD_KEY(id));
  writeIndex(listThreads().filter((t) => t.id !== id));
}

export function renameThread(id: string, title: string) {
  const thread = loadThread(id);
  if (!thread) return;
  saveThread({ ...thread, title, updatedAt: Date.now() });
}

export function newThreadId(): string {
  return `t_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function deriveTitle(text: string): string {
  const cleaned = text.trim().replace(/\s+/g, " ");
  if (!cleaned) return "New conversation";
  return cleaned.length > 48 ? `${cleaned.slice(0, 48)}…` : cleaned;
}