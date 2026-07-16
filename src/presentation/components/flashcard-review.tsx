"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import {
  Loader2,
  Volume2,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  History as HistoryIcon,
  ChevronDown,
  List,
  LayoutGrid,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useSpeech } from "@/presentation/hooks/use-speech";

interface DueCard {
  id: string;
  termIt: string;
  termEn: string;
  partOfSpeech: string | null;
  fromMistake?: boolean;
}
interface ReviewLog {
  termIt: string;
  termEn: string;
  grade: string;
  reviewedAt: string;
}

const GRADES = [
  { grade: "again", label: "Again", cls: "bg-destructive text-destructive-foreground" },
  { grade: "hard", label: "Hard", cls: "bg-amber-500 text-white" },
  { grade: "good", label: "Good", cls: "bg-primary text-primary-foreground" },
  { grade: "easy", label: "Easy", cls: "bg-green-600 text-white" },
] as const;

const GRADE_COLOR: Record<string, string> = {
  again: "text-destructive",
  hard: "text-amber-600",
  good: "text-primary",
  easy: "text-green-600",
};

export function FlashcardReview() {
  const { speak } = useSpeech();
  const [cards, setCards] = useState<DueCard[]>([]);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [loading, setLoading] = useState(true);
  const [reviewed, setReviewed] = useState(0);
  const [history, setHistory] = useState<ReviewLog[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);

  // drag state
  const [dragX, setDragX] = useState(0);
  const startX = useRef<number | null>(null);

  const loadDue = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/flashcards/due");
      const data = await res.json();
      setCards(data.cards ?? []);
      setIndex(0);
      setFlipped(false);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadHistory = useCallback(async () => {
    const res = await fetch("/api/flashcards/history").catch(() => null);
    if (!res) return;
    const data = await res.json();
    setHistory(data.history ?? []);
  }, []);

  useEffect(() => {
    void loadDue();
    void loadHistory();
  }, [loadDue, loadHistory]);

  const card = cards[index];

  const go = (dir: -1 | 1) => {
    setFlipped(false);
    setIndex((i) => Math.min(cards.length - 1, Math.max(0, i + dir)));
  };

  const grade = async (g: (typeof GRADES)[number]["grade"]) => {
    if (!card) return;
    await fetch(`/api/flashcards/${card.id}/review`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ grade: g }),
    }).catch(() => {});
    setReviewed((n) => n + 1);
    void loadHistory();
    setFlipped(false);
    setIndex((i) => i + 1); // advance past this card
  };

  // Pointer drag → swipe between cards; tiny movement = tap-to-flip.
  const onDown = (e: React.PointerEvent) => {
    startX.current = e.clientX;
  };
  const onMove = (e: React.PointerEvent) => {
    if (startX.current !== null) setDragX(e.clientX - startX.current);
  };
  const onUp = () => {
    const dx = dragX;
    startX.current = null;
    setDragX(0);
    if (Math.abs(dx) < 8) setFlipped((f) => !f);
    else if (dx > 60) go(-1);
    else if (dx < -60) go(1);
  };

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold tracking-tight">Review</h1>
      {loading ? (
        <div className="flex justify-center py-16 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : !card ? (
        <div className="space-y-3 py-10 text-center">
          <p className="text-4xl">🎉</p>
          <h1 className="text-xl font-bold">All caught up!</h1>
          <p className="text-sm text-muted-foreground">
            {reviewed > 0
              ? `You reviewed ${reviewed} card${reviewed === 1 ? "" : "s"}.`
              : "No cards due right now."}
          </p>
          <button
            onClick={loadDue}
            className="mx-auto flex items-center gap-2 rounded-lg border px-4 py-2 text-sm hover:bg-muted"
          >
            <RotateCcw className="h-4 w-4" /> Check again
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Due cards</span>
            <span className="rounded-full bg-muted px-2 py-0.5 font-medium">
              {index + 1} / {cards.length}
            </span>
          </div>

          {/* Deck: top card fully shown, the next few stacked behind it */}
          <div className="relative mb-4">
            {[3, 2, 1].map((depth) =>
              cards[index + depth] ? (
                <div
                  key={depth}
                  aria-hidden
                  style={{
                    transform: `rotate(${(depth % 2 === 0 ? 1 : -1) * depth * 3}deg) translateY(${depth * 3}px)`,
                    transformOrigin: "bottom center",
                    opacity: 0.85 - depth * 0.15,
                  }}
                  className="absolute inset-0 rounded-2xl border-2 border-primary/20 bg-muted shadow-sm"
                />
              ) : null,
            )}

            <div
              key={index}
              onPointerDown={onDown}
              onPointerMove={onMove}
              onPointerUp={onUp}
              onPointerLeave={() => startX.current !== null && onUp()}
              style={{
                touchAction: "pan-y",
                transform:
                  dragX !== 0 ? `translateX(${dragX}px) rotate(${dragX / 40}deg)` : undefined,
              }}
              className={cn(
                "shadow-soft-lg relative flex min-h-52 cursor-grab select-none flex-col items-center justify-center gap-3 rounded-2xl border bg-card p-6 text-center transition-transform active:cursor-grabbing",
                dragX === 0 && cards.length > 1 ? "animate-card-hint" : null,
              )}
            >
              {card.fromMistake ? (
                <span className="absolute left-3 top-3 rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-400">
                  from your mistakes
                </span>
              ) : null}
              <span className="text-2xl font-bold">{card.termIt}</span>
              {card.partOfSpeech ? (
                <span className="text-xs text-muted-foreground">{card.partOfSpeech}</span>
              ) : null}
              {flipped ? (
                <span className="mt-2 border-t pt-3 text-lg text-primary">{card.termEn}</span>
              ) : (
                <span className="text-xs text-muted-foreground">tap to reveal</span>
              )}
            </div>
          </div>

          {cards.length > 1 ? (
            <div className="flex items-center justify-center gap-2 text-[11px] text-muted-foreground">
              <ChevronLeft className="h-3.5 w-3.5 animate-pulse" />
              swipe to browse cards
              <ChevronRight className="h-3.5 w-3.5 animate-pulse" />
            </div>
          ) : null}

          {/* Prev / listen / next */}
          <div className="flex items-center justify-between">
            <button
              onClick={() => go(-1)}
              disabled={index === 0}
              className="flex h-9 w-9 items-center justify-center rounded-full border disabled:opacity-40"
              aria-label="Previous"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              onClick={() => speak(card.termIt)}
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
            >
              <Volume2 className="h-4 w-4" /> Listen
            </button>
            <button
              onClick={() => go(1)}
              disabled={index >= cards.length - 1}
              className="flex h-9 w-9 items-center justify-center rounded-full border disabled:opacity-40"
              aria-label="Next"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>

          {flipped ? (
            <div className="grid grid-cols-4 gap-2">
              {GRADES.map((g) => (
                <button
                  key={g.grade}
                  onClick={() => grade(g.grade)}
                  className={`press shadow-soft rounded-lg py-2 text-sm font-medium transition-transform ${g.cls}`}
                >
                  {g.label}
                </button>
              ))}
            </div>
          ) : (
            <button
              onClick={() => setFlipped(true)}
              className="press shadow-soft w-full rounded-lg bg-primary py-2.5 font-medium text-primary-foreground transition-opacity hover:opacity-90"
            >
              Show answer
            </button>
          )}
        </div>
      )}

      <ReviewHistory
        history={history}
        open={historyOpen}
        onToggle={() => setHistoryOpen((o) => !o)}
      />
    </div>
  );
}

