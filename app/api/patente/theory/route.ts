import { type NextRequest, NextResponse } from "next/server";
import { getRequestContext } from "@/infrastructure/auth/request-context";
import { container } from "@/di/container";
import { collectText } from "@/core/application/use-cases/tutor";
import { buildPatenteTheoryPrompt } from "@/core/prompts/patente";
import { recordTokenUsage, recordRateLimit } from "@/infrastructure/db/usage";
import { estimateTokens } from "@/lib/usage/tokens";
import { unauthorized, validationError, toProblem } from "@/lib/http/problem";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Theory study guide for a topic. Shared cache: generated once (LLM), then reused
 * by everyone. Returns { topic, content, cached }.
 */
export async function GET(request: NextRequest) {
  const ctx = await getRequestContext();
  if (!ctx) return unauthorized();

  const topic = request.nextUrl.searchParams.get("topic");
  if (!topic) return validationError("A topic is required.");

  try {
    // 1) Cache hit?
    const { data: cached } = await ctx.supabase
      .from("patente_theory")
      .select("content")
      .eq("topic", topic)
      .maybeSingle();
    if (cached?.content) {
      return NextResponse.json({ topic, content: cached.content, cached: true });
    }

    // 2) Generate + cache.
    const router = container.getLlmRouter();
    const system = buildPatenteTheoryPrompt(topic);
    const { stream, providerId, rateLimit } = await router.generate({
      system,
      messages: [{ role: "user", content: `Write the study guide for "${topic}".` }],
      temperature: 0.4,
      maxTokens: 700,
    });
    void recordRateLimit(ctx.supabase, rateLimit);
    const content = (await collectText(stream)).trim();

    void recordTokenUsage(ctx.supabase, ctx.userId, {
      provider: providerId,
      kind: "patente_theory",
      promptTokens: estimateTokens(system),
      completionTokens: estimateTokens(content),
    });

    if (content) {
      // Best-effort shared cache write (ignore duplicate races).
      await ctx.supabase
        .from("patente_theory")
        .upsert({ topic, content }, { onConflict: "topic", ignoreDuplicates: true })
        .then(({ error }) => {
          if (error) logger.warn("patente.theory_cache_failed", { reason: error.message });
        });
    }

    return NextResponse.json({ topic, content, cached: false });
  } catch (err) {
    return toProblem(err);
  }
}
