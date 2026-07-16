/**
 * V3 — Adaptive learner memory (PURE domain logic, no I/O).
 *
 * Turns raw activity (mistakes, completed lessons, category usage, review grades)
 * into a compact, explainable model of the learner: weak grammar, mastered and
 * favourite topics, confidence, learning speed. Also builds the prompt block the
 * tutor is fed, and picks lessons to recommend. Kept pure so it is fully
 * unit-testable and framework-agnostic.
 */

export type Severity = "low" | "med" | "high";
export type LearningSpeed = "slow" | "normal" | "fast";

export interface MistakeSignal {
  errorType: string;
  severity: Severity;
}

export interface FavoriteTopicSignal {
  topic: string;
  count: number;
}

export interface ReviewTally {
  again: number;
  hard: number;
  good: number;
  easy: number;
}

export interface MemoryInputs {
  mistakes: MistakeSignal[];
  completedTopics: string[]; // titles/objectives of completed lessons
  favoriteTopics: FavoriteTopicSignal[]; // from conversation categories used
  reviews: ReviewTally;
  lessonsCompleted: number;
  activeDays: number;
  totalMessages: number;
}

export interface WeakGrammarItem {
  type: string; // raw tag, e.g. "verb_tense"
  label: string; // human label, e.g. "verb tenses"
  count: number;
}

export interface MemoryStats {
  lessonsCompleted: number;
  totalMistakes: number;
  reviewAccuracy: number; // 0..1
  totalMessages: number;
}

export interface LearnerMemory {
  weakGrammar: WeakGrammarItem[];
  masteredTopics: string[];
  favoriteTopics: string[];
  weakPronunciation: string[];
  confidence: number; // 0..1
  learningSpeed: LearningSpeed;
  stats: MemoryStats;
  summaryEn: string;
}

const SEVERITY_WEIGHT: Record<Severity, number> = { low: 1, med: 2, high: 3 };

/** Human-friendly labels for common error tags produced by the correction step. */
const ERROR_LABELS: Record<string, string> = {
  verb_tense: "verb tenses",
  auxiliary_verb: "auxiliary verbs (essere/avere)",
  agreement: "gender/number agreement",
  article: "articles",
  preposition: "prepositions",
  word_choice: "word choice",
  spelling: "spelling",
  pronoun: "pronouns",
  conjugation: "verb conjugation",
  gender: "noun gender",
  plural: "plurals",
  word_order: "word order",
  accent: "accents",
};

export function labelForError(type: string): string {
  return ERROR_LABELS[type] ?? type.replace(/_/g, " ");
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function uniq(list: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const s of list) {
    const key = s.trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(s.trim());
  }
  return out;
}

/** Aggregate raw signals into the learner memory model. */
export function aggregateMemory(input: MemoryInputs): LearnerMemory {
  // ── Weak grammar: group mistakes by type, weight by severity, rank ──
  const byType = new Map<string, { count: number; weight: number }>();
  for (const m of input.mistakes) {
    const cur = byType.get(m.errorType) ?? { count: 0, weight: 0 };
    cur.count += 1;
    cur.weight += SEVERITY_WEIGHT[m.severity] ?? 1;
    byType.set(m.errorType, cur);
  }
  const weakGrammar: WeakGrammarItem[] = [...byType.entries()]
    .sort((a, b) => b[1].weight - a[1].weight || b[1].count - a[1].count)
    .slice(0, 6)
    .map(([type, v]) => ({ type, label: labelForError(type), count: v.count }));

  // ── Topics ──
  const masteredTopics = uniq(input.completedTopics).slice(0, 12);
  const favoriteTopics = input.favoriteTopics
    .slice()
    .sort((a, b) => b.count - a.count)
    .map((t) => t.topic)
    .filter(Boolean)
    .slice(0, 5);

  // ── Confidence: blend review accuracy with in-conversation correctness ──
  const totalReviews =
    input.reviews.again + input.reviews.hard + input.reviews.good + input.reviews.easy;
  const reviewAccuracy =
    totalReviews > 0 ? (input.reviews.good + input.reviews.easy) / totalReviews : 0;

  const totalMistakes = input.mistakes.length;
  const mistakeRate =
    input.totalMessages > 0 ? Math.min(1, totalMistakes / input.totalMessages) : 0;
  const correctness = 1 - mistakeRate;

  const hasData = totalReviews > 0 || input.totalMessages > 0;
  const confidence = hasData
    ? round2(clamp01(0.5 * (totalReviews > 0 ? reviewAccuracy : correctness) + 0.5 * correctness))
    : 0.5;

  // ── Learning speed: lessons completed per active day ──
  const perDay = input.activeDays > 0 ? input.lessonsCompleted / input.activeDays : 0;
  const learningSpeed: LearningSpeed =
    input.activeDays === 0 ? "normal" : perDay >= 1.5 ? "fast" : perDay >= 0.5 ? "normal" : "slow";

  const stats: MemoryStats = {
    lessonsCompleted: input.lessonsCompleted,
    totalMistakes,
    reviewAccuracy: round2(reviewAccuracy),
    totalMessages: input.totalMessages,
  };

  return {
    weakGrammar,
    masteredTopics,
    favoriteTopics,
    weakPronunciation: [],
    confidence,
    learningSpeed,
    stats,
    summaryEn: buildSummary({ weakGrammar, favoriteTopics, confidence, learningSpeed, stats }),
  };
}

