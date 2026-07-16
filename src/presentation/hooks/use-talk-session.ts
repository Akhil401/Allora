"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { CorrectionObject } from "@/lib/validation/correction";
import { speakItalian } from "@/presentation/lib/tts";
import { usePreferences } from "@/presentation/stores/preferences";

/**
 * Hands-free Talk-mode session (V3). Drives the loop:
 *   tutor speaks (TTS) → mic auto-opens → learner answers → silence ends the turn
 *   → answer streamed to the tutor → correction + next spoken question → repeat.
 *
 * Self-contained (own SpeechRecognition + speechSynthesis) so the loop timing is
 * fully controlled. Talk turns hit the shared /messages endpoint with mode:"talk".
 */

export type TalkStatus =
  | "idle"
  | "starting"
  | "speaking" // tutor talking (TTS)
  | "listening" // mic open, learner talking
  | "thinking" // waiting for / streaming the tutor reply
  | "paused"
  | "error"
  | "unsupported";

export interface TalkEntry {
  id: string;
  role: "user" | "tutor";
  text: string;
  correction?: CorrectionObject;
}

export function useTalkSession() {
  const [status, setStatus] = useState<TalkStatus>("idle");
  const [entries, setEntries] = useState<TalkEntry[]>([]);
  const [interim, setInterim] = useState(""); // live partial (user speech or tutor stream)
  const [error, setError] = useState<string | null>(null);

  const convoId = useRef<string | null>(null);
  const recognition = useRef<SpeechRecognitionLike | null>(null);
  const finalTranscript = useRef("");
  const paused = useRef(false);
  const counter = useRef(0);
  const lastTutorText = useRef("");

  const supported =
    typeof window !== "undefined" &&
    Boolean(window.SpeechRecognition ?? window.webkitSpeechRecognition) &&
    "speechSynthesis" in window;

  const nextId = () => `talk-${counter.current++}`;

  /* ── Text-to-speech ─────────────────────────────────────────── */
  const speak = useCallback((text: string, onDone: () => void) => {
    const { voiceURI, speechRate } = usePreferences.getState();
    speakItalian(text, { voiceURI, rate: speechRate, onEnd: onDone });
  }, []);

  /* ── Speech-to-text (one utterance, ends on silence) ────────── */
  const listen = useCallback(() => {
    if (paused.current) return;
    const Ctor = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!Ctor) return;

    const rec = new Ctor();
    rec.lang = "it-IT";
    rec.continuous = false;
    rec.interimResults = true;
    finalTranscript.current = "";
    setInterim("");
    setStatus("listening");

    rec.onresult = (event) => {
      let live = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const r = event.results[i];
        if (!r) continue;
        if (r.isFinal) finalTranscript.current += r[0].transcript;
        else live += r[0].transcript;
      }
      setInterim((finalTranscript.current + " " + live).trim());
    };

    rec.onerror = (e: Event) => {
      const err = (e as unknown as { error?: string }).error;
      if (err === "not-allowed" || err === "service-not-allowed") {
        paused.current = true;
        setError("Microphone access was blocked. Allow the mic and press Resume.");
        setStatus("error");
      }
      // "no-speech" / "aborted" fall through to onend → we simply re-listen.
    };

    rec.onend = () => {
      if (paused.current) return;
      const said = finalTranscript.current.trim();
      if (said) void sendTurn(said);
      else listen(); // heard nothing — keep waiting
    };

    recognition.current = rec;
    try {
      rec.start();
    } catch {
      /* start can throw if called too soon; ignore */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const speakThenListen = useCallback(
    (text: string) => {
      lastTutorText.current = text;
      if (paused.current) return;
      setStatus("speaking");
      speak(text, () => {
        if (!paused.current) listen();
      });
    },
    [speak, listen],
  );

  /* ── One turn: stream a tutor reply, then speak + listen ────── */
  const sendTurn = useCallback(
    async (text: string, kickoff = false) => {
      if (!convoId.current) return;
      setStatus("thinking");
      setError(null);
      setInterim("");

      // Show the learner's answer immediately (correction attaches when it arrives).
      const userEntryId = nextId();
      if (!kickoff && text) {
        setEntries((prev) => [...prev, { id: userEntryId, role: "user", text }]);
      }

      try {
        const res = await fetch(`/api/conversations/${convoId.current}/messages`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text, mode: "talk", kickoff, audioSource: "mic" }),
        });
        if (!res.ok || !res.body) {
          const problem = await res.json().catch(() => null);
          throw new Error(problem?.error?.message ?? "The tutor could not respond.");
        }

        let reply = "";
        const tutorEntryId = nextId();
        for await (const evt of readSse(res.body)) {
          if (evt.event === "token") {
            reply += (evt.data.delta as string) ?? "";
            setInterim(reply);
          } else if (evt.event === "correction") {
            const correction = evt.data as unknown as CorrectionObject;
            setEntries((prev) =>
              prev.map((m) => (m.id === userEntryId ? { ...m, correction } : m)),
            );
          } else if (evt.event === "done") {
            setEntries((prev) => [...prev, { id: tutorEntryId, role: "tutor", text: reply }]);
            setInterim("");
            speakThenListen(reply);
          } else if (evt.event === "error") {
            throw new Error((evt.data.message as string) ?? "Tutor error.");
          }
        }
      } catch (err) {
        paused.current = true;
        setError(err instanceof Error ? err.message : "Something went wrong.");
        setStatus("error");
      }
    },
    [speakThenListen],
  );

  /* ── Public controls ────────────────────────────────────────── */
  const start = useCallback(async () => {
    if (!supported) {
      setStatus("unsupported");
      return;
    }
    paused.current = false;
    setError(null);
    setEntries([]);
    setStatus("starting");
    try {
      const res = await fetch("/api/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Talk session" }),
      });
      const data = await res.json();
      if (!data.conversation?.id) throw new Error("Could not start the session.");
      convoId.current = data.conversation.id;
      await sendTurn("", true); // kickoff: tutor greets + asks first question
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start the session.");
      setStatus("error");
    }
  }, [supported, sendTurn]);

  const pause = useCallback(() => {
    paused.current = true;
    if (typeof window !== "undefined") window.speechSynthesis?.cancel();
    recognition.current?.abort();
    setStatus("paused");
  }, []);

  const resume = useCallback(() => {
    if (!convoId.current) return;
    paused.current = false;
    setError(null);
    listen();
  }, [listen]);

  const stop = useCallback(() => {
    paused.current = true;
    if (typeof window !== "undefined") window.speechSynthesis?.cancel();
    recognition.current?.abort();
    setInterim("");
    setStatus("idle");
  }, []);

  const replay = useCallback(() => {
    if (lastTutorText.current) speakThenListen(lastTutorText.current);
  }, [speakThenListen]);

  // Cleanup on unmount.
  useEffect(() => {
    return () => {
      paused.current = true;
      if (typeof window !== "undefined") window.speechSynthesis?.cancel();
      recognition.current?.abort();
    };
  }, []);

  return { status, entries, interim, error, supported, start, pause, resume, stop, replay };
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
