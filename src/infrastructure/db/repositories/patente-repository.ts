import type { SupabaseClient } from "@supabase/supabase-js";

/** Patente question bank + per-user attempts (RLS-scoped). */

export interface PatenteQuestionDTO {
  id: string;
  topic: string;
  textIt: string;
  correct: boolean;
  image: string | null;
}

export interface TopicCount {
  topic: string;
  count: number;
}

export interface AttemptInput {
  questionId: string;
  topic: string;
  kind: "practice" | "exam";
  chosen: boolean;
  correct: boolean;
}

export interface PatenteProgress {
  totals: { answered: number; correct: number; accuracy: number };
  perTopic: { topic: string; answered: number; correct: number; accuracy: number }[];
  recentMistakes: { textIt: string; topic: string; correct: boolean; image: string | null }[];
}

/* eslint-disable @typescript-eslint/no-explicit-any */
export class SupabasePatenteRepository {
  constructor(
    private readonly db: SupabaseClient,
    private readonly userId: string,
  ) {}

  async listTopics(): Promise<TopicCount[]> {
    const { data, error } = await this.db.rpc("patente_topics");
    if (error) throw new Error(error.message);
    return (data ?? []).map((r: any) => ({ topic: r.topic, count: Number(r.count) }));
  }

  async getByTopic(topic: string, limit = 20): Promise<PatenteQuestionDTO[]> {
    const { data, error } = await this.db.rpc("patente_random_by_topic", {
      p_topic: topic,
      p_limit: limit,
    });
    if (error) throw new Error(error.message);
    return (data ?? []).map(mapQuestion);
  }

  async getExamSet(limit = 30): Promise<PatenteQuestionDTO[]> {
    const { data, error } = await this.db.rpc("patente_exam_set", { p_limit: limit });
    if (error) throw new Error(error.message);
    return (data ?? []).map(mapQuestion);
  }

  async recordAttempts(attempts: AttemptInput[]): Promise<void> {
    if (attempts.length === 0) return;
    const rows = attempts.map((a) => ({
      user_id: this.userId,
      question_id: a.questionId,
      topic: a.topic,
      kind: a.kind,
      chosen: a.chosen,
      correct: a.correct,
    }));
    const { error } = await this.db.from("patente_attempts").insert(rows);
    if (error) throw new Error(error.message);
  }

  async getProgress(): Promise<PatenteProgress> {
    const [{ data: rows, error }, { data: mistakes }] = await Promise.all([
      this.db.from("patente_attempts").select("topic, correct").limit(5000),
      this.db
        .from("patente_attempts")
        .select("correct, topic, patente_questions(text_it, image)")
        .eq("correct", false)
        .order("created_at", { ascending: false })
        .limit(20),
    ]);
    if (error) throw new Error(error.message);

    const byTopic = new Map<string, { answered: number; correct: number }>();
    let answered = 0;
    let correct = 0;
    for (const r of rows ?? []) {
      answered += 1;
      if (r.correct) correct += 1;
      const t = byTopic.get(r.topic) ?? { answered: 0, correct: 0 };
      t.answered += 1;
      if (r.correct) t.correct += 1;
      byTopic.set(r.topic, t);
    }

    const perTopic = [...byTopic.entries()]
      .map(([topic, v]) => ({
        topic,
        answered: v.answered,
        correct: v.correct,
        accuracy: v.answered ? Math.round((v.correct / v.answered) * 100) : 0,
      }))
      .sort((a, b) => a.accuracy - b.accuracy);

    const recentMistakes = (mistakes ?? []).map((m: any) => {
      const q = Array.isArray(m.patente_questions) ? m.patente_questions[0] : m.patente_questions;
      return {
        textIt: q?.text_it ?? "",
        topic: m.topic,
        correct: false,
        image: q?.image ?? null,
      };
    });

    return {
      totals: { answered, correct, accuracy: answered ? Math.round((correct / answered) * 100) : 0 },
      perTopic,
      recentMistakes,
    };
  }
}

function mapQuestion(r: any): PatenteQuestionDTO {
  return {
    id: r.id,
    topic: r.topic,
    textIt: r.text_it,
    correct: r.correct,
    image: r.image ?? null,
  };
}
