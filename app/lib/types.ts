export type Entry = {
  id: string;
  title: string;
  body: string;
  createdAt: number;
  updatedAt?: number;
};

export type Mode = "new" | "view" | "edit";

export type TodoItem = {
  id: string;
  text: string;
  done: boolean;
  createdAt: number;
};

export type GoalItem = {
  id: string;
  text: string;
  createdAt: number;
};

export type Panel = "journal" | "todo" | "goals" | "echo";

export type Theme = "light" | "dark";

export type AiBackend = "cloud" | "local";

export type ChatRole = "user" | "assistant";
export type ChatDelivery = "pending" | "complete" | "failed";

export type ChatMessage = {
  id: string;
  role: ChatRole;
  content: string;
  delivery?: ChatDelivery;
};

export type UIState = {
  dockTodo: boolean;
  dockGoals: boolean;
  activeMain: Panel; // what the main content area shows
  theme: Theme;
  aiBackend: AiBackend; // "cloud" = Gemini, "local" = on-device WebLLM
};
