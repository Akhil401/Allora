"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Plus, MessageCircle, Loader2, Trash2 } from "lucide-react";
import type { ConversationSummary } from "@/core/application/ports/repositories";
import { cacheConversations, getCachedConversations } from "@/infrastructure/cache/offline-db";

interface Category {
  id: string;
  slug: string;
  titleEn: string;
  titleIt: string;
  isRoleplay: boolean;
}

/** Conversation list with a category-aware "new chat" action + offline cache. */
export function ConversationsList({ initial }: { initial: ConversationSummary[] }) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [items, setItems] = useState<ConversationSummary[]>(initial);
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryId, setCategoryId] = useState<string>("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const deleteChat = async (id: string, title: string) => {
    if (!window.confirm(`Delete "${title}"? It will be archived, not lost forever.`)) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/conversations/${id}`, { method: "DELETE" });
      if (res.ok) {
        setItems((prev) => {
          const next = prev.filter((c) => c.id !== id);
          void cacheConversations(next); // keep the offline cache in sync (no ghosts)
          return next;
        });
      }
    } finally {
      setDeletingId(null);
    }
  };

  useEffect(() => {
    // Online: the server `initial` is the source of truth — mirror it and cache it
    // (even when empty, which clears deleted ghosts). Only fall back to the cache
    // when actually offline and the server gave us nothing.
    const offline = typeof navigator !== "undefined" && navigator.onLine === false;
    if (offline && initial.length === 0) {
      void getCachedConversations().then((c) => c.length > 0 && setItems(c));
      return;
    }
    setItems(initial);
    void cacheConversations(initial);
  }, [initial]);

  useEffect(() => {
    fetch("/api/categories")
      .then((r) => r.json())
      .then((d) => setCategories(d.categories ?? []))
      .catch(() => setCategories([]));
  }, []);

  const newChat = async () => {
    setCreating(true);
    try {
      const chosen = categories.find((c) => c.id === categoryId);
      const res = await fetch("/api/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          categoryId: categoryId || null,
          title: chosen ? chosen.titleEn : undefined,
        }),
      });
      const data = await res.json();
      if (data.conversation?.id) router.push(`/conversations/${data.conversation.id}`);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold tracking-tight">Conversazioni</h1>

      <div className="shadow-soft flex flex-col gap-2 rounded-xl border bg-card p-3 sm:flex-row sm:items-center">
        <label htmlFor="cat" className="text-sm text-muted-foreground">
          Scenario
        </label>
        <select
          id="cat"
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          className="flex-1 rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="">Free talk (no scenario)</option>
          {categories
            .filter((c) => c.slug !== "free-talk")
            .map((c) => (
              <option key={c.id} value={c.id}>
                {c.titleEn} {c.isRoleplay ? "· roleplay" : ""}
              </option>
            ))}
        </select>
        <button
          onClick={newChat}
          disabled={creating}
          className="press flex items-center justify-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          New chat
        </button>
      </div>

      {items.length === 0 ? (
        <div className="animate-fade-in-up mt-14 flex flex-col items-center gap-3 text-center">
          <span className="shadow-soft flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <MessageCircle className="h-7 w-7" />
          </span>
          <p className="max-w-xs text-sm text-muted-foreground">
            No conversations yet. Pick a scenario and start!
          </p>
        </div>
      ) : (
        <ul className="stagger space-y-2">
          {items.map((c) => (
            <li key={c.id} className="flex items-center gap-1">
              <Link
                href={`/conversations/${c.id}`}
                className="hover-lift shadow-soft flex flex-1 items-center gap-3 overflow-hidden rounded-xl border bg-card p-3.5 text-card-foreground"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <MessageCircle className="h-5 w-5" />
                </span>
                <span className="flex-1 truncate text-sm font-medium">{c.title}</span>
                <span className="text-xs text-muted-foreground">
                  {new Date(c.updatedAt).toLocaleDateString()}
                </span>
              </Link>
              <button
                onClick={() => deleteChat(c.id, c.title)}
                disabled={deletingId === c.id}
                aria-label={`Delete ${c.title}`}
                className="press flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
              >
                {deletingId === c.id ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
