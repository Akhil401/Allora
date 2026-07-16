"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import {
  Loader2,
  Star,
  Volume2,
  Search,
  ChevronDown,
  ChevronRight,
  Sparkles,
  Plus,
  Check,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useSpeech } from "@/presentation/hooks/use-speech";
import { COMMON_WORDS, type DictWord } from "@/presentation/data/common-words";
import type { DictionaryResult } from "@/lib/validation/dictionary";

const LETTER_RENDER_CAP = 600;
const SEARCH_CAP = 200;

interface VocabRow {
  id: string;
  termIt: string;
  termEn: string;
  partOfSpeech: string | null;
  isBookmarked: boolean;
}

/**
 * Words tab: two fixed 50/50 panes that each scroll independently — the top is
 * "Your vocabulary" (searchable), the bottom an A–Z Italian→English dictionary
 * with a Local search (built-in list) and an AI lookup (any word).
 */
export function VocabularyList() {
  return (
    <div className="flex h-[calc(100dvh-10rem)] flex-col gap-3 md:h-[calc(100dvh-6rem)]">
      <YourVocabulary />
      <Dictionary />
    </div>
  );
}

/* ─────────────────────────── Your vocabulary ─────────────────────────── */

function YourVocabulary() {
  const { speak } = useSpeech();
  const [rows, setRows] = useState<VocabRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [favOnly, setFavOnly] = useState(false);
  const [query, setQuery] = useState("");

  const load = useCallback(async (bookmarked: boolean) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/vocabulary${bookmarked ? "?bookmarked=1" : ""}`);
      const data = await res.json();
      setRows(data.vocabulary ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(favOnly);
  }, [favOnly, load]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) => r.termIt.toLowerCase().includes(q) || r.termEn.toLowerCase().includes(q),
    );
  }, [rows, query]);

  const toggle = async (row: VocabRow) => {
    const next = !row.isBookmarked;
    setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, isBookmarked: next } : r)));
    await fetch(`/api/vocabulary/${row.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isBookmarked: next }),
    }).catch(() => {});
    if (favOnly && !next) setRows((prev) => prev.filter((r) => r.id !== row.id));
  };

  return (
    <section className="shadow-soft flex min-h-0 flex-1 flex-col rounded-2xl border bg-card">
      <div className="shrink-0 space-y-2 border-b p-3">
        <div className="flex items-center justify-between">
          <span className="font-semibold">Your vocabulary</span>
          <span className="text-xs text-muted-foreground">{rows.length} words</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex flex-1 items-center gap-2 rounded-lg border bg-background px-3">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search your words…"
              className="w-full bg-transparent py-1.5 text-sm outline-none"
            />
          </div>
          <button
            onClick={() => setFavOnly((v) => !v)}
            className={cn(
              "flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm",
              favOnly ? "border-primary text-primary" : "text-muted-foreground",
            )}
          >
            <Star className={cn("h-4 w-4", favOnly && "fill-current")} />
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {loading ? (
          <div className="flex justify-center py-8 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            {rows.length === 0
              ? "No words yet — chat with the tutor to collect some!"
              : "No matches."}
          </p>
        ) : (
          <ul className="space-y-2">
            {filtered.map((r) => (
              <li
                key={r.id}
                className="flex items-center gap-3 rounded-xl border p-3 transition-colors hover:bg-muted/50"
              >
                <button
                  onClick={() => speak(r.termIt)}
                  aria-label="Listen"
                  className="text-muted-foreground"
                >
                  <Volume2 className="h-4 w-4" />
                </button>
                <div className="flex-1">
                  <p className="text-sm font-medium">{r.termIt}</p>
                  <p className="text-xs text-muted-foreground">
                    {r.termEn}
                    {r.partOfSpeech ? ` · ${r.partOfSpeech}` : ""}
                  </p>
                </div>
                <button onClick={() => toggle(r)} aria-label="Bookmark">
                  <Star
                    className={cn(
                      "h-5 w-5",
                      r.isBookmarked ? "fill-amber-400 text-amber-400" : "text-muted-foreground",
                    )}
                  />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

/* ─────────────────────────── Dictionary (A–Z) ─────────────────────────── */

function DictWordRow({
  w,
  onSpeak,
  onSave,
}: {
  w: DictWord;
  onSpeak: (t: string) => void;
  onSave: (w: DictWord) => void;
}) {
  const [saved, setSaved] = useState(false);
  const save = () => {
    if (!saved) {
      onSave(w);
      setSaved(true);
    }
  };
  // Any interaction (listen, tapping the word, or +) adds the word to Review.
  return (
    <li className="flex items-center gap-3 rounded-lg px-1 py-1.5">
      <button
        onClick={() => {
          onSpeak(w.it);
          save();
        }}
        aria-label="Listen & add to review"
        className="text-muted-foreground hover:text-foreground"
      >
        <Volume2 className="h-4 w-4" />
      </button>
      <button onClick={save} className="flex-1 text-left text-sm" title="Add to review">
        <b>{w.it}</b> <span className="text-muted-foreground">— {w.en}</span>
      </button>
      {w.pos ? <span className="text-[10px] text-muted-foreground">{w.pos}</span> : null}
      <button
        onClick={save}
        disabled={saved}
        aria-label="Add to review"
        className="text-muted-foreground hover:text-foreground disabled:opacity-60"
      >
        {saved ? <Check className="h-4 w-4 text-green-600" /> : <Plus className="h-4 w-4" />}
      </button>
    </li>
  );
}

function Dictionary() {
  const { speak } = useSpeech();
  const [words, setWords] = useState<DictWord[]>(COMMON_WORDS);
  const [query, setQuery] = useState("");
  const [localQuery, setLocalQuery] = useState(""); // set only when "Local" is pressed
  const [openLetters, setOpenLetters] = useState<Set<string>>(new Set());
  const [ai, setAi] = useState<DictionaryResult | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiSaved, setAiSaved] = useState(false);

  useEffect(() => {
    fetch("/dictionary/it-en.json")
      .then((r) => (r.ok ? r.json() : null))
      .then((data: DictWord[] | null) => {
        if (Array.isArray(data) && data.length > COMMON_WORDS.length) setWords(data);
      })
      .catch(() => {});
  }, []);

  const groups = useMemo(() => {
    const map = new Map<string, DictWord[]>();
    for (const w of words) {
      const letter = /[a-z]/i.test(w.it[0] ?? "") ? w.it[0]!.toUpperCase() : "#";
      if (!map.has(letter)) map.set(letter, []);
      map.get(letter)!.push(w);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [words]);

  const lq = localQuery.trim().toLowerCase();
  const localResults = useMemo(() => {
    if (!lq) return [];
    return words
      .filter((w) => w.it.toLowerCase().includes(lq) || w.en.toLowerCase().includes(lq))
      .slice(0, SEARCH_CAP);
  }, [lq, words]);

  const save = async (w: { it: string; en: string; pos?: string }) => {
    await fetch("/api/vocabulary", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ termIt: w.it, termEn: w.en, partOfSpeech: w.pos ?? null }),
    }).catch(() => {});
  };

  const runLocal = () => {
    setAi(null);
    setLocalQuery(query.trim());
  };

  const runAi = async () => {
    if (!query.trim()) return;
    setAiLoading(true);
    setAi(null);
    setAiSaved(false);
    try {
      const res = await fetch(`/api/dictionary?q=${encodeURIComponent(query.trim())}`);
      const data = await res.json();
      setAi(data.result ?? null);
    } finally {
      setAiLoading(false);
    }
  };

  const clearSearch = () => {
    setQuery("");
    setLocalQuery("");
    setAi(null);
  };

  const toggleLetter = (letter: string) =>
    setOpenLetters((prev) => {
      const next = new Set(prev);
      if (next.has(letter)) next.delete(letter);
      else next.add(letter);
      return next;
    });

  return (
    <section className="shadow-soft flex min-h-0 flex-1 flex-col rounded-2xl border bg-card">
      <div className="shrink-0 space-y-2 border-b p-3">
        <div className="flex items-center justify-between">
          <span className="font-semibold">Dictionary · IT → EN</span>
          <span className="text-xs text-muted-foreground">
            {words.length.toLocaleString()} words
          </span>
        </div>

        <div className="flex items-center gap-2 rounded-lg border bg-background px-3">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && runLocal()}
            placeholder="Type a word (IT or EN)…"
            className="w-full bg-transparent py-1.5 text-sm outline-none"
          />
          {query || localQuery ? (
            <button
              onClick={clearSearch}
              aria-label="Clear"
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          ) : null}
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={runLocal}
            disabled={!query.trim()}
            className="press flex items-center justify-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors hover:bg-muted disabled:opacity-50"
          >
            <Search className="h-4 w-4" /> Local search
          </button>
          <button
            onClick={runAi}
            disabled={aiLoading || !query.trim()}
            className="press flex items-center justify-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {aiLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            AI search
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {ai ? (
          <div className="mb-3 space-y-2 rounded-xl border border-primary/30 bg-primary/5 p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold">{ai.termIt}</p>
                <p className="text-xs text-muted-foreground">
                  {ai.termEn}
                  {ai.partOfSpeech ? ` · ${ai.partOfSpeech}` : ""}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    speak(ai.termIt);
                    if (!aiSaved) {
                      void save({ it: ai.termIt, en: ai.termEn, pos: ai.partOfSpeech });
                      setAiSaved(true);
                    }
                  }}
                  aria-label="Listen & add to review"
                  className="text-muted-foreground hover:text-foreground"
                >
                  <Volume2 className="h-4 w-4" />
                </button>
                <button
                  onClick={() => {
                    void save({ it: ai.termIt, en: ai.termEn, pos: ai.partOfSpeech });
                    setAiSaved(true);
                  }}
                  disabled={aiSaved}
                  className="flex items-center gap-1 rounded-md border px-2 py-1 text-xs disabled:opacity-60"
                >
                  {aiSaved ? <Check className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
                  {aiSaved ? "Added" : "Add to review"}
                </button>
              </div>
            </div>
            {ai.exampleIt ? (
              <p className="text-xs italic text-muted-foreground">
                “{ai.exampleIt}” — {ai.exampleEn}
              </p>
            ) : null}
          </div>
        ) : null}

        {lq ? (
          <>
            <p className="mb-2 text-xs text-muted-foreground">
              {localResults.length} local {localResults.length === 1 ? "match" : "matches"} for “
              {localQuery}”
            </p>
            {localResults.length > 0 ? (
              <ul className="space-y-1">
                {localResults.map((w) => (
                  <DictWordRow key={`${w.it}-${w.en}`} w={w} onSpeak={speak} onSave={save} />
                ))}
              </ul>
            ) : (
              <p className="py-3 text-center text-xs text-muted-foreground">
                No local matches — try <b>AI search</b> above.
              </p>
            )}
          </>
        ) : (
          <div className="divide-y">
            {groups.map(([letter, list]) => {
              const isOpen = openLetters.has(letter);
              const shown = list.slice(0, LETTER_RENDER_CAP);
              return (
                <div key={letter}>
                  <button
                    onClick={() => toggleLetter(letter)}
                    className="flex w-full items-center justify-between py-2 text-left"
                  >
                    <span className="flex h-6 w-6 items-center justify-center rounded bg-muted text-xs font-bold">
                      {letter}
                    </span>
                    <span className="flex items-center gap-2 text-xs text-muted-foreground">
                      {list.length}
                      {isOpen ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                    </span>
                  </button>
                  {isOpen ? (
                    <ul className="space-y-1 pb-2">
                      {shown.map((w) => (
                        <DictWordRow key={`${w.it}-${w.en}`} w={w} onSpeak={speak} onSave={save} />
                      ))}
                      {list.length > shown.length ? (
                        <li className="px-1 py-1 text-center text-[11px] text-muted-foreground">
                          +{(list.length - shown.length).toLocaleString()} more — use Local search
                        </li>
                      ) : null}
                    </ul>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
