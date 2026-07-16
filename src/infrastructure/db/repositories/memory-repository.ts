import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  LearnerMemory,
  MistakeSignal,
  FavoriteTopicSignal,
  ReviewTally,
  Severity,
} from "@/core/application/use-cases/memory";

/**
 * V3 memory repository (Supabase, RLS-scoped).
 *
 * Two responsibilities:
 *   1. Gather raw signals (mistakes, category usage, reviews, activity) that the
 *      pure `aggregateMemory` use-case turns into the learner model.
 *   2. Persist/read `learner_memory`, and store/search `memory_embeddings`
 *      (pgvector) for semantic recall.
 *
 * Vectors are passed to Postgres as the pgvector text literal `[a,b,c]`, which
 * casts cleanly on both INSERT and the match RPC argument.
 */

export interface SemanticHit {
  content: string;
  metadata: Record<string, unknown>;
  similarity: number;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
export class SupabaseMemoryRepository {
  constructor(
    private readonly db: SupabaseClient,
    private readonly userId: string,
  ) {}

  /* ───────────────────────── Raw signals ───────────────────────── */

  async getMistakeSignals(limit = 300): Promise<MistakeSignal[]> {
    const { data, error } = await this.db
      .from("mistakes")
      .select("error_type, severity")
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw new Error(error.message);
    return (data ?? []).map((r: any) => ({
      errorType: String(r.error_type ?? "other"),
      severity: (["low", "med", "high"].includes(r.severity) ? r.severity : "low") as Severity,
    }));
  }

  /** Favourite topics = conversation categories the learner starts most. */
  async getFavoriteTopicSignals(): Promise<FavoriteTopicSignal[]> {
    const { data, error } = await this.db
      .from("conversations")
      .select("category_id, categories(title_en)")
      .not("category_id", "is", null)
      .limit(500);
    if (error) throw new Error(error.message);

    const counts = new Map<string, number>();
    for (const r of data ?? []) {
      const cat = Array.isArray((r as any).categories)
        ? (r as any).categories[0]
        : (r as any).categories;
      const title = cat?.title_en;
      if (!title) continue;
      counts.set(title, (counts.get(title) ?? 0) + 1);
    }
    return [...counts.entries()].map(([topic, count]) => ({ topic, count }));
  }

  async getReviewTally(): Promise<ReviewTally> {
    const { data, error } = await this.db
      .from("review_logs")
      .select("grade")
      .order("reviewed_at", { ascending: false })
      .limit(1000);
    if (error) throw new Error(error.message);
    const tally: ReviewTally = { again: 0, hard: 0, good: 0, easy: 0 };
    for (const r of data ?? []) {
      const g = (r as any).grade as keyof ReviewTally;
      if (g in tally) tally[g] += 1;
    }
    return tally;
  }

  async getActivityCounts(): Promise<{ totalMessages: number; activeDays: number }> {
    const [{ count: msgCount }, { data: days }] = await Promise.all([
      this.db.from("messages").select("id", { count: "exact", head: true }).eq("role", "user"),
      this.db.from("daily_progress").select("day").limit(400),
    ]);
    return {
      totalMessages: msgCount ?? 0,
      activeDays: (days ?? []).length,
    };
  }

  /* ───────────────────────── Persisted memory ──────────────────── */

  async getMemory(): Promise<LearnerMemory | null> {
    const { data, error } = await this.db
      .from("learner_memory")
      .select(
        "mastered_topics, weak_grammar, weak_pronunciation, favorite_topics, confidence, learning_speed, summary_en, stats",
      )
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return null;

    return {
      weakGrammar: asArray(data.weak_grammar),
      masteredTopics: asStringArray(data.mastered_topics),
      favoriteTopics: asStringArray(data.favorite_topics),
      weakPronunciation: asStringArray(data.weak_pronunciation),
      confidence: Number(data.confidence ?? 0),
      learningSpeed: (data.learning_speed ?? "normal") as LearnerMemory["learningSpeed"],
      stats: (data.stats ?? {}) as LearnerMemory["stats"],
      summaryEn: data.summary_en ?? "",
    };
  }

  async saveMemory(m: LearnerMemory): Promise<void> {
    const { error } = await this.db.from("learner_memory").upsert(
      {
        user_id: this.userId,
        mastered_topics: m.masteredTopics,
        weak_grammar: m.weakGrammar,
        weak_pronunciation: m.weakPronunciation,
        favorite_topics: m.favoriteTopics,
        confidence: m.confidence,
        learning_speed: m.learningSpeed,
        summary_en: m.summaryEn,
        stats: m.stats,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );
    if (error) throw new Error(error.message);
  }

  /* ───────────────────────── Semantic memory ───────────────────── */

  async recordEmbedding(input: {
    kind: "mistake" | "correction" | "topic";
    content: string;
    embedding: number[];
    metadata?: Record<string, unknown>;
    sourceMessageId?: string | null;
  }): Promise<void> {
    if (!input.embedding || input.embedding.length === 0) return; // semantic memory disabled
    const { error } = await this.db.from("memory_embeddings").insert({
      user_id: this.userId,
      kind: input.kind,
      content: input.content,
      embedding: toVectorLiteral(input.embedding),
      metadata: input.metadata ?? {},
      source_message_id: input.sourceMessageId ?? null,
    });
    if (error) throw new Error(error.message);
  }

  async search(embedding: number[], k = 5): Promise<SemanticHit[]> {
    if (!embedding || embedding.length === 0) return [];
    const { data, error } = await this.db.rpc("match_learner_memory", {
      query_embedding: toVectorLiteral(embedding),
      match_count: k,
    });
    if (error) throw new Error(error.message);
    return (data ?? []).map((r: any) => ({
      content: r.content,
      metadata: r.metadata ?? {},
      similarity: Number(r.similarity ?? 0),
    }));
  }
}

/** pgvector text literal, e.g. [0.12,0.34,...] — accepted on insert and RPC cast. */
function toVectorLiteral(v: number[]): string {
  return `[${v.join(",")}]`;
}

function asArray<T = any>(v: unknown): T[] {
  return Array.isArray(v) ? (v as T[]) : [];
}
function asStringArray(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x) => typeof x === "string") : [];
}
