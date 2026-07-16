"use client";

import { useEffect, useRef } from "react";
import { GraduationCap } from "lucide-react";
import { useTutorStream, type ChatMessage } from "@/presentation/hooks/use-tutor-stream";
import { useSpeech } from "@/presentation/hooks/use-speech";
import { usePreferences } from "@/presentation/stores/preferences";
import { ChatBubble } from "./chat-bubble";
import { MessageComposer } from "./message-composer";
import { ConversationHeader } from "./conversation-header";

/** The live conversation screen: header + history + streaming tutor + composer. */
export function ChatScreen({
  conversationId,
  initialMessages,
  userName,
  title,
}: {
  conversationId: string;
  initialMessages: ChatMessage[];
  userName?: string;
  title: string;
}) {
  const { speak } = useSpeech();
  const voiceEnabled = usePreferences((s) => s.voiceEnabled);
  const bottomRef = useRef<HTMLDivElement>(null);

  const { messages, sending, error, send } = useTutorStream(
    conversationId,
    initialMessages,
    (replyText) => {
      if (voiceEnabled && replyText) speak(replyText);
    },
  );

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    // Extra bottom padding so the last message clears the fixed composer
    // (which sits above the mobile tab bar) and stays fully visible.
    <div className="flex flex-col gap-4 pb-40 md:pb-28">
      <ConversationHeader conversationId={conversationId} initialTitle={title} />

      {messages.length === 0 ? (
        <div className="animate-fade-in-up mt-16 flex flex-col items-center gap-3 text-center">
          <span className="shadow-soft flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <GraduationCap className="h-7 w-7" />
          </span>
          <p className="max-w-xs text-sm text-muted-foreground">
            Inizia a scrivere o parla in italiano. Il tuo tutor risponderà!
          </p>
        </div>
      ) : null}

      {messages.map((m) => (
        <ChatBubble key={m.id} message={m} onSpeak={speak} userName={userName} />
      ))}

      {error ? <p className="text-center text-xs text-destructive">{error}</p> : null}
      <div ref={bottomRef} />

      <MessageComposer disabled={sending} onSend={send} />
    </div>
  );
}
