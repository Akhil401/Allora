import { type NextRequest } from "next/server";
import { z } from "zod";
import { getRequestContext } from "@/infrastructure/auth/request-context";
import { loadTutorContext } from "@/infrastructure/db/tutor-context";
import { container } from "@/di/container";
import { buildReplyPrompt, buildCorrectionPrompt } from "@/core/prompts/tutor";
import { generateCorrection } from "@/core/application/use-cases/tutor";
import { buildMemoryPromptBlock } from "@/core/application/use-cases/memory";
import { SupabaseMemoryRepository } from "@/infrastructure/db/repositories/memory-repository";
import { SupabaseLessonsRepository } from "@/infrastructure/db/repositories/lessons-repository";
import { recomputeMemory } from "@/infrastructure/db/memory-sync";
import { checkAndAwardAchievements } from "@/infrastructure/achievements/award";
import { recordTokenUsage } from "@/infrastructure/db/usage";
import { estimateTokens, estimateTokensFromChars } from "@/lib/usage/tokens";
import { titlesForIds } from "@/presentation/data/curriculum";
import { unauthorized, validationError, toProblem } from "@/lib/http/problem";
import { logger } from "@/lib/logger";
import type { MessageDTO } from "@/core/application/ports/repositories";
import type { CorrectionObject } from "@/lib/validation/correction";
import type { ChatMessage } from "@/core/application/ports/llm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  text: z.string().max(2000).default(""),
  audioSource: z.enum(["mic", "text"]).default("text"),
  // V3 Talk mode: "talk" swaps to the spoken-drill persona; kickoff asks the
  // opening question with no user turn (no message persisted, no correction).
  mode: z.enum(["chat", "talk"]).default("chat"),
  kickoff: z.boolean().default(false),
});

/**
 * Core tutor endpoint. Streams the Italian reply as SSE `token` events, then
 * emits a `correction` event and a final `done` event. The reply and the
 * correction are two separate LLM calls (both go through the failover router).
 *
 * V3: the reply prompt is enriched with the learner's adaptive memory (structured
 * profile + semantically-recalled past struggles via Jina/pgvector). After each
 * turn the memory is updated live (structured recompute + embed of the mistake).
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getRequestContext();
  if (!ctx) return unauthorized();
  const { id: conversationId } = await params;

  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return validationError(parsed.error.issues[0]?.message ?? "Invalid body");
  const { text, audioSource, mode, kickoff } = parsed.data;
  if (!kickoff && !text.trim()) return validationError("Message text is required.");

  const router = container.getLlmRouter();
  const embedder = container.getEmbeddingProvider();
  const memoryRepo = new SupabaseMemoryRepository(ctx.supabase, ctx.userId);

  // Persist the user's message (except on a Talk kickoff) and load history + context.
  let history: MessageDTO[] = [];
  let tutorCtx;
  try {
    if (!kickoff) {
      await ctx.repo.addMessage({ conversationId, role: "user", contentIt: text, audioSource });
    }
    const convo = await ctx.repo.get(conversationId);
    history = convo?.messages ?? [];
    tutorCtx = await loadTutorContext(ctx.supabase);
    tutorCtx.mode = mode;
  } catch (err) {
    return toProblem(err);
  }

  // V3: build the memory block (structured profile + semantic recall). Best-effort
  // — a failure here must never break the conversation.
  try {
    const stored = await memoryRepo.getMemory();
    let recentStruggles: string[] = [];
    if (embedder.available && text.trim()) {
      const [queryVec] = await embedder.embed([text], "query");
      await recordTokenUsage(ctx.supabase, ctx.userId, {
        provider: "jina",
        kind: "embedding",
        promptTokens: estimateTokens(text),
      });
      if (queryVec) {
        const hits = await memoryRepo.search(queryVec, 4);
        recentStruggles = hits.filter((h) => h.similarity > 0.3).map((h) => h.content);
      }
    }
    tutorCtx.memoryBlock = buildMemoryPromptBlock(stored, recentStruggles, tutorCtx.learnerName, {
      // Only memory-driven Talk mode steers topics; a normal chat stays on its
      // own scenario so conversations don't bleed into each other.
      includeFavoriteTopics: mode === "talk",
    });
  } catch (err) {
    logger.warn("tutor.memory_load_failed", {
      reason: err instanceof Error ? err.message : String(err),
    });
  }

  // Talk mode: give Maestro the learner's most recent words so it can quiz them
  // ("Come si dice ___?") on what they're actually studying now. Best-effort.
  if (mode === "talk") {
    try {
      const { data: vocab } = await ctx.supabase
        .from("vocabulary_items")
        .select("term_it, term_en")
        .order("created_at", { ascending: false })
        .limit(20);
      if (vocab && vocab.length > 0) {
        const list = vocab
          .map((v: { term_it: string; term_en: string }) => `${v.term_en} = ${v.term_it}`)
          .join("; ");
        tutorCtx.memoryBlock = `${tutorCtx.memoryBlock ?? ""}\n- Currently learning (quiz these): ${list}.`;
      }
    } catch (err) {
      logger.warn("tutor.talk_vocab_failed", {
        reason: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // Build the LLM message list. On a Talk kickoff there is no user turn, so we
  // seed a short instruction that makes the tutor greet + ask the first question.
  const llmMessages: ChatMessage[] = history.map((m) => ({
    role: m.role === "tutor" ? "assistant" : "user",
    content: m.contentIt,
  }));
  if (kickoff) {
    llmMessages.push({
      role: "user",
      content: "(Inizia la lezione parlata: salutami molto brevemente e fammi la prima domanda.)",
    });
  }

  // Start the reply stream (this is where provider failover happens).
  let providerId: string;
  let replyStream: AsyncIterable<{ delta: string }>;
  try {
    const result = await router.generate({
      system: buildReplyPrompt(tutorCtx),
      messages: llmMessages,
      temperature: 0.7,
      maxTokens: mode === "talk" ? 220 : 400,
    });
    providerId = result.providerId;
    replyStream = result.stream;
  } catch (err) {
    return toProblem(err);
  }

  const encoder = new TextEncoder();
  const sse = (event: string, data: unknown) =>
    encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let replyText = "";
      try {
        controller.enqueue(sse("meta", { providerUsed: providerId }));

        for await (const chunk of replyStream) {
          replyText += chunk.delta;
          controller.enqueue(sse("token", { delta: chunk.delta }));
        }

        // Persist tutor reply + advance conversation timestamp.
        const tutorMsg = await ctx.repo.addMessage({
          conversationId,
          role: "tutor",
          contentIt: replyText,
          providerUsed: providerId,
        });
        await ctx.repo.touch(conversationId);

        // Log estimated token usage for the reply (admin usage panel).
        try {
          const promptChars =
            buildReplyPrompt(tutorCtx).length +
            llmMessages.reduce((n, m) => n + m.content.length, 0);
          await recordTokenUsage(ctx.supabase, ctx.userId, {
            provider: providerId,
            kind: mode === "talk" ? "talk" : "chat",
            promptTokens: estimateTokensFromChars(promptChars),
            completionTokens: estimateTokens(replyText),
          });
        } catch {
          /* usage logging is best-effort */
        }

        // On a kickoff there is no user turn to correct or learn from.
        if (!kickoff) {
          // Count this message toward today's stats (time is tracked separately
          // by the activity heartbeat) and award achievements. Best-effort.
          try {
            await ctx.supabase.rpc("record_activity", { p_messages: 1, p_minutes: 0 });
            await checkAndAwardAchievements(ctx.supabase, ctx.userId);
          } catch (err) {
            logger.warn("tutor.progress_or_achievements_failed", {
              reason: err instanceof Error ? err.message : String(err),
            });
          }

          const userMsgId = history.filter((m) => m.role === "user").at(-1)?.id;
          let correction: CorrectionObject | null = null;
          try {
            correction = await generateCorrection(router, tutorCtx, text);
            await recordTokenUsage(ctx.supabase, ctx.userId, {
              provider: providerId,
              kind: "correction",
              promptTokens: estimateTokensFromChars(
                buildCorrectionPrompt(tutorCtx).length + text.length,
              ),
              completionTokens: correction ? estimateTokens(JSON.stringify(correction)) : 80,
            });
            if (correction) {
              if (userMsgId) await ctx.repo.saveCorrection(userMsgId, correction);
              controller.enqueue(sse("correction", correction));
            }
          } catch (err) {
            logger.warn("tutor.correction_failed", {
              reason: err instanceof Error ? err.message : String(err),
            });
          }

          // V3: live adaptive-memory update (best-effort, runs before `done`).
          try {
            await updateLearnerMemory({
              supabase: ctx.supabase,
              userId: ctx.userId,
              memoryRepo,
              embedder,
              correction,
              userMsgId: userMsgId ?? null,
            });
          } catch (err) {
            logger.warn("tutor.memory_update_failed", {
              reason: err instanceof Error ? err.message : String(err),
            });
          }
        }

        controller.enqueue(sse("done", { messageId: tutorMsg.id, providerUsed: providerId }));
      } catch (err) {
        logger.error("tutor.stream_failed", {
          reason: err instanceof Error ? err.message : String(err),
        });
        controller.enqueue(sse("error", { message: "The tutor stopped unexpectedly." }));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}

