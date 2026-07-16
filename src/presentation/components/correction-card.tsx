"use client";

import { CheckCircle2, AlertCircle } from "lucide-react";
import type { CorrectionObject } from "@/lib/validation/correction";

/** Shows the tutor's grammar correction + English explanation under a user turn. */
export function CorrectionCard({ correction }: { correction: CorrectionObject }) {
  if (!correction.hasError) {
    return (
      <div className="flex max-w-[85%] items-center gap-2 rounded-lg border border-green-500/30 bg-green-500/10 px-3 py-1.5 text-xs text-green-700 dark:text-green-400">
        <CheckCircle2 className="h-3.5 w-3.5" /> Perfetto! No corrections.
      </div>
    );
  }

  return (
    <div className="max-w-[85%] space-y-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs">
      <div className="flex items-center gap-1.5 font-medium text-amber-700 dark:text-amber-400">
        <AlertCircle className="h-3.5 w-3.5" /> Correction
      </div>
      <p>
        <span className="text-muted-foreground line-through">{correction.originalText}</span>
        <br />
        <span className="font-medium text-foreground">{correction.correctedText}</span>
      </p>
      <p className="text-muted-foreground">{correction.explanationEn}</p>
      {correction.vocabulary.length > 0 ? (
        <div className="flex flex-wrap gap-1 pt-1">
          {correction.vocabulary.map((v, i) => (
            <span key={i} className="rounded bg-background px-1.5 py-0.5 text-[11px]">
              <b>{v.termIt}</b> — {v.termEn}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}
