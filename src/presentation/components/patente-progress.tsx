"use client";

import { useEffect, useState } from "react";
import { Loader2, Target, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface Progress {
  totals: { answered: number; correct: number; accuracy: number };
  perTopic: { topic: string; answered: number; correct: number; accuracy: number }[];
  recentMistakes: { textIt: string; topic: string; image: string | null }[];
}

export function PatenteProgress() {
  const [data, setData] = useState<Progress | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/patente/progress")
      .then((r) => (r.ok ? r.json() : null))
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center py-16 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }
  if (!data || data.totals.answered === 0) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-bold tracking-tight">Your progress</h1>
        <p className="rounded-2xl border bg-card p-6 text-center text-sm text-muted-foreground shadow-soft">
          No answers yet. Do some practice or an exam and your accuracy by topic will show up here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-bold tracking-tight">Your progress</h1>

      <div className="grid grid-cols-3 gap-3">
        <Stat label="Answered" value={String(data.totals.answered)} />
        <Stat label="Correct" value={String(data.totals.correct)} />
        <Stat label="Accuracy" value={`${data.totals.accuracy}%`} />
      </div>

      <div className="space-y-2">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold">
          <Target className="h-4 w-4" /> Accuracy by topic (weakest first)
        </h2>
        {data.perTopic.map((t) => (
          <div key={t.topic} className="rounded-xl border bg-card p-3 shadow-soft">
            <div className="mb-1 flex items-center justify-between text-xs">
              <span className="truncate font-medium">{t.topic}</span>
              <span className="text-muted-foreground">
                {t.correct}/{t.answered} · {t.accuracy}%
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className={cn(
                  "h-full rounded-full",
                  t.accuracy >= 90 ? "bg-green-500" : t.accuracy >= 70 ? "bg-amber-500" : "bg-destructive",
                )}
                style={{ width: `${t.accuracy}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      {data.recentMistakes.length > 0 ? (
        <div className="space-y-2">
          <h2 className="flex items-center gap-1.5 text-sm font-semibold">
            <X className="h-4 w-4" /> Recent mistakes
          </h2>
          {data.recentMistakes.map((m, i) => (
            <div key={i} className="rounded-xl border bg-card p-3 text-sm shadow-soft">
              <p>{m.textIt}</p>
              <p className="mt-1 text-[11px] text-muted-foreground">{m.topic}</p>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border bg-card p-4 text-center shadow-soft">
      <p className="text-2xl font-bold tracking-tight">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}
