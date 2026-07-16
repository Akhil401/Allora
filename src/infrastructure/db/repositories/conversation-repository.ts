import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  ConversationRepository,
  ConversationSummary,
  ConversationWithMessages,
  MessageDTO,
  AddMessageInput,
} from "@/core/application/ports/repositories";
import type { CorrectionObject } from "@/lib/validation/correction";

/**
 * Supabase-backed ConversationRepository. All queries run under the user's
 * session (RLS enforces isolation); we still set user_id explicitly on inserts
 * because RLS `with check` requires it to equal auth.uid().
 */
export class SupabaseConversationRepository implements ConversationRepository {
  constructor(
    private readonly db: SupabaseClient,
    private readonly userId: string,
  ) {}

  async list(): Promise<ConversationSummary[]> {
    const { data, error } = await this.db
      .from("conversations")
      .select("id, title, status, updated_at")
      .order("updated_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []).map(mapConversation);
  }

  async create(input: {
    title?: string;
    categoryId?: string | null;
  }): Promise<ConversationSummary> {
    const { data, error } = await this.db
      .from("conversations")
      .insert({
        user_id: this.userId,
        title: input.title ?? "Nuova conversazione",
        category_id: input.categoryId ?? null,
      })
      .select("id, title, status, updated_at")
      .single();
    if (error) throw new Error(error.message);
    return mapConversation(data);
  }

  async get(id: string): Promise<ConversationWithMessages | null> {
    const { data: conv, error: cErr } = await this.db
      .from("conversations")
      .select("id, title, status, updated_at")
      .eq("id", id)
      .maybeSingle();
    if (cErr) throw new Error(cErr.message);
    if (!conv) return null;

    const { data: msgs, error: mErr } = await this.db
      .from("messages")
      .select(
        "id, conversation_id, role, content_it, content_en, audio_source, provider_used, created_at",
      )
      .eq("conversation_id", id)
      .order("created_at", { ascending: true });
    if (mErr) throw new Error(mErr.message);

    const messages = (msgs ?? []).map(mapMessage);

    // Re-attach persisted corrections (+ any words captured) so reopening a
    // conversation shows the correction cards, not just the raw messages.
    const userIds = messages.filter((m) => m.role === "user").map((m) => m.id);
    if (userIds.length > 0) {
      const [{ data: corr }, { data: vocab }] = await Promise.all([
        this.db
          .from("corrections")
          .select("message_id, original_text, corrected_text, explanation_en")
          .in("message_id", userIds),
        this.db
          .from("vocabulary_items")
          .select("term_it, term_en, part_of_speech, source_message_id")
          .in("source_message_id", userIds),
      ]);

      const vocabByMsg = new Map<
        string,
        { termIt: string; termEn: string; partOfSpeech?: string }[]
      >();
      for (const v of vocab ?? []) {
        const mid = (v as { source_message_id?: string }).source_message_id;
        if (!mid) continue;
        const list = vocabByMsg.get(mid) ?? [];
        list.push({
          termIt: v.term_it,
          termEn: v.term_en,
          partOfSpeech: v.part_of_speech ?? undefined,
        });
        vocabByMsg.set(mid, list);
      }

      const corrByMsg = new Map<string, CorrectionObject>();
      for (const c of corr ?? []) {
        const original = c.original_text ?? "";
        const corrected = c.corrected_text ?? "";
        corrByMsg.set(c.message_id, {
          hasError: corrected.trim() !== original.trim(),
          originalText: original,
          correctedText: corrected,
          explanationEn: c.explanation_en ?? "",
          errors: [],
          vocabulary: vocabByMsg.get(c.message_id) ?? [],
        });
      }

      for (const m of messages) {
        const found = corrByMsg.get(m.id);
        if (found) m.correction = found;
      }
    }

    return { conversation: mapConversation(conv), messages };
  }

  async update(
    id: string,
    patch: { title?: string; status?: string },
  ): Promise<ConversationSummary> {
    const { data, error } = await this.db
      .from("conversations")
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select("id, title, status, updated_at")
      .single();
    if (error) throw new Error(error.message);
    return mapConversation(data);
  }

  async remove(id: string): Promise<void> {
    const { error } = await this.db.from("conversations").delete().eq("id", id);
    if (error) throw new Error(error.message);
  }

  /**
   * Archive a conversation (snapshot of conversation + messages + corrections)
   * into `deleted_conversations`, then hard-delete it from the live tables
   * (cascades messages/corrections). The archive is kept for later reference.
   */
  async archiveAndRemove(id: string): Promise<void> {
    const snapshot = await this.get(id);
    if (snapshot) {
      const { error: aErr } = await this.db.from("deleted_conversations").insert({
        user_id: this.userId,
        original_id: id,
        title: snapshot.conversation.title,
        data: snapshot,
      });
      if (aErr) throw new Error(aErr.message);
    }
    await this.remove(id);
  }

  async addMessage(input: AddMessageInput): Promise<MessageDTO> {
    const { data, error } = await this.db
      .from("messages")
      .insert({
        conversation_id: input.conversationId,
        user_id: this.userId,
        role: input.role,
        content_it: input.contentIt,
        content_en: input.contentEn ?? null,
        audio_source: input.audioSource ?? "text",
        provider_used: input.providerUsed ?? null,
      })
      .select(
        "id, conversation_id, role, content_it, content_en, audio_source, provider_used, created_at",
      )
      .single();
    if (error) throw new Error(error.message);
    return mapMessage(data);
  }

  async touch(conversationId: string): Promise<void> {
    const { error } = await this.db
      .from("conversations")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", conversationId);
    if (error) throw new Error(error.message);
  }

  async getMessage(id: string): Promise<MessageDTO | null> {
    const { data, error } = await this.db
      .from("messages")
      .select(
        "id, conversation_id, role, content_it, content_en, audio_source, provider_used, created_at",
      )
      .eq("id", id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data ? mapMessage(data) : null;
  }

  async setMessageTranslation(id: string, contentEn: string): Promise<void> {
    const { error } = await this.db.from("messages").update({ content_en: contentEn }).eq("id", id);
    if (error) throw new Error(error.message);
  }

  async saveCorrection(messageId: string, correction: CorrectionObject): Promise<void> {
    if (
      !correction.hasError &&
      correction.errors.length === 0 &&
      correction.vocabulary.length === 0
    ) {
      return; // nothing worth persisting
    }

    const { data: corr, error: cErr } = await this.db
      .from("corrections")
      .insert({
        message_id: messageId,
        user_id: this.userId,
        original_text: correction.originalText,
        corrected_text: correction.correctedText,
        explanation_en: correction.explanationEn,
      })
      .select("id")
      .single();
    if (cErr) throw new Error(cErr.message);

    if (correction.errors.length > 0) {
      const rows = correction.errors.map((e) => ({
        user_id: this.userId,
        correction_id: corr.id,
        error_type: e.type,
        detail_en: e.detail,
        severity: e.severity,
      }));
      const { error } = await this.db.from("mistakes").insert(rows);
      if (error) throw new Error(error.message);
    }

    if (correction.vocabulary.length > 0) {
      // Skip words the user already has (case-insensitive) and de-dupe the batch.
      const { data: existing } = await this.db
        .from("vocabulary_items")
        .select("term_it")
        .eq("user_id", this.userId);
      const have = new Set(
        (existing ?? []).map((r: { term_it: string }) => r.term_it.trim().toLowerCase()),
      );

      const rows: Record<string, unknown>[] = [];
      for (const v of correction.vocabulary) {
        const term = v.termIt.trim();
        const key = term.toLowerCase();
        if (!term || have.has(key)) continue;
        have.add(key);
        rows.push({
          user_id: this.userId,
          source_message_id: messageId,
          term_it: term,
          term_en: v.termEn.trim(),
          part_of_speech: v.partOfSpeech ?? null,
        });
      }
      if (rows.length > 0) {
        const { error } = await this.db.from("vocabulary_items").insert(rows);
        if (error) throw new Error(error.message);
      }
    }
  }
}

// ── row mappers (snake_case → camelCase) ─────────────────────────
/* eslint-disable @typescript-eslint/no-explicit-any */
function mapConversation(r: any): ConversationSummary {
  return { id: r.id, title: r.title, status: r.status, updatedAt: r.updated_at };
}

function mapMessage(r: any): MessageDTO {
  return {
    id: r.id,
    conversationId: r.conversation_id,
    role: r.role,
    contentIt: r.content_it,
    contentEn: r.content_en,
    audioSource: r.audio_source,
    providerUsed: r.provider_used,
    createdAt: r.created_at,
  };
}
