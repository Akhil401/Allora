"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Loader2,
  Volume2,
  Plus,
  Check,
  ArrowLeft,
  ArrowRight,
  MessageCircle,
  Eye,
  Sparkles,
  ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useSpeech } from "@/presentation/hooks/use-speech";
import { ORDERED_LESSON_IDS } from "@/presentation/data/curriculum";
import { nextLessonId } from "@/core/application/use-cases/learn";
import type { LessonContent } from "@/lib/validation/lesson";

interface Variant {
  variant: number;
  content: LessonContent;
}

export function LessonView({
  lessonId,
  title,
  objective,
  level,
}: {
  lessonId: string;
  title: string;
  objective: string;
  level: string;
}) {
  const router = useRouter();
  const { speak } = useSpeech();
  const [variants, setVariants] = useState<Variant[]>([]);
  const [maxVariant, setMaxVariant] = useState(2);
  const [open, setOpen] = useState<Set<number>>(new Set([0]));
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [completed, setCompleted] = useState(false);
  const next = nextLessonId(ORDERED_LESSON_IDS, lessonId);
  const highest = variants.reduce((m, v) => Math.max(m, v.variant), -1);
  const canExtract = highest >= 0 && highest < maxVariant;

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    fetch(`/api/lessons/${lessonId}/content`)
      .then((r) => r.json())
      .then((d) => {
        if (!active) return;
        if (d.variants) {
          setVariants(d.variants);
          setMaxVariant(d.maxVariant ?? 2);
        } else setError(d.error?.message ?? "Could not load this lesson.");
      })
      .catch(() => active && setError("Could not load this lesson."))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [lessonId]);

  const extractMore = async () => {
    const wanted = highest + 1; // next version after what's currently shown
    if (wanted < 1 || wanted > maxVariant) return;
    setGenerating(true);
    try {
      const res = await fetch(`/api/lessons/${lessonId}/content`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ variant: wanted }),
      });
      const d = await res.json();
      if (d.variant) {
        setVariants((prev) => [...prev, d.variant]);
        setOpen((prev) => new Set(prev).add(d.variant.variant)); // expand the new one
      }
    } finally {
      setGenerating(false);
    }
  };

  const toggle = (v: number) =>
    setOpen((prev) => {
      const s = new Set(prev);
      if (s.has(v)) s.delete(v);
      else s.add(v);
      return s;
    });

  const markComplete = async () => {
    await fetch(`/api/lessons/${lessonId}/complete`, { method: "POST" }).catch(() => {});
    setCompleted(true);
  };

  const saveWord = async (it: string, en: string) => {
    await fetch("/api/vocabulary", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ termIt: it, termEn: en }),
    }).catch(() => {});
  };

  const practiceInChat = async () => {
    const res = await fetch("/api/conversations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: `Pratica: ${title}` }),
    });
    const d = await res.json();
    if (d.conversation?.id) router.push(`/conversations/${d.conversation.id}`);
  };

  return (
    <div className="space-y-5 pb-8">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <Link
            href="/learn"
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to course
          </Link>
          <div className="flex items-center gap-2">
            <span className="rounded bg-primary/10 px-1.5 py-0.5 text-xs font-bold text-primary">
              {level}
            </span>
            <h1 className="text-xl font-bold">{title}</h1>
          </div>
          <p className="text-sm text-muted-foreground">{objective}</p>
        </div>

        {canExtract ? (
          <button
            onClick={extractMore}
            disabled={generating}
            title="Generate another AI version of this lesson"
            className="flex shrink-0 items-center gap-1.5 rounded-lg border border-primary/50 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/5 disabled:opacity-60"
          >
            {generating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            <span className="hidden sm:inline">Generate from AI</span>
            <span>
              {highest + 1}/{maxVariant}
            </span>
          </button>
        ) : null}
      </div>

      {loading ? (
        <div className="flex flex-col items-center gap-2 py-16 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
          <p className="text-xs">Preparing your lesson…</p>
        </div>
      ) : error ? (
        <div className="space-y-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm">
          <p className="text-destructive">{error}</p>
          <button
            onClick={() => location.reload()}
            className="rounded-lg border px-3 py-1.5 text-sm hover:bg-muted"
          >
            Try again
          </button>
        </div>
      ) : (
        <>
          {variants.length === 1 && variants[0] ? (
            // Only the original exists → show it plainly, no collapsible wrapper.
            <section className="shadow-soft rounded-2xl border bg-card p-4">
              <LessonContentBody content={variants[0].content} onSpeak={speak} onSave={saveWord} />
            </section>
          ) : (
            // Multiple versions → collapsible tabs (Original + AI versions).
            variants.map((v) => (
              <section
                key={v.variant}
                className="shadow-soft overflow-hidden rounded-2xl border bg-card"
              >
                <button
                  onClick={() => toggle(v.variant)}
                  className="flex w-full items-center justify-between p-4 text-left transition-colors hover:bg-muted/40"
                >
                  <span className="flex items-center gap-2 font-semibold">
                    {v.variant > 0 ? <Sparkles className="h-4 w-4 text-primary" /> : null}
                    {v.variant === 0 ? "Original lesson" : `AI lesson ${v.variant}`}
                  </span>
                  <ChevronDown
                    className={cn(
                      "h-5 w-5 text-muted-foreground transition-transform duration-200",
                      open.has(v.variant) && "rotate-180",
                    )}
                  />
                </button>
                {open.has(v.variant) ? (
                  <div className="border-t p-4">
                    <LessonContentBody content={v.content} onSpeak={speak} onSave={saveWord} />
                  </div>
                ) : null}
              </section>
            ))
          )}

          {generating ? (
            <p className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Generating a new AI version…
            </p>
          ) : !canExtract && highest >= maxVariant ? (
            <p className="text-center text-xs text-muted-foreground">
              All {maxVariant} extra AI versions unlocked.
            </p>
          ) : null}

          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              onClick={practiceInChat}
              className="press flex flex-1 items-center justify-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors hover:bg-muted"
            >
              <MessageCircle className="h-4 w-4" /> Practice in chat
            </button>
            {completed ? (
              next ? (
                <Link
                  href={`/learn/${next}`}
                  className="press flex flex-1 items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
                >
                  Next lesson <ArrowRight className="h-4 w-4" />
                </Link>
              ) : (
                <Link
                  href="/learn"
                  className="press flex flex-1 items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
                >
                  <Check className="h-4 w-4" /> Course finished!
                </Link>
              )
            ) : (
              <button
                onClick={markComplete}
                className="press flex flex-1 items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
              >
                <Check className="h-4 w-4" /> Mark complete
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

/** Renders a single lesson version's content. */
function LessonContentBody({
  content,
  onSpeak,
  onSave,
}: {
  content: LessonContent;
  onSpeak: (t: string) => void;
  onSave: (it: string, en: string) => void;
}) {
  const [revealed, setRevealed] = useState<Set<number>>(new Set());

  return (
    <div className="space-y-4">
      {content.intro ? <p className="text-sm">{content.intro}</p> : null}

      <div>
        <h3 className="mb-1 text-xs font-semibold uppercase text-muted-foreground">Explanation</h3>
        <p className="whitespace-pre-line text-sm leading-relaxed">{content.explanation}</p>
      </div>

      {content.examples.length > 0 ? (
        <div>
          <h3 className="mb-1 text-xs font-semibold uppercase text-muted-foreground">Examples</h3>
          <ul className="space-y-2">
            {content.examples.map((ex, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <button
                  onClick={() => onSpeak(ex.it)}
                  aria-label="Listen"
                  className="mt-0.5 text-muted-foreground"
                >
                  <Volume2 className="h-4 w-4" />
                </button>
                <span>
                  <span className="font-medium">{ex.it}</span>
                  <span className="text-muted-foreground"> — {ex.en}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {content.keyPhrases.length > 0 ? (
        <div>
          <h3 className="mb-1 text-xs font-semibold uppercase text-muted-foreground">
            Key phrases
          </h3>
          <ul className="space-y-2">
            {content.keyPhrases.map((p, i) => (
              <li key={i} className="flex items-center gap-2 text-sm">
                <button
                  onClick={() => onSpeak(p.it)}
                  aria-label="Listen"
                  className="text-muted-foreground"
                >
                  <Volume2 className="h-4 w-4" />
                </button>
                <span className="flex-1">
                  <b>{p.it}</b> <span className="text-muted-foreground">— {p.en}</span>
                </span>
                <SaveWord onSave={() => onSave(p.it, p.en)} />
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {content.practice.length > 0 ? (
        <div>
          <h3 className="mb-1 text-xs font-semibold uppercase text-muted-foreground">Practice</h3>
          <ol className="space-y-3">
            {content.practice.map((p, i) => (
              <li key={i} className="text-sm">
                <p className="font-medium">
                  {i + 1}. {p.question}
                </p>
                {revealed.has(i) ? (
                  <p className="mt-1 text-primary">{p.answer}</p>
                ) : (
                  <button
                    onClick={() => setRevealed((prev) => new Set(prev).add(i))}
                    className="mt-1 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                  >
                    <Eye className="h-3.5 w-3.5" /> Show answer
                  </button>
                )}
              </li>
            ))}
          </ol>
        </div>
      ) : null}
    </div>
  );
}

function SaveWord({ onSave }: { onSave: () => void }) {
  const [saved, setSaved] = useState(false);
  return (
    <button
      onClick={() => {
        onSave();
        setSaved(true);
      }}
      disabled={saved}
      aria-label="Save to my vocabulary"
      className="text-muted-foreground hover:text-foreground disabled:opacity-50"
    >
      {saved ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
    </button>
  );
}