/**
 * Recompute the learner's structured memory and, when there was a mistake and an
 * embedding provider is configured, store an embedded snippet for semantic recall.
 * The two are run in parallel and are individually fault-tolerant.
 */
async function updateLearnerMemory(args: {
  supabase: import("@supabase/supabase-js").SupabaseClient;
  userId: string;
  memoryRepo: SupabaseMemoryRepository;
  embedder: ReturnType<typeof container.getEmbeddingProvider>;
  correction: CorrectionObject | null;
  userMsgId: string | null;
}): Promise<void> {
  const { supabase, userId, memoryRepo, embedder, correction, userMsgId } = args;

  const recompute = (async () => {
    const lessonsRepo = new SupabaseLessonsRepository(supabase, userId);
    const completedIds = await lessonsRepo.getCompletedIds();
    await recomputeMemory({
      memoryRepo,
      completedTopics: titlesForIds(completedIds),
      lessonsCompleted: completedIds.length,
    });
  })();

  const embed = (async () => {
    if (!correction?.hasError || !embedder.available) return;
    const content = `Mistake: "${correction.originalText}" → "${correction.correctedText}". ${correction.explanationEn}`;
    const [vec] = await embedder.embed([content], "passage");
    await recordTokenUsage(supabase, userId, {
      provider: "jina",
      kind: "embedding",
      promptTokens: estimateTokens(content),
    });
    if (!vec) return;
    await memoryRepo.recordEmbedding({
      kind: "mistake",
      content,
      embedding: vec,
      metadata: {
        errorTypes: correction.errors.map((e) => e.type),
        severity: correction.errors[0]?.severity ?? "low",
      },
      sourceMessageId: userMsgId,
    });
  })();

  await Promise.allSettled([recompute, embed]);
}
