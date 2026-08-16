// Echo — the on-device journaling companion.
//
// Everything here runs in the browser via WebLLM (WebGPU). No API keys, no
// network calls with the user's data: the model weights download once from a
// CDN and are cached locally, after which inference is fully offline.
//
// The heavy `@mlc-ai/web-llm` package is imported lazily (inside functions) so
// it never runs during server-side build/prerender, where `navigator.gpu`
// doesn't exist.

import type { Entry, TodoItem, GoalItem, ChatMessage } from "./types";
import {
  buildGeminiRequestBody,
  getModelHistory,
  readEchoTextStream,
} from "./echoTransport";

export type EchoModelId =
  | "Llama-3.2-1B-Instruct-q4f16_1-MLC"
  | "Llama-3.2-3B-Instruct-q4f16_1-MLC";

export type EchoModel = {
  id: EchoModelId;
  label: string;
  size: string;
  blurb: string;
};

export const ECHO_MODELS: EchoModel[] = [
  {
    id: "Llama-3.2-1B-Instruct-q4f16_1-MLC",
    label: "Fast",
    size: "~0.9 GB",
    blurb: "Quicker, lighter download. Great for most reflections.",
  },
  {
    id: "Llama-3.2-3B-Instruct-q4f16_1-MLC",
    label: "Smart",
    size: "~2.0 GB",
    blurb: "Slower and a larger download, but more thoughtful.",
  },
];

export const DEFAULT_MODEL: EchoModelId = "Llama-3.2-1B-Instruct-q4f16_1-MLC";

export type InitProgress = { progress: number; text: string };

export function isWebGPUAvailable(): boolean {
  return typeof navigator !== "undefined" && "gpu" in navigator;
}

// One engine instance per model id, cached for the life of the page so we only
// pay the load cost once.
let enginePromise: Promise<unknown> | null = null;
let currentModel: EchoModelId | null = null;

export async function getEngine(
  model: EchoModelId,
  onProgress?: (p: InitProgress) => void
): Promise<unknown> {
  if (enginePromise && currentModel === model) return enginePromise;
  currentModel = model;
  enginePromise = (async () => {
    const webllm = await import("@mlc-ai/web-llm");
    return webllm.CreateMLCEngine(model, {
      initProgressCallback: (r: { progress?: number; text?: string }) =>
        onProgress?.({ progress: r.progress ?? 0, text: r.text ?? "" }),
    });
  })();
  return enginePromise;
}

// ----------------------------------------------------------------------------
// Context building
// ----------------------------------------------------------------------------
// The journal can grow without bound, but the model's context window can't.
// We always include the (small) goals + to-dos, then pack journal entries
// newest-first until we hit a character budget. Anything that doesn't fit is
// listed as a title + date only, so Echo still knows it exists and can ask.

const DEFAULT_CHAR_BUDGET = 6000; // ~1.5k tokens of journal text

export function buildSystemPrompt(opts: {
  entries: Entry[];
  todos: TodoItem[];
  goals: GoalItem[];
  charBudget?: number;
}): string {
  const { entries, todos, goals } = opts;
  const budget = opts.charBudget ?? DEFAULT_CHAR_BUDGET;

  const goalsBlock = goals.length
    ? goals.map((g) => `- ${g.text}`).join("\n")
    : "(none yet)";

  const openTodos = todos.filter((t) => !t.done);
  const doneTodos = todos.filter((t) => t.done);
  const todoBlock =
    [
      openTodos.length
        ? "Still to do:\n" + openTodos.map((t) => `- ${t.text}`).join("\n")
        : "",
      doneTodos.length
        ? "Done:\n" + doneTodos.map((t) => `- ${t.text}`).join("\n")
        : "",
    ]
      .filter(Boolean)
      .join("\n") || "(none yet)";

  const sorted = [...entries].sort(
    (a, b) => (b.updatedAt ?? b.createdAt) - (a.updatedAt ?? a.createdAt)
  );

  const full: string[] = [];
  const condensed: string[] = [];
  let used = 0;
  for (const e of sorted) {
    const date = new Date(e.updatedAt ?? e.createdAt).toLocaleDateString();
    const block = `### ${e.title} (${date})\n${e.body}\n`;
    if (used + block.length <= budget) {
      full.push(block);
      used += block.length;
    } else {
      condensed.push(`- ${e.title} (${date})`);
    }
  }

  const journalBlock =
    (full.length ? full.join("\n") : "(no entries yet)") +
    (condensed.length
      ? `\n\nOlder entries (titles only — ask the user if you want the details):\n${condensed.join(
          "\n"
        )}`
      : "");

  return [
    "You are Echo. Think of yourself less as an assistant and more as a close, perceptive friend the user journals with — someone who actually remembers what they've written and talks to them like a person, not a chatbot.",
    "",
    "How to sound:",
    "- Talk like a real person texting a friend. Warm, casual, direct. Short.",
    "- Default to a sentence or two. Only go longer if they clearly want to dig in. Never dump bullet-point lists, headers, or 'here are 5 things' structure unasked.",
    "- Don't over-help or over-explain. Don't end every message with a question. Don't be relentlessly upbeat or motivational-poster. It's fine to just sit with something they said, or to gently push back.",
    "- React to the specific thing they wrote, by name. Reference real details from their entries. Notice patterns across days when they're there, but don't force it.",
    "- No therapy-speak, no clichés, no 'I'm just an AI' disclaimers. Swearing/casual tone is fine if it matches them.",
    "",
    "You can see their journal entries, to-do list, and long-term goals below. If something relevant only shows as a title, just ask them about it.",
    "",
    "## Long-term goals",
    goalsBlock,
    "",
    "## To-do list",
    todoBlock,
    "",
    "## Journal entries (newest first)",
    journalBlock,
  ].join("\n");
}

type MiniMessage = { role: "system" | "user" | "assistant"; content: string };

export async function streamEcho(opts: {
  engine: unknown;
  system: string;
  history: ChatMessage[];
  onToken: (full: string) => void;
}): Promise<string> {
  const trimmed = getModelHistory(opts.history);
  const messages: MiniMessage[] = [
    { role: "system", content: opts.system },
    ...trimmed.map((m) => ({ role: m.role, content: m.content })),
  ];

  // The engine shape comes from @mlc-ai/web-llm; typed loosely to avoid pulling
  // its types into the build.
  const engine = opts.engine as {
    chat: {
      completions: {
        create: (args: {
          messages: MiniMessage[];
          temperature?: number;
          stream?: boolean;
        }) => Promise<
          AsyncIterable<{
            choices: { delta: { content?: string } }[];
          }>
        >;
      };
    };
  };

  const chunks = await engine.chat.completions.create({
    messages,
    temperature: 0.7,
    stream: true,
  });

  let full = "";
  for await (const chunk of chunks) {
    const delta = chunk.choices?.[0]?.delta?.content ?? "";
    if (delta) {
      full += delta;
      opts.onToken(full);
    }
  }
  return full;
}

// ----------------------------------------------------------------------------
// Cloud backend (Gemini) — talks to our own /api/echo route, which holds the
// key server-side. Streams plain-text token deltas back.
// ----------------------------------------------------------------------------
export async function streamGemini(opts: {
  system: string;
  history: ChatMessage[];
  onToken: (full: string) => void;
}): Promise<string> {
  const body = buildGeminiRequestBody(opts.system, opts.history);
  const res = await fetch("/api/echo", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });

  if (!res.ok || !res.body) {
    const msg = await res.text().catch(() => "");
    throw new Error(msg || `Echo request failed (${res.status}).`);
  }

  return readEchoTextStream(res.body, opts.onToken);
}
