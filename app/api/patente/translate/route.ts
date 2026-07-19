import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getRequestContext } from "@/infrastructure/auth/request-context";
import { container } from "@/di/container";
import { collectText } from "@/core/application/use-cases/tutor";
import { recordTokenUsage } from "@/infrastructure/db/usage";
import { estimateTokens } from "@/lib/usage/tokens";
import { unauthorized, validationError, toProblem } from "@/lib/http/problem";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  text: z.string().min(1).max(600),
  correct: z.boolean(),
  questionId: z.string().uuid().optional(),
});

/**
 * Translate a patente statement to English + explain in one line why it's
 * true/false. Handy since the learner is also learning Italian.
 */
export async function POST(request: NextRequest) {
  const ctx = await getRequestContext();
  if (!ctx) return unauthorized();

  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return validationError(parsed.error.issues[0]?.message ?? "Invalid body");
  const { text, correct, questionId } = parsed.data;

  try {
    // Cache hit (saved translation for this question)?
    if (questionId) {
      const { data: cached } = await ctx.supabase
        .from("patente_translations")
        .select("translation, explanation")
        .eq("question_id", questionId)
        .maybeSingle();
      if (cached?.translation) {
        return NextResponse.json({
          translation: cached.translation,
          explanation: cached.explanation ?? "",
          cached: true,
        });
      }
    }

    const router = container.getLlmRouter();
    const system =
      'You help an English speaker studying for the Italian driving-licence (patente) theory exam. ' +
      'Given one Italian statement and whether it is TRUE or FALSE, reply ONLY with JSON: ' +
      '{"translation": string, "explanation": string}. The translation is clear English; the ' +
      "explanation is ONE short English sentence saying why it is true or false.";
    const { stream, providerId } = await router.generate({
      system,
      messages: [{ role: "user", content: `Statement (Italian): "${text}"\nThis statement is ${correct ? "TRUE" : "FALSE"}.` }],
      responseFormat: "json",
      temperature: 0.2,
      maxTokens: 300,
    });
    const raw = await collectText(stream);

    void recordTokenUsage(ctx.supabase, ctx.userId, {
      provider: providerId,
      kind: "patente_translate",
      promptTokens: estimateTokens(system + text),
      completionTokens: estimateTokens(raw),
    });

    let translation = "";
    let explanation = "";
    try {
      const json = JSON.parse(raw.replace(/```json|```/g, "").trim());
      translation = String(json.translation ?? "");
      explanation = String(json.explanation ?? "");
    } catch {
      translation = raw.trim();
    }

    // Save it (shared cache) so it's not regenerated next time.
    if (questionId && translation) {
      await ctx.supabase
        .from("patente_translations")
        .upsert({ question_id: questionId, translation, explanation }, {
          onConflict: "question_id",
          ignoreDuplicates: true,
        })
        .then(({ error }) => {
          if (error) logger.warn("patente.translation_cache_failed", { reason: error.message });
        });
    }

    return NextResponse.json({ translation, explanation });
  } catch (err) {
    return toProblem(err);
  }
}
