"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, ChevronLeft, BookOpen } from "lucide-react";

interface Topic {
  topic: string;
  count: number;
}

/** Reading section: an AI-generated (cached) study guide per patente topic. */
export function PatenteTheory() {
  const [topics, setTopics] = useState<Topic[]>([]);
  const [loadingTopics, setLoadingTopics] = useState(true);
  const [topic, setTopic] = useState<string | null>(null);
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch("/api/patente/topics")
      .then((r) => r.json())
      .then((d) => setTopics(d.topics ?? []))
      .catch(() => {})
      .finally(() => setLoadingTopics(false));
  }, []);

  const open = useCallback(async (t: string) => {
    setTopic(t);
    setContent("");
    setLoading(true);
    try {
      const r = await fetch(`/api/patente/theory?topic=${encodeURIComponent(t)}`);
      const d = await r.json();
      setContent(d.content ?? "");
    } finally {
      setLoading(false);
    }
  }, []);

  if (!topic) {
    return (
      <div className="space-y-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Theory</h1>
          <p className="text-sm text-muted-foreground">Study guides for each exam topic.</p>
        </div>
        {loadingTopics ? (
          <div className="flex justify-center py-16 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : topics.length === 0 ? (
          <p className="rounded-2xl border bg-card p-6 text-center text-sm text-muted-foreground shadow-soft">
            No topics yet — run the import script first.
          </p>
        ) : (
          <div className="stagger grid gap-2 sm:grid-cols-2">
            {topics.map((t) => (
              <button
                key={t.topic}
                onClick={() => open(t.topic)}
                className="hover-lift flex items-center gap-3 rounded-xl border bg-card p-4 text-left shadow-soft"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <BookOpen className="h-5 w-5" />
                </span>
                <span className="text-sm font-medium">{t.topic}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <button
        onClick={() => setTopic(null)}
        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" /> All topics
      </button>
      <h1 className="text-xl font-bold tracking-tight">{topic}</h1>

      {loading ? (
        <div className="flex flex-col items-center gap-2 py-16 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
          <p className="text-xs">Preparing your study guide…</p>
        </div>
      ) : (
        <div className="space-y-3 rounded-2xl border bg-card p-5 text-sm leading-relaxed shadow-soft">
          {content
            .split(/\n{2,}/)
            .filter(Boolean)
            .map((para, i) => (
              <p key={i} className="whitespace-pre-line">
                {para}
              </p>
            ))}
        </div>
      )}
    </div>
  );
}
