import type { SupabaseClient } from "@supabase/supabase-js";
import { scheduleNext, REVIEW_QUALITY, type ReviewGrade } from "@/core/application/use-cases/srs";

/**
 * Flashcards + vocabulary + review history. Runs under the user's session (RLS).
 * Flashcards are created lazily from vocabulary the first time the deck opens.
 */

export interface DueCard {
  id: string;
  termIt: string;
  termEn: string;
  partOfSpeech: string | null;
  /** True when the word was captured from a conversation correction (a real mistake). */
  fromMistake: boolean;
}

export interface VocabRow {
  id: string;
  termIt: string;
  termEn: string;
  partOfSpeech: string | null;
  isBookmarked: boolean;
  createdAt: string;
}

export interface ReviewLog {
  termIt: string;
  termEn: string;
  grade: string;
  reviewedAt: string;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
export class SupabaseStudyRepository {
  constructor(
    private readonly db: SupabaseClient,
    private readonly userId: string,
  ) {}

  async ensureFlashcards(): Promise<void> {
    const [{ data: vocab, error: vErr }, { data: cards, error: cErr }] = await Promise.all([
      this.db.from("vocabulary_items").select("id"),
      this.db.from("flashcards").select("vocabulary_item_id"),
    ]);
    if (vErr) throw new Error(vErr.message);
    if (cErr) throw new Error(cErr.message);

    const have = new Set(
      (cards ?? []).map((c: { vocabulary_item_id: string }) => c.vocabulary_item_id),
    );
    const missing = (vocab ?? []).filter((v: { id: string }) => !have.has(v.id));
    if (missing.length === 0) return;

    const rows = missing.map((v: { id: string }) => ({
      user_id: this.userId,
      vocabulary_item_id: v.id,
      due_at: new Date().toISOString(),
    }));
    // Upsert (not insert) so concurrent calls can't create duplicate cards.
    const { error } = await this.db
      .from("flashcards")
      .upsert(rows, { onConflict: "user_id,vocabulary_item_id", ignoreDuplicates: true });
    if (error) throw new Error(error.message);
  }

  /**
   * Cards due for review right now. Ordered so words captured from real
   * conversation mistakes (V3 adaptive priority) come first, then by soonest due.
   */
  async getDue(limit = 100): Promise<DueCard[]> {
    const { data, error } = await this.db
      .from("flashcards")
      .select("id, due_at, vocabulary_items(term_it, term_en, part_of_speech, source_message_id)")
      .lte("due_at", new Date().toISOString())
      .order("due_at", { ascending: true })
      .limit(limit);
    if (error) throw new Error(error.message);

    const cards: DueCard[] = (data ?? []).map((r: any) => {
      const v = Array.isArray(r.vocabulary_items) ? r.vocabulary_items[0] : r.vocabulary_items;
      return {
        id: r.id,
        termIt: v?.term_it ?? "",
        termEn: v?.term_en ?? "",
        partOfSpeech: v?.part_of_speech ?? null,
        fromMistake: !!v?.source_message_id,
      };
    });

    // Stable sort: mistake-derived first; the query already ordered by due date.
    cards.sort((a, b) => Number(b.fromMistake) - Number(a.fromMistake));
    return cards;
  }

  /** Apply an SM-2 grade to a card and log the review. */
  async review(cardId: string, grade: ReviewGrade): Promise<void> {
    const { data: card, error } = await this.db
      .from("flashcards")
      .select(
        "ease_factor, interval_days, repetitions, vocabulary_item_id, vocabulary_items(term_it, term_en)",
      )
      .eq("id", cardId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!card) throw new Error("Flashcard not found");

    const next = scheduleNext(
      {
        easeFactor: card.ease_factor,
        intervalDays: card.interval_days,
        repetitions: card.repetitions,
      },
      REVIEW_QUALITY[grade],
    );

    const { error: uErr } = await this.db
      .from("flashcards")
      .update({
        ease_factor: next.easeFactor,
        interval_days: next.intervalDays,
        repetitions: next.repetitions,
        due_at: next.dueAt.toISOString(),
      })
      .eq("id", cardId);
    if (uErr) throw new Error(uErr.message);

    const v = Array.isArray((card as any).vocabulary_items)
      ? (card as any).vocabulary_items[0]
      : (card as any).vocabulary_items;
    await this.db.from("review_logs").insert({
      user_id: this.userId,
      vocabulary_item_id: (card as any).vocabulary_item_id ?? null,
      term_it: v?.term_it ?? "",
      term_en: v?.term_en ?? "",
      grade,
    });
  }

  /** Recent review history (newest first) for the day-wise history view. */
  async getReviewHistory(limit = 300): Promise<ReviewLog[]> {
    const { data, error } = await this.db
      .from("review_logs")
      .select("term_it, term_en, grade, reviewed_at")
      .order("reviewed_at", { ascending: false })
      .limit(limit);
    if (error) throw new Error(error.message);
    return (data ?? []).map((r: any) => ({
      termIt: r.term_it,
      termEn: r.term_en,
      grade: r.grade,
      reviewedAt: r.reviewed_at,
    }));
  }

  async listVocabulary(bookmarkedOnly = false): Promise<VocabRow[]> {
    let query = this.db
      .from("vocabulary_items")
      .select("id, term_it, term_en, part_of_speech, is_bookmarked, created_at")
      .order("created_at", { ascending: false })
      .limit(500);
    if (bookmarkedOnly) query = query.eq("is_bookmarked", true);

    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return (data ?? []).map(mapVocab);
  }

  async setBookmark(vocabId: string, value: boolean): Promise<void> {
    const { error } = await this.db
      .from("vocabulary_items")
      .update({ is_bookmarked: value })
      .eq("id", vocabId);
    if (error) throw new Error(error.message);
  }

  async addVocabulary(item: {
    termIt: string;
    termEn: string;
    partOfSpeech?: string | null;
    isBookmarked?: boolean;
  }): Promise<VocabRow> {
    const term = item.termIt.trim();

    const { data: existing } = await this.db
      .from("vocabulary_items")
      .select("id, term_it, term_en, part_of_speech, is_bookmarked, created_at")
      .eq("user_id", this.userId)
      .ilike("term_it", term)
      .maybeSingle();
    if (existing) return mapVocab(existing);

    const { data, error } = await this.db
      .from("vocabulary_items")
      .insert({
        user_id: this.userId,
        term_it: term,
        term_en: item.termEn.trim(),
        part_of_speech: item.partOfSpeech ?? null,
        is_bookmarked: item.isBookmarked ?? false,
      })
      .select("id, term_it, term_en, part_of_speech, is_bookmarked, created_at")
      .single();
    if (error) throw new Error(error.message);
    return mapVocab(data);
  }
}

function mapVocab(r: any): VocabRow {
  return {
    id: r.id,
    termIt: r.term_it,
    termEn: r.term_en,
    partOfSpeech: r.part_of_speech,
    isBookmarked: r.is_bookmarked,
    createdAt: r.created_at,
  };
}
