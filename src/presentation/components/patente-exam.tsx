"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Clock, Check, X, Play, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface Q {
  id: string;
  topic: string;
  textIt: string;
  correct: boolean;
  image: string | null;
}

const EXAM_SECONDS = 20 * 60;
const MAX_ERRORS = 3;

/** Official-format exam: 30 statements, 20 minutes, pass with ≤3 errors. */
export function PatenteExam() {
  const [phase, setPhase] = useState<"idle" | "loading" | "running" | "done">("idle");
  const [questions, setQuestions] = useState<Q[]>([]);
  const [answers, setAnswers] = useState<Record<number, boolean>>({});
  const [index, setIndex] = useState(0);
  const [timeLeft, setTimeLeft] = useState(EXAM_SECONDS);
  const [errors, setErrors] = useState(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  // Refs mirror latest state so the timer's auto-submit reads current values
  // without re-creating the countdown on every answer.
  const questionsRef = useRef<Q[]>([]);
  const answersRef = useRef<Record<number, boolean>>({});
  useEffect(() => {
    questionsRef.current = questions;
  }, [questions]);
  useEffect(() => {
    answersRef.current = answers;
  }, [answers]);

  const submit = useCallback(() => {
    if (timer.current) clearInterval(timer.current);
    const qs = questionsRef.current;
    const ans = answersRef.current;
    let wrong = 0;
    const attempts = qs.map((q, i) => {
      const chosen = ans[i];
      const correct = chosen === q.correct;
      if (chosen === undefined || !correct) wrong += 1;
      return {
        questionId: q.id,
        topic: q.topic,
        kind: "exam" as const,
        chosen: chosen ?? false,
        correct: chosen === undefined ? false : correct,
      };
    });
    setErrors(wrong);
    fetch("/api/patente/attempt", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ attempts }),
    }).catch(() => {});
    setPhase("done");
  }, []);

  const start = async () => {
    setPhase("loading");
    try {
      const r = await fetch("/api/patente/exam");
      const d = await r.json();
      const qs: Q[] = d.questions ?? [];
      if (qs.length === 0) {
        setPhase("idle");
        return;
      }
      setQuestions(qs);
      setAnswers({});
      setIndex(0);
      setTimeLeft(EXAM_SECONDS);
      setPhase("running");
    } catch {
      setPhase("idle");
    }
  };

  // Countdown
  useEffect(() => {
    if (phase !== "running") return;
    timer.current = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          submit();
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [phase, submit]);

  const mm = String(Math.floor(timeLeft / 60)).padStart(2, "0");
  const ss = String(timeLeft % 60).padStart(2, "0");
  const answeredCount = Object.keys(answers).length;

  if (phase === "idle" || phase === "loading") {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-bold tracking-tight">Exam simulation</h1>
        <div className="space-y-4 rounded-2xl border bg-card p-6 text-center shadow-soft">
          <p className="text-sm text-muted-foreground">
            30 statements · 20 minutes · you pass with <b>at most {MAX_ERRORS} errors</b>, exactly like the real
            patente B theory exam.
          </p>
          <button
            onClick={start}
            disabled={phase === "loading"}
            className="press mx-auto flex items-center gap-2 rounded-full bg-primary px-6 py-3 font-medium text-primary-foreground shadow-soft transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {phase === "loading" ? <Loader2 className="h-5 w-5 animate-spin" /> : <Play className="h-5 w-5" />}
            Start exam
          </button>
        </div>
      </div>
    );
  }

  if (phase === "done") {
    const passed = errors <= MAX_ERRORS;
    const wrongList = questions
      .map((q, i) => ({ q, i, chosen: answers[i] }))
      .filter(({ q, chosen }) => chosen === undefined || chosen !== q.correct);
    return (
      <div className="space-y-4">
        <div
          className={cn(
            "rounded-2xl border p-6 text-center shadow-soft",
            passed ? "border-green-500/40 bg-green-500/10" : "border-destructive/40 bg-destructive/10",
          )}
        >
          <p className="text-4xl">{passed ? "🎉" : "😕"}</p>
          <p className="mt-2 text-lg font-bold">{passed ? "Passed!" : "Not this time"}</p>
          <p className="text-sm text-muted-foreground">
            {30 - errors}/30 correct · {errors} error{errors === 1 ? "" : "s"} (limit {MAX_ERRORS})
          </p>
          <button
            onClick={start}
            className="press mx-auto mt-4 flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
          >
            <Play className="h-4 w-4" /> New exam
          </button>
        </div>

        {wrongList.length > 0 ? (
          <div className="space-y-2">
            <h2 className="text-sm font-semibold">Review your mistakes</h2>
            {wrongList.map(({ q, i, chosen }) => (
              <div key={q.id} className="rounded-xl border bg-card p-3 text-sm shadow-soft">
                {q.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={q.image} alt="Segnale" className="mb-2 max-h-24 rounded object-contain" />
                ) : null}
                <p>{q.textIt}</p>
                <p className="mt-1 text-xs">
                  <span className="text-destructive">
                    Your answer: {chosen === undefined ? "—" : chosen ? "Vero" : "Falso"}
                  </span>{" "}
                  · <span className="text-green-600 dark:text-green-400">Correct: {q.correct ? "Vero" : "Falso"}</span>
                </p>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    );
  }

  // running
  const q = questions[index];
  return (
    <div className="space-y-4">
      <div className="sticky top-0 z-10 -mx-4 flex items-center justify-between border-b bg-background/85 px-4 py-2 backdrop-blur md:-mx-8 md:px-8">
        <span className="text-sm font-medium text-muted-foreground">
          {answeredCount}/30 answered
        </span>
        <span
          className={cn(
            "flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold",
            timeLeft < 120 ? "bg-destructive/10 text-destructive" : "bg-muted",
          )}
        >
          <Clock className="h-4 w-4" /> {mm}:{ss}
        </span>
      </div>

      {q ? (
        <div className="space-y-4 rounded-2xl border bg-card p-5 shadow-soft">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="truncate">{q.topic}</span>
            <span>{index + 1} / 30</span>
          </div>
          {q.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={q.image} alt="Segnale" className="mx-auto max-h-40 rounded-lg object-contain" />
          ) : null}
          <p className="text-center text-base font-medium">{q.textIt}</p>

          <div className="grid grid-cols-2 gap-3">
            {[true, false].map((v) => (
              <button
                key={String(v)}
                onClick={() => setAnswers((a) => ({ ...a, [index]: v }))}
                className={cn(
                  "press rounded-xl border py-3 font-semibold transition-colors",
                  answers[index] === v ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted",
                )}
              >
                {v ? "Vero" : "Falso"}
              </button>
            ))}
          </div>

          <div className="flex items-center justify-between">
            <button
              onClick={() => setIndex((i) => Math.max(0, i - 1))}
              disabled={index === 0}
              className="flex h-9 w-9 items-center justify-center rounded-full border disabled:opacity-40"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            {index < 29 ? (
              <button
                onClick={() => setIndex((i) => Math.min(29, i + 1))}
                className="press rounded-lg border px-4 py-2 text-sm hover:bg-muted"
              >
                Next
              </button>
            ) : (
              <button
                onClick={submit}
                className="press rounded-lg bg-primary px-5 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
              >
                Submit exam
              </button>
            )}
            <button
              onClick={() => setIndex((i) => Math.min(29, i + 1))}
              disabled={index >= 29}
              className="flex h-9 w-9 items-center justify-center rounded-full border disabled:opacity-40"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
        </div>
      ) : null}

      {/* Question grid + submit */}
      <div className="grid grid-cols-10 gap-1.5">
        {questions.map((_, i) => (
          <button
            key={i}
            onClick={() => setIndex(i)}
            className={cn(
              "flex h-8 items-center justify-center rounded-md border text-[11px] font-medium",
              i === index && "ring-2 ring-primary",
              answers[i] !== undefined ? "bg-primary/15 text-primary" : "text-muted-foreground",
            )}
          >
            {i + 1}
          </button>
        ))}
      </div>
      <button
        onClick={submit}
        className="press w-full rounded-lg border py-2.5 text-sm font-medium hover:bg-muted"
      >
        Submit exam now
      </button>
    </div>
  );
}
