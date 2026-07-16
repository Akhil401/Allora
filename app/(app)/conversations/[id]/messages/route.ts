import { type NextRequest } from "next/server";
import { z } from "zod";
import { getRequestContext } from "@/infrastructure/auth/request-context";
import { loadTutorContext } from "@/infrastructure/db/tutor-context";
import { checkAndAwardAchievements } from "@/infrastructure/achievements/award";
import { container } from "@/di/container";
import { buildReplyPrompt } from "@/core/prompts/tutor";
import { generateCorrection } from "@/core/application/use-cases/tutor";
import { unauthorized, validationError, toProblem } from "@/lib/http/problem";
import { logger } from "@/lib/logger";
import type { MessageDTO } from "@/core/application/ports/repositories";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  text: z.string().min(1).max(2000),
  audioSource: z.enum(["mic", "text"]).default("text"),
});

/**
 * Core tutor endpoint. Streams the Italian reply as SSE `token` events, then
 * emits a `correction` event and a final `done` event. The reply and the
 * correction are two separate LLM calls (both go through the failover router).
 * V2: the conversation's category (if any) is injected as the roleplay scenario,
 * and achievements are re-checked after each turn.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getRequestContext();
  if (!ctx) return unauthorized();
  const { id: conversationId } = await params;

  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return validationError(parsed.error.issues[0]?.message ?? "Invalid body");
  const { text, audioSource } = parsed.data;

  const router = container.getLlmRouter();

  // Persist the user's message, load history, and resolve the scenario + context.
  let history: MessageDTO[] = [];
  let tutorCtx;
  try {
    await ctx.repo.addMessage({ conversationId, role: "user", contentIt: text, audioSource });
    const convo = await ctx.repo.get(conversationId);
    history = convo?.messages ?? [];

    // Resolve the conversation's category title (roleplay scenario), if set.
    const { data: convRow } = await ctx.supabase
      .from("conversations")
      .select("categories(title_en)")
      .eq("id", conversationId)
      .maybeSingle();
    /* eslint-disable @typescript-eslint/no-explicit-any */
    const catField = (convRow as any)?.categories;
    const cat = Array.isArray(catField) ? catField[0] : catField;
    const topicHint: string | undefined = cat?.title_en ?? undefined;

    tutorCtx = await loadTutorContext(ctx.supabase, topicHint);
  } catch (err) {
    return toProblem(err);
  }

  // Start the reply stream (this is where provider failover happens).
  let providerId: string;
  let replyStream: AsyncIterable<{ delta: string }>;
  try {
    const result = await router.generate({
      system: buildReplyPrompt(tutorCtx),
      messages: history.map((m) => ({
        role: m.role === "tutor" ? "assistant" : "user",
        content: m.contentIt,
      })),
      temperature: 0.7,
      maxTokens: 400,
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

        const tutorMsg = await ctx.repo.addMessage({
          conversationId,
          role: "tutor",
          contentIt: replyText,
          providerUsed: providerId,
        });
        await ctx.repo.touch(conversationId);

        try {
          await ctx.supabase.rpc("bump_daily_progress", { p_minutes: 1 });
          await checkAndAwardAchievements(ctx.supabase, ctx.userId);
        } catch (err) {
          logger.warn("progress_or_achievements_failed", {
            reason: err instanceof Error ? err.message : String(err),
          });
        }

        // Correction of the user's message (best-effort; never blocks the reply).
        try {
          const correction = await generateCorrection(router, tutorCtx, text);
          if (correction) {
            const userMsgId = history.filter((m) => m.role === "user").at(-1)?.id;
            if (userMsgId) await ctx.repo.saveCorrection(userMsgId, correction);
            controller.enqueue(sse("correction", correction));
          }
        } catch (err) {
          logger.warn("tutor.correction_failed", {
            reason: err instanceof Error ? err.message : String(err),
          });
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
