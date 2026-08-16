import assert from "node:assert/strict";
import {
  buildGeminiRequestBody,
  createGeminiSseDecoder,
  createUtf8StreamDecoder,
  failAssistantMessage,
  GEMINI_REQUEST_MAX_BYTES,
  getModelHistory,
  readEchoTextStream,
  requireEchoResponse,
} from "../app/lib/echoTransport.ts";

const utf8Bytes = (value) => new TextEncoder().encode(value).byteLength;

const baseHistory = [
  { id: "user", role: "user", content: "latest question" },
];

const asciiBody = buildGeminiRequestBody(
  "a".repeat(GEMINI_REQUEST_MAX_BYTES * 2),
  baseHistory
);
assert.equal(utf8Bytes(asciiBody), GEMINI_REQUEST_MAX_BYTES);
assert.doesNotThrow(() => JSON.parse(asciiBody));

const emojiBody = buildGeminiRequestBody(
  "🌍".repeat(GEMINI_REQUEST_MAX_BYTES),
  baseHistory
);
assert.ok(utf8Bytes(emojiBody) <= GEMINI_REQUEST_MAX_BYTES);
assert.ok(utf8Bytes(emojiBody) > GEMINI_REQUEST_MAX_BYTES - 4);
assert.doesNotThrow(() => JSON.parse(emojiBody));

const historyBody = buildGeminiRequestBody("system", [
  { id: "old", role: "assistant", content: "old ".repeat(30_000) },
  { id: "latest", role: "user", content: "界".repeat(30_000) },
]);
const boundedHistory = JSON.parse(historyBody).history;
assert.ok(utf8Bytes(historyBody) <= GEMINI_REQUEST_MAX_BYTES);
assert.equal(boundedHistory.at(-1).role, "user");
assert.ok(boundedHistory.at(-1).content.length > 0);
assert.ok(!boundedHistory.at(-1).content.includes("�"));

const zeroToken = failAssistantMessage(
  [
    ...baseHistory,
    {
      id: "assistant-zero",
      role: "assistant",
      content: "",
      delivery: "pending",
    },
  ],
  "assistant-zero",
  "transport failed"
);
assert.equal(getModelHistory(zeroToken).length, 1);
assert.throws(() => requireEchoResponse(""), /empty response/);
await assert.rejects(
  readEchoTextStream(
    new ReadableStream({
      start(controller) {
        controller.close();
      },
    }),
    () => {}
  ),
  /empty response/
);

const partial = failAssistantMessage(
  [
    ...baseHistory,
    {
      id: "assistant-partial",
      role: "assistant",
      content: "partial Gemini output",
      delivery: "pending",
    },
  ],
  "assistant-partial",
  "transport failed"
);
assert.equal(partial[1].content, "partial Gemini output");
assert.equal(getModelHistory(partial).length, 1);

const seenPartialTokens = [];
let pullCount = 0;
await assert.rejects(
  readEchoTextStream(
    new ReadableStream({
      pull(controller) {
        if (pullCount++ === 0) {
          controller.enqueue(new TextEncoder().encode("partial Gemini output"));
        } else {
          controller.error(new Error("transport failed"));
        }
      },
    }),
    (full) => seenPartialTokens.push(full)
  ),
  /transport failed/
);
assert.deepEqual(seenPartialTokens, ["partial Gemini output"]);

const event = `data: ${JSON.stringify({
  candidates: [{ content: { parts: [{ text: "final 🌍" }] } }],
})}`;
const encodedEvent = new TextEncoder().encode(event);
const emojiStart = encodedEvent.indexOf(0xf0);
assert.ok(emojiStart > 0);

const sse = createGeminiSseDecoder();
assert.equal(sse.push(encodedEvent.slice(0, emojiStart + 2)), "");
assert.equal(sse.push(encodedEvent.slice(emojiStart + 2)), "");
assert.equal(sse.finish(), "final 🌍");

const plainText = new TextEncoder().encode("plain EOF 🌍");
const plainEmojiStart = plainText.indexOf(0xf0);
const textDecoder = createUtf8StreamDecoder();
assert.equal(
  textDecoder.push(plainText.slice(0, plainEmojiStart + 2)),
  "plain EOF "
);
assert.equal(textDecoder.push(plainText.slice(plainEmojiStart + 2)), "🌍");
assert.equal(textDecoder.finish(), "");

console.log(
  "Echo verification passed: ASCII/multibyte request bounds, failed-history filtering, zero-token rejection, and fragmented text/SSE EOF flush."
);
