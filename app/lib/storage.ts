import type { Entry, TodoItem, GoalItem, UIState, Theme, ChatMessage } from "./types";

const ENTRIES_KEY = "journal_entries_v3";
const TODOS_KEY = "journal_todos_v1";
const GOALS_KEY = "journal_goals_v1";
const UI_KEY = "journal_ui_v2"; // bumped because UI schema changed (theme)
const CHAT_KEY = "journal_echo_chat_v1";
const WELCOME_KEY = "journal_welcomed_v1";

function safeParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function loadEntries(): Entry[] {
  const parsed = safeParse<Entry[]>(localStorage.getItem(ENTRIES_KEY), []);
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
  localStorage.setItem(ENTRIES_KEY, JSON.stringify(entries));
}

export function loadTodos(): TodoItem[] {
  const parsed = safeParse<TodoItem[]>(localStorage.getItem(TODOS_KEY), []);
  if (!Array.isArray(parsed)) return [];
  return parsed.filter(
    (t) =>
      typeof t?.id === "string" &&
      typeof t?.text === "string" &&
      typeof t?.done === "boolean"
  );
}

export function saveTodos(todos: TodoItem[]) {
  localStorage.setItem(TODOS_KEY, JSON.stringify(todos));
}

export function loadGoals(): GoalItem[] {
  const parsed = safeParse<GoalItem[]>(localStorage.getItem(GOALS_KEY), []);
  if (!Array.isArray(parsed)) return [];
  return parsed.filter(
    (g) => typeof g?.id === "string" && typeof g?.text === "string"
  );
}

export function saveGoals(goals: GoalItem[]) {
  localStorage.setItem(GOALS_KEY, JSON.stringify(goals));
}

const defaultUI: UIState = {
  dockTodo: false,
  dockGoals: false,
  activeMain: "journal",
  theme: "light",
  aiBackend: "cloud",
};

function isTheme(x: any): x is Theme {
  return x === "light" || x === "dark";
}

export function loadUI(): UIState {
  const parsed = safeParse<Partial<UIState>>(localStorage.getItem(UI_KEY), {});
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
  localStorage.setItem(UI_KEY, JSON.stringify(ui));
}

export function loadChat(): ChatMessage[] {
  const parsed = safeParse<ChatMessage[]>(localStorage.getItem(CHAT_KEY), []);
  if (!Array.isArray(parsed)) return [];
  return parsed.filter(
    (m) =>
      typeof m?.id === "string" &&
      (m?.role === "user" || m?.role === "assistant") &&
      typeof m?.content === "string"
  );
}

export function saveChat(messages: ChatMessage[]) {
  localStorage.setItem(CHAT_KEY, JSON.stringify(messages));
}

export function loadWelcomed(): boolean {
  return localStorage.getItem(WELCOME_KEY) === "1";
}

export function saveWelcomed(v: boolean) {
  localStorage.setItem(WELCOME_KEY, v ? "1" : "0");
}

export function formatDate(ts: number) {
  return new Date(ts).toLocaleString();
}
