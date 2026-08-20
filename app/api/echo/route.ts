// Server-side proxy to Google's Gemini API.
//
// This keeps GEMINI_API_KEY out of the browser. The client sends the built
// system prompt + chat history; we forward it to Gemini and stream the reply
// back as plain text. Set GEMINI_API_KEY in .env.local (dev) and in the
// Netlify site environment variables (prod).

import {
  createGeminiSseDecoder,
  GEMINI_REQUEST_MAX_BYTES,
} from "../../lib/echoTransport";

export const dynamic = "force-dynamic";

// Try Google's current stable Flash model first, with the previous stable
// release as a fallback for transient availability problems.
const MODELS = ["gemini-3.7-flash", "gemini-3.6-flash"];

// Statuses worth retrying: overloaded / rate-limited / transient server errors.
const RETRYABLE = new Set([429, 500, 503]);

type IncomingMessage = { role: "user" | "assistant"; content: string };
type RateLimitEntry = { count: number; resetAt: number };

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 10;
// Serverless instances do not share memory, so this is a burst guard for each
// warm instance rather than a durable, global quota.
const rateLimits = new Map<string, RateLimitEntry>();
let lastRateLimitCleanup = 0;

class BodyTooLargeError extends Error {}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function requestOriginIsAllowed(req: Request): boolean {
  const fetchSite = req.headers.get("sec-fetch-site");
  if (fetchSite && fetchSite !== "same-origin" && fetchSite !== "same-site") {
    return false;
  }

  const origin = req.headers.get("origin");
  if (!origin) return true;

  let normalizedOrigin: string;
  try {
    normalizedOrigin = new URL(origin).origin;
  } catch {
    return false;
  }

  return normalizedOrigin === new URL(req.url).origin;
}

function getClientId(req: Request): string {
  const netlifyIp = req.headers.get("x-nf-client-connection-ip")?.trim();
  if (netlifyIp) return netlifyIp;

  const forwardedIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  if (forwardedIp) return forwardedIp;

  return req.headers.get("x-real-ip")?.trim() || "unknown";
}

function takeRateLimitSlot(
  clientId: string,
  now = Date.now()
): { allowed: boolean; retryAfterSeconds: number } {
  if (now - lastRateLimitCleanup >= RATE_LIMIT_WINDOW_MS) {
    lastRateLimitCleanup = now;
    for (const [id, entry] of rateLimits) {
      if (entry.resetAt <= now) rateLimits.delete(id);
    }
  }

  const current = rateLimits.get(clientId);
  if (!current || current.resetAt <= now) {
    rateLimits.set(clientId, {
      count: 1,
      resetAt: now + RATE_LIMIT_WINDOW_MS,
    });
    return { allowed: true, retryAfterSeconds: 0 };
  }

  if (current.count >= RATE_LIMIT_MAX_REQUESTS) {
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((current.resetAt - now) / 1000)),
    };
  }

  current.count += 1;
  return { allowed: true, retryAfterSeconds: 0 };
}

async function parseJsonBody(req: Request): Promise<unknown> {
  const contentLength = req.headers.get("content-length");
  if (contentLength) {
    const declaredBytes = Number(contentLength);
    if (
      Number.isFinite(declaredBytes) &&
      declaredBytes > GEMINI_REQUEST_MAX_BYTES
    ) {
      throw new BodyTooLargeError();
    }
  }

  if (!req.body) throw new SyntaxError("Missing request body.");

  const reader = req.body.getReader();
  const decoder = new TextDecoder();
  let bytesRead = 0;
  let raw = "";

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;

    bytesRead += value.byteLength;
    if (bytesRead > GEMINI_REQUEST_MAX_BYTES) {
      await reader.cancel().catch(() => {});
      throw new BodyTooLargeError();
    }
    raw += decoder.decode(value, { stream: true });
  }

  raw += decoder.decode();
  return JSON.parse(raw) as unknown;
}

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
  if (!requestOriginIsAllowed(req)) {
    return new Response("Forbidden.", {
      status: 403,
      headers: { "Cache-Control": "no-store" },
    });
  }

  const rateLimit = takeRateLimitSlot(getClientId(req));
  if (!rateLimit.allowed) {
    return new Response("Too many Echo requests. Try again shortly.", {
      status: 429,
      headers: {
        "Cache-Control": "no-store",
        "Retry-After": String(rateLimit.retryAfterSeconds),
      },
    });
  }

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
    const parsed = (await parseJsonBody(req)) as {
      system?: unknown;
      history?: unknown;
    } | null;
    system = typeof parsed?.system === "string" ? parsed.system : "";
    history = Array.isArray(parsed?.history) ? parsed.history : [];
  } catch (error) {
    if (error instanceof BodyTooLargeError) {
      return new Response("Request body is too large.", { status: 413 });
    }
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
  const encoder = new TextEncoder();
  const sse = createGeminiSseDecoder();

  const stream = new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const { done, value } = await reader.read();
        if (done) {
          const tail = sse.finish();
          if (tail) controller.enqueue(encoder.encode(tail));
          controller.close();
          return;
        }
        const text = sse.push(value);
        if (text) controller.enqueue(encoder.encode(text));
      } catch (error) {
        controller.error(error);
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