/** A short, deterministic English summary for the insights panel (no LLM call). */
export function buildSummary(m: {
  weakGrammar: WeakGrammarItem[];
  favoriteTopics: string[];
  confidence: number;
  learningSpeed: LearningSpeed;
  stats: MemoryStats;
}): string {
  const parts: string[] = [];
  const pct = Math.round(m.confidence * 100);
  parts.push(
    `Confidence ${pct}% · ${m.learningSpeed} pace · ${m.stats.lessonsCompleted} lessons done.`,
  );
  if (m.weakGrammar.length > 0) {
    parts.push(
      `Focus areas: ${m.weakGrammar
        .slice(0, 3)
        .map((w) => w.label)
        .join(", ")}.`,
    );
  } else {
    parts.push("No recurring grammar weaknesses yet — keep practicing!");
  }
  if (m.favoriteTopics.length > 0) {
    parts.push(`Enjoys: ${m.favoriteTopics.slice(0, 3).join(", ")}.`);
  }
  return parts.join(" ");
}

/**
 * Build the compact memory block injected into the tutor's reply system prompt.
 * Includes semantically-recalled past struggles (from pgvector), if any.
 */
export function buildMemoryPromptBlock(
  memory: LearnerMemory | null,
  recentStruggles: string[] = [],
  learnerName?: string,
  opts: { includeFavoriteTopics?: boolean } = { includeFavoriteTopics: true },
): string {
  if (!memory) return "";
  const lines: string[] = ["Learner profile (use it, but never read it aloud):"];
  if (learnerName) lines.push(`- Name: ${learnerName}.`);
  lines.push(
    `- Confidence: ${Math.round(memory.confidence * 100)}% (${memory.learningSpeed} learner).`,
  );
  if (memory.weakGrammar.length > 0) {
    lines.push(`- Weak spots to reinforce: ${memory.weakGrammar.map((w) => w.label).join(", ")}.`);
  }
  if (memory.masteredTopics.length > 0) {
    lines.push(
      `- Already mastered (don't re-teach): ${memory.masteredTopics.slice(0, 8).join(", ")}.`,
    );
  }
  // Topic steering is opt-in: it belongs in memory-driven Talk mode, NOT in a
  // normal chat (which must stay on its own scenario, so topics don't bleed
  // between independent conversations).
  if (opts.includeFavoriteTopics && memory.favoriteTopics.length > 0) {
    lines.push(
      `- Prefers talking about: ${memory.favoriteTopics.join(", ")}. Bias examples toward these.`,
    );
  }
  if (recentStruggles.length > 0) {
    lines.push(`- Recently struggled with: ${recentStruggles.slice(0, 4).join("; ")}.`);
  }
  return lines.join("\n");
}

/* ───────────────────────── Adaptive lesson recommendation ───────────────── */

/** Keywords that connect an error tag to lesson titles/objectives. */
const GRAMMAR_KEYWORDS: Record<string, string[]> = {
  verb_tense: ["tense", "past", "future", "present", "passato", "futuro", "presente", "imperfetto"],
  auxiliary_verb: ["essere", "avere", "auxiliary", "passato prossimo"],
  agreement: ["agreement", "gender", "plural", "adjective", "concord"],
  article: ["article", "articolo", "definite", "indefinite"],
  preposition: ["preposition", "preposizioni", "di", "a", "da", "in"],
  pronoun: ["pronoun", "pronomi", "direct", "indirect"],
  conjugation: ["conjugat", "verb", "verbi", "-are", "-ere", "-ire"],
  gender: ["gender", "masculine", "feminine", "genere"],
  plural: ["plural", "plurale"],
  word_order: ["word order", "syntax", "sentence"],
};

export interface LessonMeta {
  id: string;
  title: string;
  objective: string;
}

/**
 * Recommend up to `limit` lessons: first, incomplete lessons whose title/objective
 * match the learner's weak grammar; then fill with the next incomplete lessons in
 * course order. Never recommends completed lessons.
 */
export function recommendLessons(
  memory: LearnerMemory | null,
  completedIds: Set<string>,
  orderedIds: string[],
  meta: Record<string, LessonMeta>,
  limit = 3,
): LessonMeta[] {
  const picked: LessonMeta[] = [];
  const pickedIds = new Set<string>();

  const add = (id: string) => {
    if (picked.length >= limit || pickedIds.has(id) || completedIds.has(id)) return;
    const m = meta[id];
    if (!m) return;
    pickedIds.add(id);
    picked.push(m);
  };

  // 1) Weakness-targeted: match keywords against lesson text.
  const keywords = (memory?.weakGrammar ?? [])
    .flatMap((w) => GRAMMAR_KEYWORDS[w.type] ?? [w.label])
    .map((k) => k.toLowerCase());

  if (keywords.length > 0) {
    for (const id of orderedIds) {
      if (completedIds.has(id)) continue;
      const m = meta[id];
      if (!m) continue;
      const hay = `${m.title} ${m.objective}`.toLowerCase();
      if (keywords.some((k) => hay.includes(k))) add(id);
      if (picked.length >= limit) break;
    }
  }

  // 2) Fill with next incomplete lessons in order.
  for (const id of orderedIds) {
    if (picked.length >= limit) break;
    add(id);
  }

  return picked;
}
