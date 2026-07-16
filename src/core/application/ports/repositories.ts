import type { CorrectionObject } from "@/lib/validation/correction";

/**
 * Repository port for conversation data. The concrete implementation
 * (Supabase) runs queries under the user's session so RLS enforces isolation.
 * Domain-facing DTOs use camelCase; the adapter maps DB snake_case columns.
 */

export type MessageRole = "user" | "tutor" | "system";
export type AudioSource = "mic" | "text";

export interface ConversationSummary {
  id: string;
  title: string;
  status: string;
  updatedAt: string;
}

export interface MessageDTO {
  id: string;
  conversationId: string;
  role: MessageRole;
  contentIt: string;
  contentEn: string | null;
  audioSource: AudioSource;
  providerUsed: string | null;
  createdAt: string;
  /** Persisted grammar correction for this (user) message, reconstructed on load. */
  correction?: CorrectionObject | null;
}

export interface ConversationWithMessages {
  conversation: ConversationSummary;
  messages: MessageDTO[];
}

export interface AddMessageInput {
  conversationId: string;
  role: MessageRole;
  contentIt: string;
  contentEn?: string | null;
  audioSource?: AudioSource;
  providerUsed?: string | null;
}

export interface ConversationRepository {
  list(): Promise<ConversationSummary[]>;
  create(input: { title?: string; categoryId?: string | null }): Promise<ConversationSummary>;
  get(id: string): Promise<ConversationWithMessages | null>;
  update(id: string, patch: { title?: string; status?: string }): Promise<ConversationSummary>;
  remove(id: string): Promise<void>;
  /** Snapshot into the deleted-conversations archive, then hard-delete. */
  archiveAndRemove(id: string): Promise<void>;

  addMessage(input: AddMessageInput): Promise<MessageDTO>;
  touch(conversationId: string): Promise<void>;

  getMessage(id: string): Promise<MessageDTO | null>;
  setMessageTranslation(id: string, contentEn: string): Promise<void>;

  /** Persist a correction + its tagged mistakes + surfaced vocabulary. */
  saveCorrection(messageId: string, correction: CorrectionObject): Promise<void>;
}
