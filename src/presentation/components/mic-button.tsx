"use client";

import { Mic, MicOff } from "lucide-react";
import { cn } from "@/lib/utils";

/** Push-to-talk mic toggle. Hidden by the composer when STT is unsupported. */
export function MicButton({
  listening,
  onStart,
  onStop,
}: {
  listening: boolean;
  onStart: () => void;
  onStop: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={listening ? "Stop recording" : "Start recording"}
      onClick={listening ? onStop : onStart}
      className={cn(
        "press flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-colors",
        listening
          ? "animate-pulse bg-destructive text-destructive-foreground ring-4 ring-destructive/20"
          : "bg-muted text-foreground hover:bg-muted/70",
      )}
    >
      {listening ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
    </button>
  );
}
