"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ChevronDown,
  Lock,
  CheckCircle2,
  Circle,
  ShieldCheck,
  Sparkles,
  ArrowRight,
  GraduationCap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  CURRICULUM,
  ORDERED_LESSON_IDS,
  TOTAL_LESSONS,
  type Level,
} from "@/presentation/data/curriculum";
import { isLessonUnlocked, completedCount } from "@/core/application/use-cases/learn";

/** Browse the A1–C2 course. Admins get everything unlocked (no linear gating). */
interface Rec {
  id: string;
  title: string;
  objective: string;
}

export function LearnBrowser({ completed, isAdmin }: { completed: string[]; isAdmin?: boolean }) {
  const done = new Set(completed);
  const [openLevel, setOpenLevel] = useState<string>(CURRICULUM[0]?.level ?? "A1");
  const [openChapter, setOpenChapter] = useState<string | null>(null);
  const [recs, setRecs] = useState<Rec[]>([]);
  const total = TOTAL_LESSONS;
  const doneCount = completedCount(ORDERED_LESSON_IDS, done);
  const pct = Math.round((doneCount / total) * 100);

  useEffect(() => {
    let active = true;
    fetch("/api/memory")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => active && d && setRecs(d.recommendations ?? []))
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="space-y-4">
      {recs.length > 0 ? (
        <section className="shadow-soft animate-fade-in-up rounded-2xl border bg-card p-4">
          <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
            <Sparkles className="h-4 w-4 text-primary" /> Recommended for you
          </p>
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
        </section>
      ) : null}

      <div className="shadow-soft animate-fade-in-up rounded-2xl border bg-card p-4">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-bold tracking-tight">Learn Italian</h1>
          {isAdmin ? (
            <span className="flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
              <ShieldCheck className="h-3 w-3" /> Admin · all unlocked
            </span>
          ) : null}
        </div>
        <div className="mt-1 flex items-baseline justify-between">
          <p className="text-sm text-muted-foreground">
            {doneCount} of {total} lessons
          </p>
          <p className="text-sm font-semibold text-primary">{pct}%</p>
        </div>
        <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-gradient-to-r from-primary/80 to-primary transition-all duration-700 ease-out"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      <div className="stagger space-y-2">
        {CURRICULUM.map((level) => (
          <LevelCard
            key={level.level}
            level={level}
            done={done}
            isAdmin={!!isAdmin}
            open={openLevel === level.level}
            onToggle={() => setOpenLevel((v) => (v === level.level ? "" : level.level))}
            openChapter={openChapter}
            setOpenChapter={setOpenChapter}
          />
        ))}
      </div>
    </div>
  );
}

function LevelCard({
  level,
  done,
  isAdmin,
  open,
  onToggle,
  openChapter,
  setOpenChapter,
}: {
  level: Level;
  done: Set<string>;
  isAdmin: boolean;
  open: boolean;
  onToggle: () => void;
  openChapter: string | null;
  setOpenChapter: (id: string | null) => void;
}) {
  const lessonIds = level.chapters.flatMap((c) => c.lessons.map((l) => l.id));
  const levelDone = lessonIds.filter((id) => done.has(id)).length;

  const levelPct = Math.round((levelDone / Math.max(1, lessonIds.length)) * 100);

  return (
    <section
      className={cn(
        "overflow-hidden rounded-2xl border bg-card transition-shadow",
        open ? "shadow-soft" : "hover:shadow-soft",
      )}
    >
      <button onClick={onToggle} className="flex w-full items-center justify-between p-4 text-left">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-sm font-bold text-primary">
            {level.level}
          </span>
          <div>
            <p className="font-semibold">{level.title}</p>
            <p className="text-xs text-muted-foreground">
              {levelDone}/{lessonIds.length} done · {levelPct}%
            </p>
          </div>
        </div>
        <ChevronDown
          className={cn(
            "h-5 w-5 text-muted-foreground transition-transform duration-200",
            open && "rotate-180",
          )}
        />
      </button>

      {open ? (
        <div className="space-y-1 border-t p-3">
          {level.chapters.map((chapter) => {
            const chOpen = openChapter === chapter.id;
            return (
              <div key={chapter.id} className="rounded-lg">
                <button
                  onClick={() => setOpenChapter(chOpen ? null : chapter.id)}
                  className="flex w-full items-center justify-between rounded-lg px-2 py-2 text-left text-sm font-medium transition-colors hover:bg-muted"
                >
                  {chapter.title}
                  <ChevronDown
                    className={cn(
                      "h-4 w-4 text-muted-foreground transition-transform duration-200",
                      chOpen && "rotate-180",
                    )}
                  />
                </button>
                {chOpen ? (
                  <ul className="space-y-1 py-1">
                    {chapter.lessons.map((lesson) => {
                      const isDone = done.has(lesson.id);
                      const unlocked =
                        isAdmin || isLessonUnlocked(ORDERED_LESSON_IDS, done, lesson.id);
                      const inner = (
                        <div
                          className={cn(
                            "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                            unlocked ? "hover:bg-muted" : "opacity-60",
                          )}
                        >
                          {isDone ? (
                            <CheckCircle2 className="h-4 w-4 shrink-0 text-green-600" />
                          ) : unlocked ? (
                            <Circle className="h-4 w-4 shrink-0 text-muted-foreground" />
                          ) : (
                            <Lock className="h-4 w-4 shrink-0 text-muted-foreground" />
                          )}
                          <div className="flex-1">
                            <p className="font-medium">{lesson.title}</p>
                            <p className="text-xs text-muted-foreground">{lesson.objective}</p>
                          </div>
                        </div>
                      );
                      return (
                        <li key={lesson.id}>
                          {unlocked ? (
                            <Link href={`/learn/${lesson.id}`}>{inner}</Link>
                          ) : (
                            <div aria-disabled title="Complete the previous lesson first">
                              {inner}
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}
