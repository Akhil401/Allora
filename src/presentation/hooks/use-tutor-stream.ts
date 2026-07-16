"use client";

import { useCallback, useRef, useState } from "react";
import type { CorrectionObject } from "@/lib/validation/correction";

export interface ChatMessage {
  id: string;
  role: "user" | "tutor";
  contentIt: string;
  contentEn?: string | null;
  correction?: CorrectionObject;
  pronunciationScore?: number;
  createdAt?: string;
  streaming?: boolean;
}

/**
 * Manages a live tutor conversation: sends a message, reads the SSE stream,
 * appends streaming tokens to a tutor bubble, and attaches the correction.
 * `onTutorDone` fires with the final reply text (used to trigger TTS).
 */
export function useTutorStream(
  conversationId: string,
  initial: ChatMessage[],
  onTutorDone?: (replyText: string) => void,
) {
  const [messages, setMessages] = useState<ChatMessage[]>(initial);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const counter = useRef(0);

  const send = useCallback(
    async (text: string, audioSource: "mic" | "text", pronunciationScore?: number) => {
      if (!text.trim() || sending) return;
      setError(null);
      setSending(true);

      const userId = `local-user-${counter.current++}`;
      const tutorId = `local-tutor-${counter.current++}`;
      const now = new Date().toISOString();
      setMessages((prev) => [
        ...prev,
        { id: userId, role: "user", contentIt: text, pronunciationScore, createdAt: now },
        { id: tutorId, role: "tutor", contentIt: "", streaming: true, createdAt: now },
      ]);

      try {
        const res = await fetch(`/api/conversations/${conversationId}/messages`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text, audioSource }),
        });
        if (!res.ok || !res.body) {
          const problem = await res.json().catch(() => null);
          throw new Error(problem?.error?.message ?? "Failed to reach the tutor.");
        }

        let replyText = "";
        for await (const evt of readSse(res.body)) {
          if (evt.event === "token") {
            replyText += evt.data.delta as string;
            setMessages((prev) =>
              prev.map((m) => (m.id === tutorId ? { ...m, contentIt: replyText } : m)),
            );
          } else if (evt.event === "correction") {
            const correction = evt.data as unknown as CorrectionObject;
            setMessages((prev) => prev.map((m) => (m.id === userId ? { ...m, correction } : m)));
          } else if (evt.event === "done") {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === tutorId
                  ? { ...m, id: (evt.data.messageId as string) ?? tutorId, streaming: false }
                  : m,
              ),
            );
            onTutorDone?.(replyText);
          } else if (evt.event === "error") {
            throw new Error((evt.data.message as string) ?? "Tutor error.");
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong.");
        setMessages((prev) => prev.filter((m) => m.id !== tutorId));
      } finally {
        setSending(false);
      }
    },
    [conversationId, sending, onTutorDone],
  );

  return { messages, sending, error, send };
}

/** Async iterator over SSE events from a fetch response body. */
async function* readSse(
  body: ReadableStream<Uint8Array>,
): AsyncGenerator<{ event: string; data: Record<string, unknown> }> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let idx: number;
      while ((idx = buffer.indexOf("\n\n")) !== -1) {
        const raw = buffer.slice(0, idx);
        buffer = buffer.slice(idx + 2);
        let event = "message";
        let data = "";
        for (const line of raw.split("\n")) {
          if (line.startsWith("event:")) event = line.slice(6).trim();
          else if (line.startsWith("data:")) data += line.slice(5).trim();
        }
        if (!data) continue;
        try {
          yield { event, data: JSON.parse(data) };
        } catch {
          /* ignore malformed event */
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}
