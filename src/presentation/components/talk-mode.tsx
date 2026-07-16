"use client";

import { useEffect, useRef } from "react";
import {
  Mic,
  Play,
  Pause,
  Square,
  RotateCcw,
  GraduationCap,
  Loader2,
  Volume2,
  AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useTalkSession, type TalkStatus } from "@/presentation/hooks/use-talk-session";
import { CorrectionCard } from "./correction-card";

/**
 * Talk mode (V3): hands-free, memory-driven spoken lesson. The tutor asks
 * questions aloud (targeting the learner's weak spots), the learner answers by
 * voice, and corrections stream in as cards while the tutor speaks the feedback.
 */
export function TalkMode() {
  const { status, entries, interim, error, supported, start, pause, resume, stop, replay } =
    useTalkSession();
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [entries, interim]);

  const active = status === "speaking" || status === "listening" || status === "thinking";

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-bold tracking-tight">Talk with Maestro</h1>
        <p className="text-sm text-muted-foreground">
          A hands-free spoken lesson. Maestro asks, you answer out loud — he listens, corrects, and
          keeps going.
        </p>
      </div>

      {/* Orb + status */}
      <div className="shadow-soft flex flex-col items-center gap-4 rounded-2xl border bg-card p-8">
        <Orb status={status} />
        <div className="min-h-10 max-w-md text-center">
          <p className="text-sm font-medium">{statusLabel(status)}</p>
          {interim ? (
            <p className="mt-1 text-sm text-muted-foreground">
              {status === "listening" ? `“${interim}”` : interim}
            </p>
          ) : null}
          {status === "unsupported" ? (
            <p className="mt-1 text-xs text-muted-foreground">
              Voice needs Chrome on Android/desktop over HTTPS (or localhost).
            </p>
          ) : null}
          {error ? (
            <p className="mt-1 flex items-center justify-center gap-1 text-xs text-destructive">
              <AlertTriangle className="h-3.5 w-3.5" /> {error}
            </p>
          ) : null}
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2">
          {status === "idle" || status === "unsupported" ? (
            <button
              onClick={start}
              disabled={!supported}
              className="press shadow-soft flex items-center gap-2 rounded-full bg-primary px-6 py-3 font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              <Play className="h-5 w-5" /> Start talking
            </button>
          ) : status === "paused" || status === "error" ? (
            <>
              <button
                onClick={resume}
                className="press shadow-soft flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 font-medium text-primary-foreground transition-opacity hover:opacity-90"
              >
                <Mic className="h-4 w-4" /> Resume
              </button>
              <button
                onClick={stop}
                className="press flex items-center gap-2 rounded-full border px-5 py-2.5 font-medium transition-colors hover:bg-muted"
              >
                <Square className="h-4 w-4" /> End
              </button>
            </>
          ) : (
            <>
              <button
                onClick={replay}
                title="Repeat the last question"
                className="press flex h-11 w-11 items-center justify-center rounded-full border transition-colors hover:bg-muted"
              >
                <RotateCcw className="h-5 w-5" />
              </button>
              <button
                onClick={pause}
                className="press flex items-center gap-2 rounded-full border px-5 py-2.5 font-medium transition-colors hover:bg-muted"
              >
                <Pause className="h-4 w-4" /> Pause
              </button>
              <button
                onClick={stop}
                className="press flex items-center gap-2 rounded-full bg-destructive px-5 py-2.5 font-medium text-destructive-foreground transition-opacity hover:opacity-90"
              >
                <Square className="h-4 w-4" /> End
              </button>
            </>
          )}
        </div>
      </div>

      {/* Transcript */}
      {entries.length > 0 ? (
        <div className="space-y-4">
          {entries.map((e) => (
            <div
              key={e.id}
              className={cn(
                "animate-bubble-in flex gap-2",
                e.role === "user" ? "flex-row-reverse" : "flex-row",
              )}
            >
              <div className="shrink-0 pt-1">
                {e.role === "user" ? (
                  <div className="shadow-soft flex h-8 w-8 items-center justify-center rounded-full bg-muted text-[11px] font-semibold">
                    <Mic className="h-4 w-4" />
                  </div>
                ) : (
                  <div className="shadow-soft flex h-8 w-8 items-center justify-center rounded-full bg-primary/15 text-primary">
                    <GraduationCap className="h-4 w-4" />
                  </div>
                )}
              </div>
              <div
                className={cn(
                  "flex max-w-[80%] flex-col gap-1",
                  e.role === "user" ? "items-end" : "items-start",
                )}
              >
                <div
                  className={cn(
                    "shadow-soft rounded-2xl px-4 py-2 text-sm",
                    e.role === "user"
                      ? "rounded-br-sm bg-primary text-primary-foreground"
                      : "rounded-bl-sm bg-muted text-foreground",
                  )}
                >
                  {e.text}
                </div>
                {e.correction ? <CorrectionCard correction={e.correction} /> : null}
              </div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
      ) : !active && status !== "starting" ? (
        <div className="flex flex-col items-center gap-3 py-8 text-center text-sm text-muted-foreground">
          <span className="shadow-soft flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Volume2 className="h-6 w-6" />
          </span>
          <p className="max-w-xs">
            Put on your headphones and press <b>Start talking</b>. Maestro will greet you and ask
            the first question — just answer out loud.
          </p>
        </div>
      ) : null}
    </div>
  );
}

function Orb({ status }: { status: TalkStatus }) {
  const listening = status === "listening";
  const speaking = status === "speaking";
  const thinking = status === "thinking" || status === "starting";

  return (
    <div
      className={cn(
        "shadow-soft-lg flex h-28 w-28 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary/70 text-primary-foreground",
        listening && "orb-listen",
        speaking && "orb-speak",
        !listening && !speaking && !thinking && "orb-idle",
      )}
    >
      {thinking ? (
        <Loader2 className="h-10 w-10 animate-spin" />
      ) : listening ? (
        <Mic className="h-10 w-10" />
      ) : speaking ? (
        <Volume2 className="h-10 w-10" />
      ) : (
        <GraduationCap className="h-10 w-10" />
      )}
    </div>
  );
}

function statusLabel(status: TalkStatus): string {
  switch (status) {
    case "starting":
      return "Starting your lesson…";
    case "speaking":
      return "Maestro is speaking…";
    case "listening":
      return "Listening — answer out loud";
    case "thinking":
      return "Maestro is thinking…";
    case "paused":
      return "Paused";
    case "error":
      return "Something interrupted the session";
    case "unsupported":
      return "Voice isn’t supported on this browser";
    default:
      return "Ready when you are";
  }
}
