// Server-side proxy to Google's Gemini API.
//
// This keeps GEMINI_API_KEY out of the browser. The client sends the built
// system prompt + chat history; we forward it to Gemini and stream the reply
// back as plain text. Set GEMINI_API_KEY in .env.local (dev) and in the
// Netlify site environment variables (prod).

export const dynamic = "force-dynamic";

// Tried in order. 2.5-flash is the most natural; 2.0-flash is a sturdy fallback
// that's far less likely to be overloaded when 2.5 returns 503.
const MODELS = ["gemini-2.5-flash", "gemini-2.0-flash"];

// Statuses worth retrying: overloaded / rate-limited / transient server errors.
const RETRYABLE = new Set([429, 500, 503]);

type IncomingMessage = { role: "user" | "assistant"; content: string };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Get a streamable Gemini response, retrying each model on transient failures
// and falling back to the next model. Returns the ok Response, or the last
// failing one so the caller can surface a sensible message.
async function getGeminiStream(
  key: string,
  body: unknown
): Promise<Response> {
  let last: Response | null = null;
  for (const model of MODELS) {
    for (let attempt = 0; attempt < 2; attempt++) {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${key}`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok && res.body) return res;
      last = res;
      if (!RETRYABLE.has(res.status)) break; // non-transient: try next model
      await sleep(400 * (attempt + 1)); // brief backoff before retrying
    }
  }
  return last as Response;
}

export async function POST(req: Request) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    return new Response(
      "Echo isn’t configured yet — set GEMINI_API_KEY in your environment.",
      { status: 500 }
    );
  }

  let system = "";
  let history: IncomingMessage[] = [];
  try {
    const parsed = await req.json();
    system = typeof parsed?.system === "string" ? parsed.system : "";
    history = Array.isArray(parsed?.history) ? parsed.history : [];
  } catch {
    return new Response("Bad request.", { status: 400 });
  }

  const contents = history
    .filter((m) => m && typeof m.content === "string")
    .map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));

  const body = {
    systemInstruction: { parts: [{ text: system }] },
    contents,
    generationConfig: { temperature: 0.9, topP: 0.95 },
  };

  const upstream = await getGeminiStream(key, body);

  if (!upstream.ok || !upstream.body) {
    if (RETRYABLE.has(upstream.status)) {
      return new Response(
        "Gemini is busy right now — give it a few seconds and try again.",
        { status: 503 }
      );
    }
    const errText = await upstream.text().catch(() => "");
    return new Response(
      `Gemini error (${upstream.status}). ${errText.slice(0, 200)}`,
      { status: 502 }
    );
  }

  // Transform Gemini's SSE stream into a plain-text stream of token deltas.
  const reader = upstream.body.getReader();
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let buffer = "";

  const stream = new ReadableStream<Uint8Array>({
    async pull(controller) {
      const { done, value } = await reader.read();
      if (done) {
        controller.close();
        return;
      }
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data:")) continue;
        const data = trimmed.slice(5).trim();
        if (!data || data === "[DONE]") continue;
        try {
          const json = JSON.parse(data);
          const parts = json?.candidates?.[0]?.content?.parts ?? [];
          const text = parts
            .map((p: { text?: string }) => p.text ?? "")
            .join("");
          if (text) controller.enqueue(encoder.encode(text));
        } catch {
          // ignore partial / non-JSON keep-alive lines
        }
      }
    },
    cancel() {
      reader.cancel().catch(() => {});
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
