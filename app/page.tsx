"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useApp } from "./lib/useApp";
import { formatDate } from "./lib/storage";
import { ECHO_MODELS } from "./lib/ai";
import type { Panel } from "./lib/types";

type AppState = ReturnType<typeof useApp>;

type ThemeTokens = {
  pageBg: string;
  text: string;
  cardBg: string;
  cardBorder: string;
  subtleBg: string;
  subtleHover: string;
  inputBg: string;
  inputBorder: string;
  inputFocus: string;
  mutedText: string;
};

type OliveTokens = {
  primary: string;
  softBg: string;
  softBorder: string;
  softText: string;
};

type Btns = {
  btnPrimary: string;
  btnSecondary: string;
  btnGhost: string;
  btnDanger: string;
};

function JournalMain({
  a,
  headerTitle,
  t,
  isDark,
  btns,
}: {
  a: AppState;
  headerTitle: string;
  t: ThemeTokens;
  isDark: boolean;
  btns: Btns;
}) {
  const titleErr = a.formErrors?.title;
  const bodyErr = a.formErrors?.body;
  const entry = a.activeEntry;

  return (
    <div
      className={[
        "h-full rounded-2xl border p-6 shadow-sm",
        t.cardBg,
        t.cardBorder,
      ].join(" ")}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <div
            className={[
              "text-xs font-semibold uppercase tracking-wide",
              t.mutedText,
            ].join(" ")}
          >
            {headerTitle}
          </div>

          {a.mode === "view" && a.activeEntry ? (
            <>
              <h1 className="mt-2 text-2xl font-semibold tracking-tight">
                {a.activeEntry.title}
              </h1>
              <div className={["mt-1 text-sm", t.mutedText].join(" ")}>
                {formatDate(a.activeEntry.updatedAt ?? a.activeEntry.createdAt)}
              </div>
            </>
          ) : (
            <h1 className="mt-2 text-2xl font-semibold tracking-tight">
              {a.mode === "new" ? "Write something" : "Update your entry"}
            </h1>
          )}
        </div>

        {a.mode === "view" && entry && (
          <div className="flex items-center gap-2">
            <button
              className={btns.btnSecondary}
              onClick={() => a.startEdit(entry.id)}
              type="button"
            >
              Edit
            </button>
            <button
              className={btns.btnDanger}
              onClick={() => a.deleteEntry(entry.id)}
              type="button"
            >
              Delete
            </button>
          </div>
        )}
      </div>

      <div className="mt-6">
        {a.mode === "view" ? (
          <div className="whitespace-pre-wrap leading-7">
            {a.activeEntry?.body ??
              "Select an entry on the left, or create a new one."}
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label
                className={[
                  "text-sm font-medium",
                  isDark ? "text-zinc-200" : "text-zinc-700",
                ].join(" ")}
              >
                Title
              </label>
              <input
                value={a.title}
                onChange={(e) => a.setTitle(e.target.value)}
                placeholder="Give it a title…"
                className={[
                  "mt-2 w-full rounded-xl border px-3 py-2 text-sm outline-none transition-colors",
                  t.inputBg,
                  titleErr
                    ? "border-red-400 focus:border-red-400"
                    : `${t.inputBorder} ${t.inputFocus}`,
                ].join(" ")}
              />
              {titleErr && (
                <div className="mt-1 text-xs font-medium text-red-400">
                  {titleErr}
                </div>
              )}
            </div>

            <div>
              <label
                className={[
                  "text-sm font-medium",
                  isDark ? "text-zinc-200" : "text-zinc-700",
                ].join(" ")}
              >
                Entry
              </label>
              <textarea
                value={a.body}
                onChange={(e) => a.setBody(e.target.value)}
                placeholder="Write your thoughts here…"
                className={[
                  "mt-2 h-64 w-full resize-none rounded-xl border px-3 py-3 text-sm leading-6 outline-none transition-colors",
                  t.inputBg,
                  bodyErr
                    ? "border-red-400 focus:border-red-400"
                    : `${t.inputBorder} ${t.inputFocus}`,
                ].join(" ")}
              />
              {bodyErr && (
                <div className="mt-1 text-xs font-medium text-red-400">
                  {bodyErr}
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              {a.mode === "edit" ? (
                <>
                  <button
                    className={btns.btnSecondary}
                    onClick={a.cancelEdit}
                    type="button"
                  >
                    Cancel
                  </button>
                  <button
                    className={btns.btnPrimary}
                    onClick={a.saveEdits}
                    type="button"
                  >
                    Save changes
                  </button>
                </>
              ) : (
                <button
                  className={btns.btnPrimary}
                  onClick={a.saveNew}
                  type="button"
                >
                  Save entry
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function TodoPanel({
  a,
  full,
  t,
  btns,
  openFull,
}: {
  a: AppState;
  full: boolean;
  t: ThemeTokens;
  btns: Btns;
  openFull: (panel: Panel) => void;
}) {
  return (
    <div
      className={[
        "h-full rounded-2xl border p-4 shadow-sm",
        t.cardBg,
        t.cardBorder,
      ].join(" ")}
    >
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold">To-do</div>
        {!full && (
          <button
            className={btns.btnGhost}
            type="button"
            onClick={() => openFull("todo")}
          >
            Open
          </button>
        )}
      </div>

      <div className="mt-3 flex gap-2">
        <input
          value={a.todoDraft}
          onChange={(e) => a.setTodoDraft(e.target.value)}
          placeholder="Add a task…"
          className={[
            "w-full rounded-xl border px-3 py-2 text-sm outline-none transition-colors",
            t.inputBg,
            t.inputBorder,
            t.inputFocus,
          ].join(" ")}
        />
        <button className={btns.btnPrimary} onClick={a.addTodo} type="button">
          Add
        </button>
      </div>

      <div className="mt-4 space-y-2">
        {a.todos.length === 0 ? (
          <div
            className={[
              "rounded-xl border border-dashed p-4 text-sm",
              t.cardBorder,
              t.mutedText,
            ].join(" ")}
          >
            No todos yet.
          </div>
        ) : (
          a.todos.map((tt) => (
            <div
              key={tt.id}
              className={[
                "flex items-center gap-2 rounded-xl border px-3 py-2",
                t.cardBorder,
              ].join(" ")}
            >
              <input
                type="checkbox"
                checked={tt.done}
                onChange={() => a.toggleTodo(tt.id)}
              />
              <div
                className={[
                  "flex-1 text-sm",
                  tt.done ? `${t.mutedText} line-through` : "",
                ].join(" ")}
              >
                {tt.text}
              </div>
              <button
                className={btns.btnGhost}
                onClick={() => a.deleteTodo(tt.id)}
                type="button"
              >
                ✕
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function GoalsPanel({
  a,
  full,
  t,
  btns,
  openFull,
}: {
  a: AppState;
  full: boolean;
  t: ThemeTokens;
  btns: Btns;
  openFull: (panel: Panel) => void;
}) {
  return (
    <div
      className={[
        "h-full rounded-2xl border p-4 shadow-sm",
        t.cardBg,
        t.cardBorder,
      ].join(" ")}
    >
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold">Long-term goals</div>
        {!full && (
          <button
            className={btns.btnGhost}
            type="button"
            onClick={() => openFull("goals")}
          >
            Open
          </button>
        )}
      </div>

      <div className="mt-3 flex gap-2">
        <input
          value={a.goalDraft}
          onChange={(e) => a.setGoalDraft(e.target.value)}
          placeholder="Add a goal…"
          className={[
            "w-full rounded-xl border px-3 py-2 text-sm outline-none transition-colors",
            t.inputBg,
            t.inputBorder,
            t.inputFocus,
          ].join(" ")}
        />
        <button className={btns.btnPrimary} onClick={a.addGoal} type="button">
          Add
        </button>
      </div>

      <div className="mt-4 space-y-2">
        {a.goals.length === 0 ? (
          <div
            className={[
              "rounded-xl border border-dashed p-4 text-sm",
              t.cardBorder,
              t.mutedText,
            ].join(" ")}
          >
            No goals yet.
          </div>
        ) : (
          a.goals.map((g) => (
            <div
              key={g.id}
              className={[
                "flex items-center gap-2 rounded-xl border px-3 py-2",
                t.cardBorder,
              ].join(" ")}
            >
              <div className="flex-1 text-sm">{g.text}</div>
              <button
                className={btns.btnGhost}
                onClick={() => a.deleteGoal(g.id)}
                type="button"
              >
                ✕
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

const ECHO_PROMPTS = [
  "What patterns do you notice in my journal?",
  "How am I doing on my long-term goals?",
  "Summarize how my week has gone.",
  "What should I focus on today?",
];

function EchoPanel({
  a,
  t,
  btns,
  olive,
  isDark,
}: {
  a: AppState;
  t: ThemeTokens;
  btns: Btns;
  olive: OliveTokens;
  isDark: boolean;
}) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const busy = a.aiStatus !== "idle";

  // Keep the latest message in view as it streams in.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [a.messages, a.aiStatus]);

  const lastMsg = a.messages[a.messages.length - 1];
  const waitingForFirstToken =
    a.aiStatus === "generating" &&
    lastMsg?.role === "assistant" &&
    lastMsg.content === "";

  return (
    <div
      className={[
        "flex h-[calc(100vh-48px)] flex-col rounded-2xl border p-6 shadow-sm",
        t.cardBg,
        t.cardBorder,
      ].join(" ")}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div
            className={[
              "text-xs font-semibold uppercase tracking-wide",
              t.mutedText,
            ].join(" ")}
          >
            Echo
          </div>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">
            Talk it through
          </h1>
          <div className={["mt-1 text-sm", t.mutedText].join(" ")}>
            A companion that reads your journal, todos, and goals to help you
            reflect.
          </div>
        </div>
        {a.messages.length > 0 && (
          <button className={btns.btnGhost} type="button" onClick={a.clearChat}>
            Clear
          </button>
        )}
      </div>

      {/* Backend selector */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        {(
          [
            { id: "cloud", label: "Gemini", hint: "Smarter, more natural" },
            {
              id: "local",
              label: "On-device",
              hint: "Fully private — nothing leaves your device",
            },
          ] as const
        ).map((b) => {
          const active = a.ui.aiBackend === b.id;
          return (
            <button
              key={b.id}
              type="button"
              disabled={busy}
              onClick={() => a.setAiBackend(b.id)}
              title={b.hint}
              className={[
                btns.btnGhost,
                "text-xs",
                active
                  ? `${olive.softBg} ${olive.softText} ring-1 ring-inset ${olive.softBorder}`
                  : "",
              ].join(" ")}
            >
              {b.label}
            </button>
          );
        })}

        {/* On-device model size picker */}
        {a.ui.aiBackend === "local" &&
          ECHO_MODELS.map((m) => {
            const active = a.selectedModel === m.id;
            return (
              <button
                key={m.id}
                type="button"
                disabled={busy}
                onClick={() => a.setSelectedModel(m.id)}
                title={`${m.blurb} (${m.size})`}
                className={[
                  btns.btnGhost,
                  "text-xs",
                  active
                    ? `${olive.softBg} ${olive.softText} ring-1 ring-inset ${olive.softBorder}`
                    : "",
                ].join(" ")}
              >
                {m.label} · {m.size}
              </button>
            );
          })}
      </div>

      {/* Privacy note */}
      <div className={["mt-2 text-xs", t.mutedText].join(" ")}>
        {a.ui.aiBackend === "cloud"
          ? "Your entries live only in this browser. When you ask, the relevant text is sent to Google’s Gemini to write a reply."
          : "Runs entirely on your device — your writing never leaves this browser. First message downloads the model once."}
      </div>

      {a.ui.aiBackend === "local" && !a.webgpuAvailable && (
        <div className="mt-4 rounded-xl border border-amber-400/50 bg-amber-50/60 px-4 py-3 text-sm text-amber-900 dark:bg-amber-900/20 dark:text-amber-200">
          Your browser can’t run the on-device model — it needs WebGPU. Try the
          latest Chrome or Edge on a desktop, or switch to Gemini.
        </div>
      )}

      {/* Model download progress (on-device only) */}
      {a.aiStatus === "loading" && a.modelProgress && (
        <div className="mt-4">
          <div className={["text-xs", t.mutedText].join(" ")}>
            {a.modelProgress.text || "Preparing Echo…"}
          </div>
          <div
            className={[
              "mt-2 h-1.5 w-full overflow-hidden rounded-full",
              isDark ? "bg-[#1A231D]" : "bg-zinc-200",
            ].join(" ")}
          >
            <div
              className="h-full rounded-full bg-[#3E4C3A] transition-all duration-300"
              style={{
                width: `${Math.round((a.modelProgress.progress || 0) * 100)}%`,
              }}
            />
          </div>
        </div>
      )}

      {/* Messages */}
      <div
        ref={scrollRef}
        className="mt-4 flex-1 space-y-4 overflow-y-auto pr-1"
      >
        {a.messages.length === 0 ? (
          <div className="flex h-full flex-col items-start justify-center gap-4">
            <div className={["max-w-md text-sm leading-6", t.mutedText].join(" ")}>
              Hi — I’m Echo. Ask me anything about what you’ve been writing, or
              start with one of these:
            </div>
            <div className="flex flex-wrap gap-2">
              {ECHO_PROMPTS.map((p) => (
                <button
                  key={p}
                  type="button"
                  className={[
                    btns.btnSecondary,
                    "text-xs font-normal",
                  ].join(" ")}
                  onClick={() => a.setChatDraft(p)}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        ) : (
          a.messages.map((m) => {
            const isUser = m.role === "user";
            return (
              <div
                key={m.id}
                className={["flex", isUser ? "justify-end" : "justify-start"].join(
                  " "
                )}
              >
                <div
                  className={[
                    "max-w-[80%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm leading-6",
                    isUser
                      ? `${olive.primary}`
                      : isDark
                      ? "bg-[#151C17] text-zinc-100 border border-[#26322A]"
                      : "bg-zinc-100 text-zinc-900",
                  ].join(" ")}
                >
                  {m.content ||
                    (waitingForFirstToken ? (
                      <span className={t.mutedText}>Echo is thinking…</span>
                    ) : (
                      ""
                    ))}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Composer */}
      <div className="mt-4 flex items-end gap-2">
        <textarea
          value={a.chatDraft}
          onChange={(e) => a.setChatDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              a.sendEcho();
            }
          }}
          rows={2}
          placeholder={
            busy ? "Echo is responding…" : "Ask Echo about your journal…"
          }
          disabled={busy}
          className={[
            "max-h-40 min-h-[44px] flex-1 resize-none rounded-xl border px-3 py-2 text-sm outline-none transition-colors disabled:opacity-60",
            t.inputBg,
            t.inputBorder,
            t.inputFocus,
          ].join(" ")}
        />
        <button
          className={btns.btnPrimary}
          type="button"
          onClick={a.sendEcho}
          disabled={busy || !a.chatDraft.trim()}
        >
          {a.aiStatus === "loading"
            ? "Loading…"
            : a.aiStatus === "generating"
            ? "…"
            : "Send"}
        </button>
      </div>
    </div>
  );
}

function Welcome({
  t,
  btns,
  olive,
  isDark,
  onStart,
  onToggleTheme,
}: {
  t: ThemeTokens;
  btns: Btns;
  olive: OliveTokens;
  isDark: boolean;
  onStart: () => void;
  onToggleTheme: () => void;
}) {
  const features = [
    {
      title: "Journal",
      desc: "Write freely. Every entry is saved and searchable.",
    },
    {
      title: "To-dos",
      desc: "Keep the day’s tasks right beside your writing.",
    },
    {
      title: "Goals",
      desc: "Track the longer-term things you’re working toward.",
    },
    {
      title: "Echo",
      desc: "An AI that reads your journal and helps you reflect.",
    },
  ];

  return (
    <div
      className={[
        "relative flex min-h-screen items-center justify-center p-6",
        t.pageBg,
        t.text,
      ].join(" ")}
    >
      <button
        type="button"
        onClick={onToggleTheme}
        className={[btns.btnSecondary, "absolute right-6 top-6"].join(" ")}
      >
        {isDark ? "Light" : "Dark"}
      </button>

      <div
        className={[
          "w-full max-w-xl rounded-3xl border p-8 shadow-sm",
          t.cardBg,
          t.cardBorder,
        ].join(" ")}
      >
        <div
          className={[
            "text-xs font-semibold uppercase tracking-wide",
            t.mutedText,
          ].join(" ")}
        >
          Your journal, reflected
        </div>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">
          Journal with Echo
        </h1>
        <p className={["mt-3 text-sm leading-6", t.mutedText].join(" ")}>
          A calm space to write, keep track of what matters, and think things
          through — with Echo, a companion that actually reads what you wrote.
        </p>

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {features.map((f) => (
            <div
              key={f.title}
              className={[
                "rounded-2xl border p-4",
                t.cardBorder,
                t.subtleBg,
              ].join(" ")}
            >
              <div className="text-sm font-semibold">{f.title}</div>
              <div className={["mt-1 text-xs leading-5", t.mutedText].join(" ")}>
                {f.desc}
              </div>
            </div>
          ))}
        </div>

        <div
          className={[
            "mt-6 rounded-xl border border-dashed p-3 text-xs leading-5",
            t.cardBorder,
            t.mutedText,
          ].join(" ")}
        >
          🔒 Everything stays in this browser — no accounts, no tracking. Your
          entries never leave your device unless you ask Echo a question.
        </div>

        <button
          type="button"
          onClick={onStart}
          className={[btns.btnPrimary, "mt-6 w-full"].join(" ")}
        >
          Start journaling →
        </button>
      </div>
    </div>
  );
}

export default function Home() {
  const a = useApp();

  // Dropdown open/close
  const [addOpen, setAddOpen] = useState(true);

  // Inline rename UI
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");

  const isDark = a.ui.theme === "dark";

  const t: ThemeTokens = {
    pageBg: isDark ? "bg-[#0A0E0B]" : "bg-[#F3F5EE]",
    text: isDark ? "text-zinc-100" : "text-zinc-900",
    cardBg: isDark ? "bg-[#0F1511]" : "bg-white",
    cardBorder: isDark ? "border-[#222B24]" : "border-zinc-200",
    subtleBg: isDark ? "bg-[#0C120E]" : "bg-zinc-50",
    subtleHover: isDark ? "hover:bg-[#121A15]" : "hover:bg-zinc-50",
    inputBg: isDark ? "bg-[#0B100D]" : "bg-white",
    inputBorder: isDark ? "border-[#2A332C]" : "border-zinc-200",
    inputFocus: isDark ? "focus:border-[#495A4D]" : "focus:border-zinc-300",
    mutedText: isDark ? "text-zinc-400" : "text-zinc-500",
  };

  const olive: OliveTokens = {
    primary: isDark
      ? "bg-[#3E4C3A] text-white hover:bg-[#465644]"
      : "bg-[#2F3A2A] text-white hover:bg-[#394634]",
    softBg: isDark ? "bg-[#141C16]" : "bg-[#EEF0EA]",
    softBorder: isDark ? "border-[#2A3A2F]" : "border-[#D7DDD0]",
    softText: isDark ? "text-[#CFE0CC]" : "text-[#2F3A2A]",
  };

  const btnBase =
    "inline-flex items-center justify-center rounded-xl px-3 py-2 text-sm font-semibold transition-all duration-150 active:scale-[0.97] disabled:opacity-60 disabled:pointer-events-none";

  const btns: Btns = {
    btnPrimary: btnBase + ` ${olive.primary} shadow-sm hover:shadow`,
    btnSecondary:
      btnBase +
      (isDark
        ? " bg-[#151C17] text-zinc-100 hover:bg-[#1A231D] border border-[#26322A]"
        : " bg-zinc-100 text-zinc-900 hover:bg-zinc-200") +
      " shadow-sm hover:shadow",
    btnGhost:
      btnBase +
      (isDark
        ? " bg-transparent text-zinc-300 hover:bg-[#131A15]"
        : " bg-transparent text-zinc-700 hover:bg-zinc-100"),
    btnDanger:
      btnBase + " bg-red-600 text-white hover:bg-red-700 shadow-sm hover:shadow",
  };

  const showingDock = a.ui.dockTodo || a.ui.dockGoals;

  const headerTitle = useMemo(() => {
    if (a.ui.activeMain === "todo") return "To-do list";
    if (a.ui.activeMain === "goals") return "Long-term goals";
    if (a.ui.activeMain === "echo") return "Echo";
    if (a.mode === "new") return "New entry";
    if (a.mode === "edit") return "Editing";
    return "Entry";
  }, [a.ui.activeMain, a.mode]);

  function openFull(panel: Panel) {
    a.setMain(panel);
    a.pushToast(
      panel === "journal"
        ? "Journal view"
        : panel === "todo"
        ? "Todo page"
        : panel === "goals"
        ? "Goals page"
        : "Echo",
      "info"
    );
  }

  function navBtn(panel: Panel) {
    const active = a.ui.activeMain === panel;
    return [
      btns.btnGhost,
      "w-full",
      active
        ? `${olive.softBg} ${olive.softText} ring-1 ring-inset ${olive.softBorder}`
        : "",
    ].join(" ");
  }

  // Avoid flashing the welcome screen before we've read localStorage.
  if (!a.hydrated) {
    return <div className={["min-h-screen", t.pageBg].join(" ")} />;
  }

  if (!a.welcomed) {
    return (
      <Welcome
        t={t}
        btns={btns}
        olive={olive}
        isDark={isDark}
        onStart={a.dismissWelcome}
        onToggleTheme={a.toggleTheme}
      />
    );
  }

  // ✅ FIX: no inline component <MainArea /> (prevents focus loss)
  const mainEl =
    a.ui.activeMain === "todo" ? (
      <TodoPanel a={a} full t={t} btns={btns} openFull={openFull} />
    ) : a.ui.activeMain === "goals" ? (
      <GoalsPanel a={a} full t={t} btns={btns} openFull={openFull} />
    ) : a.ui.activeMain === "echo" ? (
      <EchoPanel a={a} t={t} btns={btns} olive={olive} isDark={isDark} />
    ) : (
      <JournalMain
        a={a}
        headerTitle={headerTitle}
        t={t}
        isDark={isDark}
        btns={btns}
      />
    );

  return (
    <div className={["min-h-screen", t.pageBg, t.text].join(" ")}>
      <div className="mx-auto flex max-w-7xl gap-6 p-6">
        {/* Left sidebar */}
        <aside
          className={[
            "w-80 shrink-0 rounded-2xl border p-4 shadow-sm",
            t.cardBg,
            t.cardBorder,
          ].join(" ")}
        >
          {/* Top controls */}
          <div className="flex items-center justify-between gap-2">
            <div className="text-sm font-semibold tracking-tight">
              Journal with Echo
            </div>
            <div className="flex items-center gap-2">
              <button
                className={btns.btnSecondary}
                type="button"
                onClick={a.toggleTheme}
              >
                {isDark ? "Light" : "Dark"}
              </button>
              <button
                className={btns.btnPrimary}
                onClick={a.startNew}
                type="button"
              >
                New
              </button>
            </div>
          </div>

          {/* ALWAYS VISIBLE: Journal / Todo / Goals buttons */}
          <div
            className={[
              "mt-4 rounded-2xl border p-3",
              t.cardBorder,
              t.cardBg,
            ].join(" ")}
          >
            <div className="grid grid-cols-2 gap-2">
              <button
                className={navBtn("journal")}
                type="button"
                onClick={() => openFull("journal")}
              >
                Journal
              </button>
              <button
                className={navBtn("todo")}
                type="button"
                onClick={() => openFull("todo")}
              >
                Todo
              </button>
              <button
                className={navBtn("goals")}
                type="button"
                onClick={() => openFull("goals")}
              >
                Goals
              </button>
              <button
                className={navBtn("echo")}
                type="button"
                onClick={() => openFull("echo")}
              >
                Echo
              </button>
            </div>
          </div>

          {/* Dock dropdown */}
          <div
            className={[
              "mt-3 overflow-hidden rounded-2xl border",
              t.cardBorder,
              t.cardBg,
            ].join(" ")}
          >
            <button
              type="button"
              className={[
                "flex w-full items-center justify-between px-4 py-3 transition-colors",
                t.subtleHover,
              ].join(" ")}
              onClick={() => setAddOpen((v) => !v)}
            >
              <span
                className={[
                  "text-xs font-semibold uppercase tracking-wide",
                  t.mutedText,
                ].join(" ")}
              >
                Add to screen
              </span>
              <span className={["text-xs", t.mutedText].join(" ")}>
                {addOpen ? "▾" : "▸"}
              </span>
            </button>

            {addOpen && (
              <div
                className={["border-t p-3", t.cardBorder, t.subtleBg].join(" ")}
              >
                <div className="space-y-2">
                  <button
                    type="button"
                    className={[
                      btns.btnSecondary,
                      "w-full justify-between px-4",
                      a.ui.dockTodo
                        ? `${olive.softBg} ${olive.softText} ring-1 ring-inset ${olive.softBorder}`
                        : "",
                    ].join(" ")}
                    onClick={a.toggleDockTodo}
                  >
                    <span>To-do list</span>
                    <span
                      className={[
                        "ml-10 text-xs",
                        a.ui.dockTodo ? olive.softText : t.mutedText,
                      ].join(" ")}
                    >
                      {a.ui.dockTodo ? "On" : "Off"}
                    </span>
                  </button>

                  <button
                    type="button"
                    className={[
                      btns.btnSecondary,
                      "w-full justify-between px-4",
                      a.ui.dockGoals
                        ? `${olive.softBg} ${olive.softText} ring-1 ring-inset ${olive.softBorder}`
                        : "",
                    ].join(" ")}
                    onClick={a.toggleDockGoals}
                  >
                    <span>Long-term goals</span>
                    <span
                      className={[
                        "ml-10 text-xs",
                        a.ui.dockGoals ? olive.softText : t.mutedText,
                      ].join(" ")}
                    >
                      {a.ui.dockGoals ? "On" : "Off"}
                    </span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Search */}
          <div className="mt-4">
            <input
              value={a.query}
              onChange={(e) => a.setQuery(e.target.value)}
              placeholder="Search entries…"
              className={[
                "w-full rounded-xl border px-3 py-2 text-sm outline-none transition-colors",
                t.inputBg,
                t.inputBorder,
                t.inputFocus,
              ].join(" ")}
            />
          </div>

          {/* Entries list */}
          <div className="mt-4 space-y-2">
            {a.filteredEntries.length === 0 ? (
              <div
                className={[
                  "rounded-xl border border-dashed px-3 py-6 text-center text-sm",
                  t.cardBorder,
                  t.mutedText,
                ].join(" ")}
              >
                No entries yet.
              </div>
            ) : (
              a.filteredEntries.map((e) => {
                const isActive = a.activeId === e.id;
                const isRenaming = renamingId === e.id;

                return (
                  <div
                    key={e.id}
                    className={[
                      "rounded-xl border px-3 py-2 transition-colors",
                      t.cardBorder,
                      isActive
                        ? `${olive.softBg}`
                        : `${t.cardBg} ${t.subtleHover}`,
                    ].join(" ")}
                  >
                    <div className="flex items-start gap-2">
                      <button
                        type="button"
                        className="min-w-0 flex-1 text-left"
                        onClick={() => a.openEntry(e.id)}
                      >
                        {isRenaming ? (
                          <input
                            className={[
                              "w-full rounded-lg border px-2 py-1 text-sm outline-none",
                              t.inputBg,
                              t.inputBorder,
                              t.inputFocus,
                            ].join(" ")}
                            value={renameDraft}
                            onChange={(ev) => setRenameDraft(ev.target.value)}
                            onKeyDown={(ev) => {
                              if (ev.key === "Enter") {
                                a.renameEntry(e.id, renameDraft);
                                setRenamingId(null);
                              }
                              if (ev.key === "Escape") setRenamingId(null);
                            }}
                            autoFocus
                          />
                        ) : (
                          <div className="truncate text-sm font-semibold">
                            {e.title || "Untitled"}
                          </div>
                        )}

                        <div
                          className={[
                            "mt-0.5 truncate text-xs",
                            t.mutedText,
                          ].join(" ")}
                        >
                          {formatDate(e.updatedAt ?? e.createdAt)}
                        </div>
                      </button>

                      <div className="flex gap-1">
                        <button
                          type="button"
                          className={btns.btnGhost}
                          onClick={() => {
                            setRenamingId(e.id);
                            setRenameDraft(e.title);
                          }}
                        >
                          Rename
                        </button>
                        <button
                          type="button"
                          className={btns.btnGhost}
                          onClick={() => a.startEdit(e.id)}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className={btns.btnGhost}
                          onClick={() => a.deleteEntry(e.id)}
                        >
                          Del
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </aside>

        {/* Main + docked panels */}
        <div className="flex min-w-0 flex-1 gap-6">
          <div className="min-w-0 flex-1">{mainEl}</div>

          {showingDock && (
            <div className="w-[360px] shrink-0">
              {a.ui.dockTodo && a.ui.dockGoals ? (
                <div className="flex h-[calc(100vh-48px)] flex-col gap-6">
                  <div className="flex-1 min-h-0">
                    <TodoPanel
                      a={a}
                      full={false}
                      t={t}
                      btns={btns}
                      openFull={openFull}
                    />
                  </div>
                  <div className="flex-1 min-h-0">
                    <GoalsPanel
                      a={a}
                      full={false}
                      t={t}
                      btns={btns}
                      openFull={openFull}
                    />
                  </div>
                </div>
              ) : a.ui.dockTodo ? (
                <div className="h-[calc(100vh-48px)]">
                  <TodoPanel
                    a={a}
                    full={false}
                    t={t}
                    btns={btns}
                    openFull={openFull}
                  />
                </div>
              ) : (
                <div className="h-[calc(100vh-48px)]">
                  <GoalsPanel
                    a={a}
                    full={false}
                    t={t}
                    btns={btns}
                    openFull={openFull}
                  />
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Toast */}
      <div
        className={[
          "pointer-events-none fixed inset-x-0 bottom-4 z-50 flex justify-center px-4 transition-all duration-300",
          a.toast ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0",
        ].join(" ")}
      >
        <div
          className={[
            "pointer-events-auto w-full max-w-md rounded-2xl border px-4 py-3 shadow-lg",
            a.toast?.kind === "success"
              ? isDark
                ? "border-emerald-900/40 bg-emerald-900/20 text-emerald-200"
                : "border-emerald-200 bg-emerald-50 text-emerald-900"
              : a.toast?.kind === "error"
              ? isDark
                ? "border-red-900/40 bg-red-900/20 text-red-200"
                : "border-red-200 bg-red-50 text-red-900"
              : isDark
              ? "border-[#26322A] bg-[#0F1511] text-zinc-100"
              : "border-zinc-200 bg-white text-zinc-900",
          ].join(" ")}
          role="status"
          aria-live="polite"
        >
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm font-medium">{a.toast?.message ?? ""}</div>
            <button
              type="button"
              className={[
                "rounded-lg px-2 py-1 text-sm transition-colors",
                isDark
                  ? "text-zinc-300 hover:bg-[#131A15]"
                  : "text-zinc-700 hover:bg-zinc-100",
              ].join(" ")}
              onClick={a.clearToast}
            >
              ✕
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
