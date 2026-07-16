import {
  pgTable,
  uuid,
  text,
  timestamp,
  integer,
  boolean,
  date,
  numeric,
  jsonb,
  unique,
  customType,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

/**
 * pgvector column type (1024-dim, jina-embeddings-v3). Drizzle has no native
 * vector type; this custom type emits `vector(1024)` DDL. At runtime we never
 * query this via Drizzle — the app uses the Supabase client + the
 * match_learner_memory RPC — so the JS representation is just number[].
 */
const vector1024 = customType<{ data: number[]; driverData: string }>({
  dataType() {
    return "vector(1024)";
  },
});

/**
 * Drizzle schema — the TypeScript source of truth for tables and row types.
 *
 * IMPORTANT: at runtime we query via the request-scoped Supabase client so that
 * Postgres Row-Level Security enforces per-user isolation. Drizzle is used for:
 *   (1) row TYPES (InferSelectModel) shared across the app, and
 *   (2) generating DDL / keeping the schema version-controlled.
 * The authoritative DB setup for V1 is supabase/migrations/0001_init.sql, which
 * mirrors this file and adds RLS policies, the profiles trigger, and seeds.
 *
 * `id` on profiles equals auth.users.id (1:1 extension).
 */

export const profiles = pgTable("profiles", {
  id: uuid("id").primaryKey(),
  displayName: text("display_name"),
  nativeLanguage: text("native_language").notNull().default("en"),
  targetLanguage: text("target_language").notNull().default("it"),
  cefrLevel: text("cefr_level").notNull().default("A1"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const categories = pgTable("categories", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").notNull().unique(),
  titleEn: text("title_en").notNull(),
  titleIt: text("title_it").notNull(),
  isRoleplay: boolean("is_roleplay").notNull().default(false),
});

export const conversations = pgTable("conversations", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull(),
  categoryId: uuid("category_id"),
  title: text("title").notNull().default("Nuova conversazione"),
  status: text("status").notNull().default("active"), // active | archived
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const messages = pgTable("messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  conversationId: uuid("conversation_id").notNull(),
  userId: uuid("user_id").notNull(),
  role: text("role").notNull(), // user | tutor | system
  contentIt: text("content_it").notNull(),
  contentEn: text("content_en"),
  audioSource: text("audio_source").notNull().default("text"), // mic | text
  providerUsed: text("provider_used"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const corrections = pgTable("corrections", {
  id: uuid("id").primaryKey().defaultRandom(),
  messageId: uuid("message_id").notNull(),
  userId: uuid("user_id").notNull(),
  originalText: text("original_text").notNull(),
  correctedText: text("corrected_text").notNull(),
  explanationEn: text("explanation_en").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const mistakes = pgTable("mistakes", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull(),
  correctionId: uuid("correction_id").notNull(),
  errorType: text("error_type").notNull(),
  detailEn: text("detail_en").notNull(),
  severity: text("severity").notNull().default("low"), // low | med | high
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const vocabularyItems = pgTable("vocabulary_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull(),
  sourceMessageId: uuid("source_message_id"),
  termIt: text("term_it").notNull(),
  termEn: text("term_en").notNull(),
  partOfSpeech: text("part_of_speech"),
  difficulty: text("difficulty").default("medium"), // V2
  isBookmarked: boolean("is_bookmarked").notNull().default(false), // V2
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const flashcards = pgTable("flashcards", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull(),
  vocabularyItemId: uuid("vocabulary_item_id").notNull(),
  easeFactor: integer("ease_factor").notNull().default(250), // SM-2 x100 (V2)
  intervalDays: integer("interval_days").notNull().default(0),
  repetitions: integer("repetitions").notNull().default(0),
  dueAt: timestamp("due_at", { withTimezone: true }).notNull().defaultNow(),
});

export const dailyProgress = pgTable(
  "daily_progress",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull(),
    day: date("day").notNull(),
    messagesCount: integer("messages_count").notNull().default(0),
    minutesPracticed: integer("minutes_practiced").notNull().default(0),
    goalMinutes: integer("goal_minutes").notNull().default(10),
    goalMet: boolean("goal_met").notNull().default(false),
  },
  (t) => ({ userDay: unique("daily_progress_user_day").on(t.userId, t.day) }),
);

export const achievements = pgTable("achievements", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull(),
  code: text("code").notNull(),
  earnedAt: timestamp("earned_at", { withTimezone: true }).notNull().defaultNow(),
});

export const settings = pgTable("settings", {
  userId: uuid("user_id").primaryKey(),
  theme: text("theme").notNull().default("system"), // light | dark | system
  voiceOutputEnabled: boolean("voice_output_enabled").notNull().default(true),
  tutorDifficulty: text("tutor_difficulty").notNull().default("normal"), // gentle | normal | strict
  dailyGoalMinutes: integer("daily_goal_minutes").notNull().default(10),
});

export const learnerMemory = pgTable("learner_memory", {
  userId: uuid("user_id").primaryKey(),
  masteredTopics: jsonb("mastered_topics")
    .notNull()
    .default(sql`'[]'::jsonb`),
  weakGrammar: jsonb("weak_grammar")
    .notNull()
    .default(sql`'[]'::jsonb`),
  weakPronunciation: jsonb("weak_pronunciation")
    .notNull()
    .default(sql`'[]'::jsonb`),
  favoriteTopics: jsonb("favorite_topics")
    .notNull()
    .default(sql`'[]'::jsonb`),
  confidence: numeric("confidence").notNull().default("0"),
  learningSpeed: text("learning_speed").notNull().default("normal"),
  // V3: cached human-readable summary + rolled-up counters for the insights panel.
  summaryEn: text("summary_en"),
  stats: jsonb("stats")
    .notNull()
    .default(sql`'{}'::jsonb`),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * V3: per-user embedded memory snippets for semantic recall (pgvector).
 * Populated live from corrections/mistakes; queried via match_learner_memory.
 */
export const memoryEmbeddings = pgTable("memory_embeddings", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull(),
  kind: text("kind").notNull(), // 'mistake' | 'correction' | 'topic'
  content: text("content").notNull(),
  embedding: vector1024("embedding"),
  metadata: jsonb("metadata")
    .notNull()
    .default(sql`'{}'::jsonb`),
  sourceMessageId: uuid("source_message_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// Shared row types (import these instead of redefining shapes elsewhere).
export type Profile = typeof profiles.$inferSelect;
export type Conversation = typeof conversations.$inferSelect;
export type Message = typeof messages.$inferSelect;
export type Correction = typeof corrections.$inferSelect;
export type Mistake = typeof mistakes.$inferSelect;
export type VocabularyItem = typeof vocabularyItems.$inferSelect;
export type DailyProgress = typeof dailyProgress.$inferSelect;
export type Settings = typeof settings.$inferSelect;
export type Category = typeof categories.$inferSelect;
/** Archive of user-deleted conversations (snapshot kept for later reference). */
export const deletedConversations = pgTable("deleted_conversations", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull(),
  originalId: uuid("original_id"),
  title: text("title"),
  data: jsonb("data")
    .notNull()
    .default(sql`'{}'::jsonb`),
  deletedAt: timestamp("deleted_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Self-logged LLM/embedding token usage (for the admin usage panel). */
export const tokenUsage = pgTable("token_usage", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull(),
  provider: text("provider").notNull(),
  kind: text("kind").notNull(),
  promptTokens: integer("prompt_tokens").notNull().default(0),
  completionTokens: integer("completion_tokens").notNull().default(0),
  totalTokens: integer("total_tokens").notNull().default(0),
  estimated: boolean("estimated").notNull().default(true),
  day: date("day").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type LearnerMemory = typeof learnerMemory.$inferSelect;
export type MemoryEmbedding = typeof memoryEmbeddings.$inferSelect;
export type DeletedConversation = typeof deletedConversations.$inferSelect;
export type TokenUsage = typeof tokenUsage.$inferSelect;
