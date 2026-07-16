"use client";

import { useEffect, useRef, useState } from "react";
import { Send } from "lucide-react";
import { useSpeech } from "@/presentation/hooks/use-speech";
import { MicButton } from "./mic-button";

/**
 * Message input with text + voice (Web Speech). While listening, interim
 * transcript fills the box. When a message came from the mic, the recognition
 * confidence is passed through as a lightweight pronunciation score.
 */
export function MessageComposer({
  disabled,
  onSend,
}: {
  disabled?: boolean;
  onSend: (text: string, source: "mic" | "text", pronunciationScore?: number) => void;
}) {
  const [text, setText] = useState("");
  const { listening, transcript, confidence, sttSupported, startListening, stopListening } =
    useSpeech();
  const usedMic = useRef(false);

  useEffect(() => {
    if (listening && transcript) setText(transcript);
  }, [listening, transcript]);

  const submit = () => {
    const value = text.trim();
    if (!value || disabled) return;
    const score = usedMic.current && confidence != null ? Math.round(confidence * 100) : undefined;
    onSend(value, usedMic.current ? "mic" : "text", score);
    setText("");
    usedMic.current = false;
  };

  return (
    <div className="fixed inset-x-0 bottom-14 z-10 border-t bg-background/95 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur sm:px-6 md:bottom-0 md:left-56 lg:px-10 xl:px-16 2xl:px-24">
      <div className="shadow-soft flex items-end gap-2 rounded-2xl border bg-background p-1.5 transition-shadow focus-within:ring-2 focus-within:ring-ring/60">
        {sttSupported ? (
          <MicButton
            listening={listening}
            onStart={() => {
              usedMic.current = true;
              startListening();
            }}
            onStop={stopListening}
          />
        ) : null}

        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          rows={1}
          placeholder={listening ? "Ascolto…" : "Scrivi in italiano…"}
          className="max-h-32 flex-1 resize-none bg-transparent px-2 py-2 text-sm outline-none"
        />

        <button
          type="button"
          onClick={submit}
          disabled={disabled || !text.trim()}
          aria-label="Send"
          className="press flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          <Send className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}
