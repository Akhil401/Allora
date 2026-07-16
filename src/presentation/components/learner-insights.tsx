"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Sparkles, Target, TrendingUp, GraduationCap, ArrowRight, Loader2 } from "lucide-react";

interface WeakGrammar {
  type: string;
  label: string;
  count: number;
}
interface Memory {
  weakGrammar: WeakGrammar[];
  masteredTopics: string[];
  favoriteTopics: string[];
  confidence: number;
  learningSpeed: "slow" | "normal" | "fast";
  stats: {
    lessonsCompleted: number;
    totalMistakes: number;
    reviewAccuracy: number;
    totalMessages: number;
  };
  summaryEn: string;
}
interface Rec {
  id: string;
  title: string;
  objective: string;
}

/**
 * V3 insights card: the learner's adaptive profile — confidence, pace, weak
 * spots — plus weakness-targeted lesson recommendations. Self-fetches /api/memory.
 */
export function LearnerInsights() {
  const [memory, setMemory] = useState<Memory | null>(null);
  const [recs, setRecs] = useState<Rec[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    fetch("/api/memory")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!active || !d) return;
        setMemory(d.memory ?? null);
        setRecs(d.recommendations ?? []);
      })
      .catch(() => {})
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  if (loading) {
    return (
      <div className="shadow-soft flex items-center gap-2 rounded-2xl border bg-card p-4 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Building your learning profile…
      </div>
    );
  }
  if (!memory) return null;

  const noData = memory.stats.totalMessages === 0 && memory.stats.lessonsCompleted === 0;
  const pct = Math.round(memory.confidence * 100);

  return (
    <div className="shadow-soft space-y-4 rounded-2xl border bg-card p-4">
      <div className="flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Sparkles className="h-4 w-4" />
        </span>
        <h2 className="font-semibold">Your focus</h2>
        <span className="ml-auto flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] capitalize text-muted-foreground">
          <TrendingUp className="h-3 w-3" /> {memory.learningSpeed} pace
        </span>
      </div>

      {noData ? (
        <p className="text-sm text-muted-foreground">
          Chat with your tutor and complete a lesson — your personalized focus and recommendations
          will appear here.
        </p>
      ) : (
        <>
          {/* Confidence */}
          <div>
            <div className="mb-1 flex items-baseline justify-between text-xs">
              <span className="text-muted-foreground">Confidence</span>
              <span className="font-semibold text-primary">{pct}%</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-gradient-to-r from-primary/80 to-primary transition-all duration-700 ease-out"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>

          {/* Weak spots */}
          {memory.weakGrammar.length > 0 ? (
            <div>
              <p className="mb-1.5 flex items-center gap-1 text-xs font-medium text-muted-foreground">
                <Target className="h-3.5 w-3.5" /> Work on these
              </p>
              <div className="flex flex-wrap gap-1.5">
                {memory.weakGrammar.map((w) => (
                  <span
                    key={w.type}
                    className="rounded-full bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-700 dark:text-amber-400"
                  >
                    {w.label} · {w.count}
                  </span>
                ))}
              </div>
            </div>
          ) : null}

          {/* Mastered */}
          {memory.masteredTopics.length > 0 ? (
            <div>
              <p className="mb-1.5 text-xs font-medium text-muted-foreground">Mastered</p>
              <div className="flex flex-wrap gap-1.5">
                {memory.masteredTopics.slice(0, 8).map((t) => (
                  <span
                    key={t}
                    className="rounded-full bg-green-500/10 px-2.5 py-1 text-xs font-medium text-green-700 dark:text-green-400"
                  >
                    {t}
                  </span>
                ))}
              </div>
            </div>
          ) : null}

          {/* Recommendations */}
          {recs.length > 0 ? (
            <div>
              <p className="mb-1.5 text-xs font-medium text-muted-foreground">Recommended next</p>
              <div className="space-y-1.5">
                {recs.map((r) => (
                  <Link
                    key={r.id}
                    href={`/learn/${r.id}`}
                    className="hover-lift group flex items-center gap-2 rounded-xl border bg-background p-2.5"
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <GraduationCap className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{r.title}</span>
                      <span className="block truncate text-[11px] text-muted-foreground">
                        {r.objective}
                      </span>
                    </span>
                    <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                  </Link>
                ))}
              </div>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
