"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Pencil, Check, X, Loader2 } from "lucide-react";

/**
 * Header for an open conversation: back link + the chat name, which can be
 * renamed inline at any time (PATCH /api/conversations/:id). Sticky under the
 * app bar so it stays visible while scrolling the messages.
 */
export function ConversationHeader({
  conversationId,
  initialTitle,
}: {
  conversationId: string;
  initialTitle: string;
}) {
  const [title, setTitle] = useState(initialTitle || "Conversazione");
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(title);
  const [saving, setSaving] = useState(false);

  const startEdit = () => {
    setDraft(title);
    setEditing(true);
  };

  const save = async () => {
    const next = draft.trim();
    if (!next || next === title) {
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/conversations/${conversationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: next }),
      });
      if (res.ok) setTitle(next);
    } finally {
      setSaving(false);
      setEditing(false);
    }
  };

  return (
    <div className="sticky top-0 z-10 -mx-4 mb-4 flex items-center gap-2 border-b bg-background/85 px-4 py-3 backdrop-blur md:top-0 md:-mx-8 md:px-8">
      <Link
        href="/conversations"
        aria-label="Back to conversations"
        className="press flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        <ArrowLeft className="h-5 w-5" />
      </Link>

      {editing ? (
        <>
          <input
            autoFocus
            value={draft}
            maxLength={120}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") save();
              else if (e.key === "Escape") setEditing(false);
            }}
            className="min-w-0 flex-1 rounded-lg border bg-background px-2.5 py-1.5 text-sm font-semibold outline-none focus:ring-2 focus:ring-ring"
          />
          <button
            onClick={save}
            disabled={saving}
            aria-label="Save name"
            className="press flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-primary hover:bg-primary/10 disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-5 w-5" />}
          </button>
          <button
            onClick={() => setEditing(false)}
            aria-label="Cancel"
            className="press flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted"
          >
            <X className="h-5 w-5" />
          </button>
        </>
      ) : (
        <>
          <h1 className="min-w-0 flex-1 truncate text-base font-semibold" title={title}>
            {title}
          </h1>
          <button
            onClick={startEdit}
            aria-label="Rename conversation"
            className="press flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <Pencil className="h-4 w-4" />
          </button>
        </>
      )}
    </div>
  );
}
