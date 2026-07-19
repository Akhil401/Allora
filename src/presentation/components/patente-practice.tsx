"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Check, X, Languages, ArrowRight, ChevronLeft, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";

interface Q {
  id: string;
  topic: string;
  textIt: string;
  correct: boolean;
  image: string | null;
}
interface Topic {
  topic: string;
  count: number;
}
interface Trans {
  translation: string;
  explanation: string;
}

/** Study by topic: one true/false statement at a time with instant feedback + translation. */
export function PatentePractice() {
  const [topics, setTopics] = useState<Topic[]>([]);
  const [loadingTopics, setLoadingTopics] = useState(true);
  const [topic, setTopic] = useState<string | null>(null);
  const [questions, setQuestions] = useState<Q[]>([]);
  const [loadingQ, setLoadingQ] = useState(false);
  const [index, setIndex] = useState(0);
  const [answer, setAnswer] = useState<boolean | null>(null);
  const [trans, setTrans] = useState<Trans | null>(null);
  const [translating, setTranslating] = useState(false);

  useEffect(() => {
    fetch("/api/patente/topics")
      .then((r) => r.json())
      .then((d) => setTopics(d.topics ?? []))
      .catch(() => {})
      .finally(() => setLoadingTopics(false));
  }, []);

  const loadTopic = useCallback(async (t: string) => {
    setTopic(t);
    setLoadingQ(true);
    setQuestions([]);
    setIndex(0);
    setAnswer(null);
    setTrans(null);
    try {
      const r = await fetch(`/api/patente/questions?topic=${encodeURIComponent(t)}&limit=20`);
      const d = await r.json();
      setQuestions(d.questions ?? []);
    } finally {
      setLoadingQ(false);
    }
  }, []);

  const q = questions[index];

  const choose = (chosen: boolean) => {
    if (answer !== null || !q) return;
    setAnswer(chosen);
    fetch("/api/patente/attempt", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        attempts: [{ questionId: q.id, topic: q.topic, kind: "practice", chosen, correct: chosen === q.correct }],
      }),
    }).catch(() => {});
  };

  const next = () => {
    setAnswer(null);
    setTrans(null);
    setIndex((i) => i + 1);
  };

  const translate = async () => {
    if (!q || trans || translating) return;
    setTranslating(true);
    try {
      const r = await fetch("/api/patente/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: q.textIt, correct: q.correct, questionId: q.id }),
      });
      setTrans(await r.json());
    } finally {
      setTranslating(false);
    }
  };

  // ── Topic picker ──
  if (!topic) {
    return (
      <div className="space-y-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Practice by topic</h1>
          <p className="text-sm text-muted-foreground">
            {topics.length > 0
              ? `${topics.reduce((s, t) => s + t.count, 0).toLocaleString()} questions in ${topics.length} topics.`
              : "Study the official statements one topic at a time."}
          </p>
        </div>
        {loadingTopics ? (
          <div className="flex justify-center py-16 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : topics.length === 0 ? (
          <div className="rounded-2xl border bg-card p-6 text-center text-sm text-muted-foreground shadow-soft">
            No questions loaded yet. Run the import script (<code>node scripts/import-patente.mjs</code>) after
            applying migration 0014.
          </div>
        ) : (
          <div className="stagger grid gap-2 sm:grid-cols-2">
            {topics.map((t) => (
              <button
                key={t.topic}
                onClick={() => loadTopic(t.topic)}
                className="hover-lift flex items-center justify-between rounded-xl border bg-card p-4 text-left shadow-soft"
              >
                <span className="text-sm font-medium">{t.topic}</span>
                <span className="text-xs text-muted-foreground">{t.count}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ── Quiz ──
  const done = !loadingQ && index >= questions.length && questions.length > 0;

  return (
    <div className="space-y-4">
      <button
        onClick={() => setTopic(null)}
        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" /> All topics
      </button>

      {loadingQ ? (
        <div className="flex justify-center py-16 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : done ? (
        <div className="space-y-3 rounded-2xl border bg-card p-8 text-center shadow-soft">
          <p className="text-3xl">✅</p>
          <p className="font-semibold">Topic set complete!</p>
          <button
            onClick={() => loadTopic(topic)}
            className="press mx-auto flex items-center gap-2 rounded-lg border px-4 py-2 text-sm hover:bg-muted"
          >
            <RotateCcw className="h-4 w-4" /> New set
          </button>
        </div>
      ) : q ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="truncate">{q.topic}</span>
            <span className="rounded-full bg-muted px-2 py-0.5 font-medium">
              {index + 1} / {questions.length}
            </span>
          </div>

          <div className="space-y-4 rounded-2xl border bg-card p-5 shadow-soft">
            {q.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={q.image} alt="Segnale" className="mx-auto max-h-40 rounded-lg object-contain" />
            ) : null}
            <p className="text-center text-base font-medium">{q.textIt}</p>

            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => choose(true)}
                disabled={answer !== null}
                className={cn(
                  "press rounded-xl border py-3 font-semibold transition-colors",
                  answer === null && "hover:bg-muted",
                  answer !== null && q.correct === true && "border-green-500 bg-green-500/10 text-green-700 dark:text-green-400",
                  answer === true && q.correct !== true && "border-destructive bg-destructive/10 text-destructive",
                )}
              >
                Vero
              </button>
              <button
                onClick={() => choose(false)}
                disabled={answer !== null}
                className={cn(
                  "press rounded-xl border py-3 font-semibold transition-colors",
                  answer === null && "hover:bg-muted",
                  answer !== null && q.correct === false && "border-green-500 bg-green-500/10 text-green-700 dark:text-green-400",
                  answer === false && q.correct !== false && "border-destructive bg-destructive/10 text-destructive",
                )}
              >
                Falso
              </button>
            </div>

            {answer !== null ? (
              <div className="space-y-2">
                <p
                  className={cn(
                    "flex items-center justify-center gap-1.5 text-sm font-medium",
                    answer === q.correct ? "text-green-600 dark:text-green-400" : "text-destructive",
                  )}
                >
                  {answer === q.correct ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}
                  {answer === q.correct ? "Correct!" : `Wrong — the answer is ${q.correct ? "Vero" : "Falso"}`}
                </p>

                <button
                  onClick={translate}
                  className="mx-auto flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
                >
                  {translating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Languages className="h-3.5 w-3.5" />}
                  Translate &amp; explain
                </button>
                {trans ? (
                  <div className="rounded-lg bg-muted p-3 text-xs">
                    <p className="italic">{trans.translation}</p>
                    {trans.explanation ? <p className="mt-1 text-muted-foreground">{trans.explanation}</p> : null}
                  </div>
                ) : null}

                <button
                  onClick={next}
                  className="press flex w-full items-center justify-center gap-2 rounded-lg bg-primary py-2.5 font-medium text-primary-foreground transition-opacity hover:opacity-90"
                >
                  Next <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            ) : null}
          </div>
        </div>
      ) : (
        <p className="py-10 text-center text-sm text-muted-foreground">No questions found for this topic.</p>
      )}
    </div>
  );
}
