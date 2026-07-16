import type { LlmRouter } from "@/core/application/ports/llm";
import { buildCorrectionPrompt, type TutorContext } from "@/core/prompts/tutor";
import { parseCorrection, type CorrectionObject } from "@/lib/validation/correction";

/** Concatenate a full string from a streaming LLM response. */
export async function collectText(stream: AsyncIterable<{ delta: string }>): Promise<string> {
  let out = "";
  for await (const chunk of stream) out += chunk.delta;
  return out;
}

/**
 * Generate a structured correction for the user's Italian message. Uses the
 * JSON response mode and validates the output; returns null if the model failed
 * to produce a usable object (caller then skips persisting a correction).
 */
export async function generateCorrection(
  router: LlmRouter,
  ctx: TutorContext,
  userText: string,
): Promise<CorrectionObject | null> {
  const { stream } = await router.generate({
    system: buildCorrectionPrompt(ctx),
    messages: [{ role: "user", content: userText }],
    responseFormat: "json",
    temperature: 0.2,
    maxTokens: 700,
  });
  const raw = await collectText(stream);
  return parseCorrection(raw);
}