/* ─────────────────────────── History (day-wise) ─────────────────────────── */

function dayLabel(iso: string): string {
  const d = new Date(iso);
  const startOfDay = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((startOfDay(new Date()) - startOfDay(d)) / 86_400_000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yy = String(d.getFullYear()).slice(-2);
  return `${dd}/${mm}/${yy}`;
}

function timeLabel(iso: string): string {
  const d = new Date(iso);
  const h = d.getHours();
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = ((h + 11) % 12) + 1;
  return `${h12}:${String(d.getMinutes()).padStart(2, "0")} ${ampm}`;
}

function ReviewHistory({
  history,
  open,
  onToggle,
}: {
  history: ReviewLog[];
  open: boolean;
  onToggle: () => void;
}) {
  const [openDays, setOpenDays] = useState<Set<string>>(new Set());
  const [view, setView] = useState<"list" | "cards">("list");
  const inited = useRef(false);

  // Group by day label, preserving newest-first order.
  const groups: { label: string; items: ReviewLog[] }[] = [];
  for (const log of history) {
    const label = dayLabel(log.reviewedAt);
    const last = groups[groups.length - 1];
    if (last && last.label === label) last.items.push(log);
    else groups.push({ label, items: [log] });
  }

  // Expand the most recent day (Today) by default, once.
  useEffect(() => {
    if (!inited.current && groups.length > 0) {
      inited.current = true;
      setOpenDays(new Set([groups[0]!.label]));
    }
    // Intentionally keyed on group count only (groups is rebuilt every render).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groups.length]);

  const toggleDay = (label: string) =>
    setOpenDays((prev) => {
      const s = new Set(prev);
      if (s.has(label)) s.delete(label);
      else s.add(label);
      return s;
    });

  return (
    <section className="rounded-2xl border bg-card">
      <button onClick={onToggle} className="flex w-full items-center justify-between p-4 text-left">
        <span className="flex items-center gap-2 font-semibold">
          <HistoryIcon className="h-4 w-4" /> Review history
        </span>
        <span className="flex items-center gap-2 text-xs text-muted-foreground">
          {history.length}
          <ChevronDown className={cn("h-4 w-4 transition-transform", open && "rotate-180")} />
        </span>
      </button>

      {open ? (
        <div className="space-y-3 border-t p-4">
          {groups.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">No reviews yet.</p>
          ) : (
            <>
              {/* View toggle (default: list) */}
              <div className="flex justify-end">
                <div className="inline-flex rounded-lg border p-0.5 text-xs">
                  <button
                    onClick={() => setView("list")}
                    className={cn(
                      "flex items-center gap-1 rounded-md px-2 py-1",
                      view === "list"
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground",
                    )}
                  >
                    <List className="h-3.5 w-3.5" /> List
                  </button>
                  <button
                    onClick={() => setView("cards")}
                    className={cn(
                      "flex items-center gap-1 rounded-md px-2 py-1",
                      view === "cards"
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground",
                    )}
                  >
                    <LayoutGrid className="h-3.5 w-3.5" /> Cards
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                {groups.map((g) => {
                  const dOpen = openDays.has(g.label);
                  return (
                    <div key={g.label} className="overflow-hidden rounded-xl border">
                      <button
                        onClick={() => toggleDay(g.label)}
                        className="flex w-full items-center justify-between px-3 py-2 text-left"
                      >
                        <span className="text-sm font-semibold">{g.label}</span>
                        <span className="flex items-center gap-2 text-[11px] text-muted-foreground">
                          {g.items.length} cards
                          <ChevronDown
                            className={cn("h-4 w-4 transition-transform", dOpen && "rotate-180")}
                          />
                        </span>
                      </button>

                      {dOpen ? (
                        <div className="border-t p-3">
                          {view === "list" ? (
                            <ul className="space-y-1">
                              {g.items.map((log, i) => (
                                <li key={i} className="flex items-center gap-2 text-sm">
                                  <span className="flex-1 truncate">
                                    <b>{log.termIt}</b>{" "}
                                    <span className="text-muted-foreground">— {log.termEn}</span>
                                  </span>
                                  <span
                                    className={cn(
                                      "text-xs font-medium capitalize",
                                      GRADE_COLOR[log.grade],
                                    )}
                                  >
                                    {log.grade}
                                  </span>
                                  <span className="w-16 text-right text-[11px] text-muted-foreground">
                                    {timeLabel(log.reviewedAt)}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                              {g.items.map((log, i) => (
                                <div key={i} className="rounded-lg border p-2 text-center">
                                  <p className="truncate text-sm font-semibold">{log.termIt}</p>
                                  <p className="truncate text-[11px] text-muted-foreground">
                                    {log.termEn}
                                  </p>
                                  <p className="mt-1 text-[10px]">
                                    <span
                                      className={cn(
                                        "font-medium capitalize",
                                        GRADE_COLOR[log.grade],
                                      )}
                                    >
                                      {log.grade}
                                    </span>{" "}
                                    <span className="text-muted-foreground">
                                      · {timeLabel(log.reviewedAt)}
                                    </span>
                                  </p>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      ) : null}
    </section>
  );
}
