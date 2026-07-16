/**
 * Parse a Server-Sent-Events stream (as used by OpenAI-compatible and Gemini
 * streaming endpoints) into successive JSON `data:` payloads. Yields the raw
 * string after "data: "; callers JSON.parse and interpret per provider.
 * Skips "[DONE]" sentinels and blank lines.
 */
export async function* parseSseJson(body: ReadableStream<Uint8Array>): AsyncGenerator<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      let idx: number;
      // SSE events are separated by a blank line.
      while ((idx = buffer.indexOf("\n\n")) !== -1) {
        const rawEvent = buffer.slice(0, idx);
        buffer = buffer.slice(idx + 2);
        for (const line of rawEvent.split("\n")) {
          const trimmed = line.trimStart();
          if (!trimmed.startsWith("data:")) continue;
          const data = trimmed.slice(5).trim();
          if (data === "" || data === "[DONE]") continue;
          yield data;
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}
