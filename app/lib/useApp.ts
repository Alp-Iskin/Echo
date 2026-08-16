"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type {
  Entry,
  GoalItem,
  Mode,
  Panel,
  TodoItem,
  UIState,
  Theme,
  ChatMessage,
} from "./types";
import {
  loadChat,
  loadEntries,
  loadGoals,
  loadTodos,
  loadUI,
  loadWelcomed,
  saveChat,
  saveEntries,
  saveGoals,
  saveTodos,
  saveUI,
  saveWelcomed,
} from "./storage";
import {
  buildSystemPrompt,
  DEFAULT_MODEL,
  getEngine,
  isWebGPUAvailable,
  streamEcho,
  streamGemini,
  type EchoModelId,
  type InitProgress,
} from "./ai";
import {
  completeAssistantMessage,
  failAssistantMessage,
} from "./echoTransport";

type ToastKind = "info" | "error" | "success";
type Toast = { message: string; kind: ToastKind };

type FormErrors = {
  title?: string;
  body?: string;
};

export function useApp() {
  // ----------------------------
  // Journal state
  // ----------------------------
  const [entries, setEntries] = useState<Entry[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>("new");

  const [titleState, setTitleState] = useState("");
  const [bodyState, setBodyState] = useState("");
  const [query, setQuery] = useState("");

  const [formErrors, setFormErrors] = useState<FormErrors>({});

  // ----------------------------
  // Todo + Goals state
  // ----------------------------
  const [todos, setTodos] = useState<TodoItem[]>([]);
  const [goals, setGoals] = useState<GoalItem[]>([]);
  const [todoDraft, setTodoDraft] = useState("");
  const [goalDraft, setGoalDraft] = useState("");

  // ----------------------------
  // App lifecycle / onboarding
  // ----------------------------
  // `hydrated` flips true once localStorage has loaded, so we don't flash the
  // welcome screen at returning users before we know they've seen it.
  const [hydrated, setHydrated] = useState(false);
  const [welcomed, setWelcomed] = useState(true);

  // ----------------------------
  // UI state
  // ----------------------------
  const [ui, setUI] = useState<UIState>({
    dockTodo: false,
    dockGoals: false,
    activeMain: "journal",
    theme: "light",
    aiBackend: "cloud",
  });

  // ----------------------------
  // Echo (AI companion) state
  // ----------------------------
  type AiStatus = "idle" | "loading" | "generating";
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatDraft, setChatDraft] = useState("");
  const [aiStatus, setAiStatus] = useState<AiStatus>("idle");
  const [modelProgress, setModelProgress] = useState<InitProgress | null>(null);
  const [selectedModel, setSelectedModel] = useState<EchoModelId>(DEFAULT_MODEL);
  const [aiError, setAiError] = useState<string | null>(null);
  const [webgpuAvailable, setWebgpuAvailable] = useState(true);

  // ----------------------------
  // Toast
  // ----------------------------
  const [toast, setToast] = useState<Toast | null>(null);
  const toastTimerRef = useRef<number | null>(null);

  function pushToast(message: string, kind: ToastKind = "info") {
    if (!message.trim()) return;
    setToast({ message, kind });

    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => setToast(null), 2500);
  }

  function clearToast() {
    setToast(null);
    if (toastTimerRef.current) {
      window.clearTimeout(toastTimerRef.current);
      toastTimerRef.current = null;
    }
  }

  function clearFormErrors() {
    setFormErrors({});
  }

  function setTitle(v: string) {
    setTitleState(v);
    if (formErrors.title)
      setFormErrors((prev) => ({ ...prev, title: undefined }));
  }

  function setBody(v: string) {
    setBodyState(v);
    if (formErrors.body)
      setFormErrors((prev) => ({ ...prev, body: undefined }));
  }

  // ----------------------------
  // Load everything once
  // ----------------------------
  useEffect(() => {
    const e = loadEntries();
    const t = loadTodos();
    const g = loadGoals();
    const u = loadUI();
    const c = loadChat();

    setEntries(e);
    setTodos(t);
    setGoals(g);
    setUI(u);
    setMessages(c);
    setWebgpuAvailable(isWebGPUAvailable());
    setWelcomed(loadWelcomed());
    setHydrated(true);

    if (e.length > 0) {
      setActiveId(e[0].id);
      setMode("view");
    } else {
      setMode("new");
    }
  }, []);

  // ----------------------------
  // Persist to localStorage
  // ----------------------------
  useEffect(() => {
    if (!hydrated) return;
    saveEntries(entries);
  }, [entries, hydrated]);
  useEffect(() => {
    if (!hydrated) return;
    saveTodos(todos);
  }, [todos, hydrated]);
  useEffect(() => {
    if (!hydrated) return;
    saveGoals(goals);
  }, [goals, hydrated]);
  useEffect(() => {
    if (!hydrated) return;
    saveUI(ui);
  }, [ui, hydrated]);
  useEffect(() => {
    if (!hydrated) return;
    saveChat(messages);
  }, [messages, hydrated]);

  // ----------------------------
  // Derived journal values
  // ----------------------------
  const activeEntry = useMemo(() => {
    if (!activeId) return null;
    return entries.find((e) => e.id === activeId) ?? null;
  }, [entries, activeId]);

  const filteredEntries = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return entries;
    return entries.filter(
      (e) =>
        e.title.toLowerCase().includes(q) || e.body.toLowerCase().includes(q)
    );
  }, [entries, query]);

  // ----------------------------
  // Journal actions
  // ----------------------------
  function startNew() {
    setActiveId(null);
    setMode("new");
    setTitleState("");
    setBodyState("");
    clearFormErrors();
    pushToast("New entry ready.", "info");
  }

  function openEntry(id: string) {
    const e = entries.find((x) => x.id === id);
    if (!e) {
      pushToast("That entry doesn’t exist.", "error");
      return;
    }
    setActiveId(id);
    setMode("view");
    clearFormErrors();
  }

  function startEdit(id: string) {
    const e = entries.find((x) => x.id === id);
    if (!e) {
      pushToast("Select an entry to edit.", "error");
      return;
    }
    setActiveId(id);
    setMode("edit");
    setTitleState(e.title);
    setBodyState(e.body);
    clearFormErrors();
  }

  function cancelEdit() {
    setMode("view");
    setTitleState("");
    setBodyState("");
    clearFormErrors();
    pushToast("Edit cancelled.", "info");
  }

  function saveNew() {
    const t = titleState.trim();
    const b = bodyState.trim();

    const nextErrors: FormErrors = {};
    if (!t) nextErrors.title = "Title is required.";
    if (!b) nextErrors.body = "Entry can’t be empty.";

    if (nextErrors.title || nextErrors.body) {
      setFormErrors(nextErrors);
      pushToast("Please fix the highlighted fields.", "error");
      return;
    }

    const newEntry: Entry = {
      id: crypto.randomUUID(),
      title: t,
      body: b,
      createdAt: Date.now(),
    };

    setEntries((prev) => [newEntry, ...prev]);
    setActiveId(newEntry.id);
    setMode("view");
    setTitleState("");
    setBodyState("");
    clearFormErrors();
    pushToast("Saved.", "success");
  }

  function saveEdits() {
    if (!activeId) {
      pushToast("No entry selected.", "error");
      return;
    }

    const t = titleState.trim();
    const b = bodyState.trim();

    const nextErrors: FormErrors = {};
    if (!t) nextErrors.title = "Title can’t be empty.";
    if (!b) nextErrors.body = "Entry can’t be empty.";

    if (nextErrors.title || nextErrors.body) {
      setFormErrors(nextErrors);
      pushToast("Please fix the highlighted fields.", "error");
      return;
    }

    setEntries((prev) =>
      prev.map((e) =>
        e.id === activeId
          ? { ...e, title: t, body: b, updatedAt: Date.now() }
          : e
      )
    );

    setMode("view");
    setTitleState("");
    setBodyState("");
    clearFormErrors();
    pushToast("Updated.", "success");
  }

  function deleteEntry(id: string) {
    const e = entries.find((x) => x.id === id);
    if (!e) return pushToast("That entry doesn’t exist.", "error");

    const ok = confirm(`Delete "${e.title}"? This can’t be undone.`);
    if (!ok) return;

    const remaining = entries.filter((x) => x.id !== id);
    setEntries(remaining);
    pushToast("Deleted.", "success");

    if (activeId === id) {
      if (remaining.length > 0) {
        setActiveId(remaining[0].id);
        setMode("view");
      } else {
        startNew();
      }
    }
  }

  function renameEntry(id: string, newTitle: string) {
    const t = newTitle.trim();
    if (!t) return pushToast("Title can’t be empty.", "error");

    setEntries((prev) =>
      prev.map((e) =>
        e.id === id ? { ...e, title: t, updatedAt: Date.now() } : e
      )
    );
    pushToast("Renamed.", "success");
  }

  // ----------------------------
  // Todo actions
  // ----------------------------
  function addTodo() {
    const text = todoDraft.trim();
    if (!text) return pushToast("Type a todo first.", "error");

    const item: TodoItem = {
      id: crypto.randomUUID(),
      text,
      done: false,
      createdAt: Date.now(),
    };
    setTodos((prev) => [item, ...prev]);
    setTodoDraft("");
    pushToast("Todo added.", "success");
  }

  function toggleTodo(id: string) {
    setTodos((prev) =>
      prev.map((t) => (t.id === id ? { ...t, done: !t.done } : t))
    );
  }

  function deleteTodo(id: string) {
    setTodos((prev) => prev.filter((t) => t.id !== id));
    pushToast("Todo removed.", "info");
  }

  // ----------------------------
  // Goal actions
  // ----------------------------
  function addGoal() {
    const text = goalDraft.trim();
    if (!text) return pushToast("Type a goal first.", "error");

    const item: GoalItem = {
      id: crypto.randomUUID(),
      text,
      createdAt: Date.now(),
    };
    setGoals((prev) => [item, ...prev]);
    setGoalDraft("");
    pushToast("Goal added.", "success");
  }

  function deleteGoal(id: string) {
    setGoals((prev) => prev.filter((g) => g.id !== id));
    pushToast("Goal removed.", "info");
  }

  // ----------------------------
  // Echo (AI companion) actions
  // ----------------------------
  async function sendEcho() {
    const text = chatDraft.trim();
    if (!text || aiStatus !== "idle") return;

    const backend = ui.aiBackend;

    if (backend === "local" && !isWebGPUAvailable()) {
      setWebgpuAvailable(false);
      setAiError(
        "This browser can’t run the on-device model — it needs WebGPU (try Chrome or Edge on a desktop), or switch Echo to Gemini."
      );
      return;
    }

    setAiError(null);

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: text,
    };
    // History for the model = everything so far + this new message.
    const history = [...messages, userMsg];

    const assistantId = crypto.randomUUID();
    setMessages([
      ...history,
      {
        id: assistantId,
        role: "assistant",
        content: "",
        delivery: "pending",
      },
    ]);
    setChatDraft("");

    const onToken = (full: string) =>
      setMessages((prev) =>
        prev.map((m) => (m.id === assistantId ? { ...m, content: full } : m))
      );

    try {
      if (backend === "cloud") {
        // Gemini has a large context window, so we can afford much more journal.
        setAiStatus("generating");
        const system = buildSystemPrompt({
          entries,
          todos,
          goals,
          charBudget: 24000,
        });
        await streamGemini({ system, history, onToken });
      } else {
        setAiStatus("loading");
        const engine = await getEngine(selectedModel, setModelProgress);
        setAiStatus("generating");
        const system = buildSystemPrompt({ entries, todos, goals });
        await streamEcho({ engine, system, history, onToken });
      }
      setMessages((prev) => completeAssistantMessage(prev, assistantId));
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Something went wrong.";
      setAiError(message);
      setMessages((prev) =>
        failAssistantMessage(prev, assistantId, `⚠️ ${message}`)
      );
    } finally {
      setAiStatus("idle");
    }
  }

  function dismissWelcome() {
    setWelcomed(true);
    saveWelcomed(true);
    setMain("journal");
  }

  function clearChat() {
    if (messages.length === 0) return;
    const ok = confirm("Clear this conversation with Echo?");
    if (!ok) return;
    setMessages([]);
    setAiError(null);
    pushToast("Conversation cleared.", "info");
  }

  // ----------------------------
  // UI actions (dock + pages + theme)
  // ----------------------------
  function setMain(panel: Panel) {
    setUI((prev) => ({ ...prev, activeMain: panel }));
  }

  function toggleDockTodo() {
    setUI((prev) => ({ ...prev, dockTodo: !prev.dockTodo }));
  }

  function toggleDockGoals() {
    setUI((prev) => ({ ...prev, dockGoals: !prev.dockGoals }));
  }

  function setTheme(theme: Theme) {
    setUI((prev) => ({ ...prev, theme }));
  }

  function setAiBackend(backend: UIState["aiBackend"]) {
    setUI((prev) => ({ ...prev, aiBackend: backend }));
  }

  // ✅ FIXED: no stale ui.theme; updates + toast are consistent
  function toggleTheme() {
    setUI((prev) => {
      const next = prev.theme === "light" ? "dark" : "light";
      pushToast(next === "dark" ? "Dark mode" : "Light mode", "info");
      return { ...prev, theme: next };
    });
  }

  return {
    // journal data
    entries,
    filteredEntries,
    activeEntry,
    activeId,
    mode,
    title: titleState,
    body: bodyState,
    query,
    formErrors,

    // journal setters/actions
    setTitle,
    setBody,
    setQuery,
    startNew,
    openEntry,
    startEdit,
    cancelEdit,
    saveNew,
    saveEdits,
    deleteEntry,
    renameEntry,

    // todos
    todos,
    todoDraft,
    setTodoDraft,
    addTodo,
    toggleTodo,
    deleteTodo,

    // goals
    goals,
    goalDraft,
    setGoalDraft,
    addGoal,
    deleteGoal,

    // lifecycle / onboarding
    hydrated,
    welcomed,
    dismissWelcome,

    // echo (AI companion)
    messages,
    chatDraft,
    setChatDraft,
    sendEcho,
    clearChat,
    aiStatus,
    modelProgress,
    selectedModel,
    setSelectedModel,
    aiError,
    webgpuAvailable,

    // UI
    ui,
    setMain,
    toggleDockTodo,
    toggleDockGoals,
    setTheme,
    toggleTheme,
    setAiBackend,

    // toast
    toast,
    pushToast,
    clearToast,
  };
}
