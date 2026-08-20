import type { ChatMessage } from "./types";

export const ECHO_MAX_HISTORY = 8;
export const GEMINI_REQUEST_MAX_BYTES = 64 * 1024;

type GeminiHistoryMessage = Pick<ChatMessage, "role" | "content">;
type GeminiRequestPayload = {
  system: string;
  history: GeminiHistoryMessage[];
};

const encoder = new TextEncoder();

export function getModelHistory(messages: ChatMessage[]): ChatMessage[] {
  return messages
    .filter(
      (message) =>
        message.delivery !== "pending" &&
        message.delivery !== "failed" &&
        message.content.length > 0
    )
    .slice(-ECHO_MAX_HISTORY);
}

export function completeAssistantMessage(
  messages: ChatMessage[],
  assistantId: string
): ChatMessage[] {
  return messages.map((message) =>
    message.id === assistantId
      ? { ...message, delivery: "complete" }
      : message
  );
}

export function failAssistantMessage(
  messages: ChatMessage[],
  assistantId: string,
  fallbackContent: string
): ChatMessage[] {
  return messages.map((message) =>
    message.id === assistantId
      ? {
          ...message,
          content: message.content || fallbackContent,
          delivery: "failed",
        }
      : message
  );
}

function serializeGeminiRequest(
  system: string,
  history: GeminiHistoryMessage[]
): string {
  return JSON.stringify({ system, history } satisfies GeminiRequestPayload);
}

function byteLength(value: string): number {
  return encoder.encode(value).byteLength;
}

function longestPrefixThatFits(
  value: string,
  fits: (candidate: string) => boolean
): string {
  const codePoints = Array.from(value);
  let low = 0;
  let high = codePoints.length;

  while (low < high) {
    const middle = Math.ceil((low + high) / 2);
    if (fits(codePoints.slice(0, middle).join(""))) {
      low = middle;
    } else {
      high = middle - 1;
    }
  }

  return codePoints.slice(0, low).join("");
}

export function buildGeminiRequestBody(
  system: string,
  messages: ChatMessage[],
  maxBytes = GEMINI_REQUEST_MAX_BYTES
): string {
  if (maxBytes < byteLength(serializeGeminiRequest("", []))) {
    throw new RangeError("Gemini request limit is too small for valid JSON.");
  }

  let history: GeminiHistoryMessage[] = getModelHistory(messages).map(
    ({ role, content }) => ({ role, content })
  );

  // Keep the newest turn. If chat history alone exceeds the limit, discard the
  // oldest turns first, then UTF-8-truncate the remaining newest message.
  while (
    history.length > 1 &&
    byteLength(serializeGeminiRequest("", history)) > maxBytes
  ) {
    history = history.slice(1);
  }

  if (
    history.length === 1 &&
    byteLength(serializeGeminiRequest("", history)) > maxBytes
  ) {
    const latest = history[0];
    const content = longestPrefixThatFits(latest.content, (candidate) =>
      byteLength(
        serializeGeminiRequest("", [{ ...latest, content: candidate }])
      ) <= maxBytes
    );
    history = [{ ...latest, content }];
  }

  const boundedSystem = longestPrefixThatFits(system, (candidate) =>
    byteLength(serializeGeminiRequest(candidate, history)) <= maxBytes
  );
  const body = serializeGeminiRequest(boundedSystem, history);

  if (byteLength(body) > maxBytes) {
    throw new RangeError("Unable to fit Gemini request within its byte limit.");
  }
  return body;
}

export function requireEchoResponse(value: string): string {
  if (!value) throw new Error("Echo returned an empty response. Please try again.");
  return value;
}

export function createUtf8StreamDecoder() {
  const decoder = new TextDecoder();
  return {
    push(chunk: Uint8Array): string {
      return decoder.decode(chunk, { stream: true });
    },
    finish(): string {
      return decoder.decode();
    },
  };
}

export async function readEchoTextStream(
  stream: ReadableStream<Uint8Array>,
  onToken: (full: string) => void
): Promise<string> {
  const reader = stream.getReader();
  const decoder = createUtf8StreamDecoder();
  let full = "";

  for (;;) {
    const { done, value } = await reader.read();
    if (done) {
      const tail = decoder.finish();
      if (tail) {
        full += tail;
        onToken(full);
      }
      break;
    }

    const text = decoder.push(value);
    if (text) {
      full += text;
      onToken(full);
    }
  }

  return requireEchoResponse(full);
}

function parseGeminiSseLine(line: string): string {
  const trimmed = line.trim();
  if (!trimmed.startsWith("data:")) return "";

  const data = trimmed.slice(5).trim();
  if (!data || data === "[DONE]") return "";

  try {
    const json = JSON.parse(data);
    const parts = json?.candidates?.[0]?.content?.parts ?? [];
    return parts
      .map((part: { text?: string }) => part.text ?? "")
      .join("");
  } catch {
    return "";
  }
}

export function createGeminiSseDecoder() {
  const decoder = createUtf8StreamDecoder();
  let buffer = "";

  function drain(final: boolean): string {
    const lines = buffer.split("\n");
    buffer = final ? "" : lines.pop() ?? "";
    return lines.map(parseGeminiSseLine).join("");
  }

  return {
    push(chunk: Uint8Array): string {
      buffer += decoder.push(chunk);
      return drain(false);
    },
    finish(): string {
      buffer += decoder.finish();
      return drain(true);
    },
  };
}
