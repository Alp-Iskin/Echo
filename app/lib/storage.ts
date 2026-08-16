import type { Entry, TodoItem, GoalItem, UIState, Theme, ChatMessage } from "./types";

const ENTRIES_KEY = "journal_entries_v3";
const TODOS_KEY = "journal_todos_v1";
const GOALS_KEY = "journal_goals_v1";
const UI_KEY = "journal_ui_v2"; // bumped because UI schema changed (theme)
const CHAT_KEY = "journal_echo_chat_v1";
const WELCOME_KEY = "journal_welcomed_v1";

function safeGetItem(key: string): string | null {
  try {
    return typeof window !== "undefined" && window.localStorage ? localStorage.getItem(key) : null;
  } catch (err) {
    console.warn(`[Storage] Failed to read key "${key}" from localStorage:`, err);
    return null;
  }
}

function safeSetItem(key: string, value: string): boolean {
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      localStorage.setItem(key, value);
      return true;
    }
    return false;
  } catch (err) {
    console.error(`[Storage] QuotaExceededError or write failure for "${key}":`, err);
    return false;
  }
}

function safeParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function loadEntries(): Entry[] {
  const parsed = safeParse<Entry[]>(safeGetItem(ENTRIES_KEY), []);
  if (!Array.isArray(parsed)) return [];
  return parsed.filter(
    (e) =>
      typeof e?.id === "string" &&
      typeof e?.title === "string" &&
      typeof e?.body === "string" &&
      typeof e?.createdAt === "number"
  );
}

export function saveEntries(entries: Entry[]) {
  safeSetItem(ENTRIES_KEY, JSON.stringify(entries));
}

export function loadTodos(): TodoItem[] {
  const parsed = safeParse<TodoItem[]>(safeGetItem(TODOS_KEY), []);
  if (!Array.isArray(parsed)) return [];
  return parsed.filter(
    (t) =>
      typeof t?.id === "string" &&
      typeof t?.text === "string" &&
      typeof t?.done === "boolean"
  );
}

export function saveTodos(todos: TodoItem[]) {
  safeSetItem(TODOS_KEY, JSON.stringify(todos));
}

export function loadGoals(): GoalItem[] {
  const parsed = safeParse<GoalItem[]>(safeGetItem(GOALS_KEY), []);
  if (!Array.isArray(parsed)) return [];
  return parsed.filter(
    (g) => typeof g?.id === "string" && typeof g?.text === "string"
  );
}

export function saveGoals(goals: GoalItem[]) {
  safeSetItem(GOALS_KEY, JSON.stringify(goals));
}

const defaultUI: UIState = {
  dockTodo: false,
  dockGoals: false,
  activeMain: "journal",
  theme: "light",
  aiBackend: "cloud",
};

function isTheme(x: unknown): x is Theme {
  return x === "light" || x === "dark";
}

export function loadUI(): UIState {
  const parsed = safeParse<Partial<UIState>>(safeGetItem(UI_KEY), {});
  const activeMain =
    parsed?.activeMain === "todo" ||
    parsed?.activeMain === "goals" ||
    parsed?.activeMain === "echo"
      ? parsed.activeMain
      : "journal";

  return {
    dockTodo: !!parsed?.dockTodo,
    dockGoals: !!parsed?.dockGoals,
    activeMain,
    theme: isTheme(parsed?.theme) ? parsed.theme : defaultUI.theme,
    aiBackend:
      parsed?.aiBackend === "local" || parsed?.aiBackend === "cloud"
        ? parsed.aiBackend
        : defaultUI.aiBackend,
  };
}

export function saveUI(ui: UIState) {
  safeSetItem(UI_KEY, JSON.stringify(ui));
}

export function loadChat(): ChatMessage[] {
  const parsed = safeParse<ChatMessage[]>(safeGetItem(CHAT_KEY), []);
  if (!Array.isArray(parsed)) return [];
  return parsed.filter(
    (m) =>
      typeof m?.id === "string" &&
      (m?.role === "user" || m?.role === "assistant") &&
      typeof m?.content === "string" &&
      (m?.delivery === undefined ||
        m.delivery === "pending" ||
        m.delivery === "complete" ||
        m.delivery === "failed")
  );
}

export function saveChat(messages: ChatMessage[]) {
  safeSetItem(CHAT_KEY, JSON.stringify(messages));
}

export function loadWelcomed(): boolean {
  return safeGetItem(WELCOME_KEY) === "1";
}

export function saveWelcomed(v: boolean) {
  safeSetItem(WELCOME_KEY, v ? "1" : "0");
}

export function formatDate(ts: number) {
  return new Date(ts).toLocaleString();
}
