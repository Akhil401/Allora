"use client";

import { useState } from "react";
import { Volume2, Languages, Loader2, Mic, GraduationCap } from "lucide-react";
import { cn } from "@/lib/utils";
import { CorrectionCard } from "./correction-card";
import type { ChatMessage } from "@/presentation/hooks/use-tutor-stream";

/** Format a timestamp like "11:29 PM, 10/11/25" (time, DD/MM/YY). */
function formatWhen(iso?: string): string {
  const d = iso ? new Date(iso) : new Date();
  // Deterministic time formatting (no locale) so server and client agree.
  const h = d.getHours();
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = ((h + 11) % 12) + 1;
  const time = `${h12}:${String(d.getMinutes()).padStart(2, "0")} ${ampm}`;

  // "Today" / "Yesterday" when applicable, else DD/MM/YY.
  const startOfDay = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const dayDiff = Math.round((startOfDay(new Date()) - startOfDay(d)) / 86_400_000);
  let day: string;
  if (dayDiff === 0) day = "Today";
  else if (dayDiff === 1) day = "Yesterday";
  else {
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const yy = String(d.getFullYear()).slice(-2);
    day = `${dd}/${mm}/${yy}`;
  }
  return `${time}, ${day}`;
}

function initialsOf(name?: string): string {
  if (!name) return "You";
  const parts = name.trim().split(/\s+/);
  const ini = (parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "");
  return ini.toUpperCase() || "You";
}

/** A chat message with avatar, name + timestamp, TTS + translate + correction. */
export function ChatBubble({
  message,
  onSpeak,
  userName,
}: {
  message: ChatMessage;
  onSpeak?: (text: string) => void;
  userName?: string;
}) {
  const isUser = message.role === "user";
  const [translation, setTranslation] = useState<string | null>(message.contentEn ?? null);
  const [translating, setTranslating] = useState(false);

  const translate = async () => {
    if (translation || translating || message.streaming) return;
    if (message.id.startsWith("local-")) return;
    setTranslating(true);
    try {
      const res = await fetch(`/api/messages/${message.id}/translate`, { method: "POST" });
      const data = await res.json();
      setTranslation(data.contentEn ?? null);
    } finally {
      setTranslating(false);
    }
  };

  const pron = message.pronunciationScore;
  const name = isUser ? userName || "You" : "Tutor";

  return (
    <div className={cn("animate-bubble-in flex gap-2", isUser ? "flex-row-reverse" : "flex-row")}>
      {/* Avatar */}
      <div className="shrink-0 pt-5">
        {isUser ? (
          <div className="shadow-soft flex h-8 w-8 items-center justify-center rounded-full bg-muted text-[11px] font-semibold text-foreground">
            {initialsOf(userName)}
          </div>
        ) : (
          <div className="shadow-soft flex h-8 w-8 items-center justify-center rounded-full bg-primary/15 text-primary">
            <GraduationCap className="h-4 w-4" />
          </div>
        )}
      </div>

      <div className={cn("flex max-w-[80%] flex-col gap-1", isUser ? "items-end" : "items-start")}>
        <span className="px-1 text-[10px] text-muted-foreground" suppressHydrationWarning>
          {name} · {formatWhen(message.createdAt)}
        </span>

        <div
          className={cn(
            "shadow-soft rounded-2xl px-4 py-2 text-sm",
            isUser
              ? "rounded-br-sm bg-primary text-primary-foreground"
              : "rounded-bl-sm bg-muted text-foreground",
          )}
        >
          {message.contentIt ||
            (message.streaming ? (
              <span className="flex items-center gap-1 py-1" aria-label="Tutor is typing">
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current opacity-60 [animation-delay:-0.3s]" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current opacity-60 [animation-delay:-0.15s]" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current opacity-60" />
              </span>
            ) : (
              ""
            ))}
        </div>

        {isUser && pron != null ? (
          <div
            className={cn(
              "flex items-center gap-1 px-1 text-[11px]",
              pron >= 80 ? "text-green-600" : pron >= 55 ? "text-amber-600" : "text-destructive",
            )}
          >
            <Mic className="h-3 w-3" /> Pronunciation ~{pron}%
          </div>
        ) : null}

        {!isUser && !message.streaming && message.contentIt ? (
          <div className="flex items-center gap-3 px-1 text-xs text-muted-foreground">
            <button
              onClick={() => onSpeak?.(message.contentIt)}
              className="flex items-center gap-1 hover:text-foreground"
            >
              <Volume2 className="h-3.5 w-3.5" /> Listen
            </button>
            <button onClick={translate} className="flex items-center gap-1 hover:text-foreground">
              {translating ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Languages className="h-3.5 w-3.5" />
              )}
              Translate
            </button>
          </div>
        ) : null}

        {translation ? (
          <p className="px-1 text-xs italic text-muted-foreground">{translation}</p>
        ) : null}

        {isUser && message.correction ? <CorrectionCard correction={message.correction} /> : null}
      </div>
    </div>
  );
}
