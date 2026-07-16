import type { SupabaseClient } from "@supabase/supabase-js";
import { logger } from "@/lib/logger";

/**
 * Record one LLM/embedding usage event (best-effort). Inserts under the user's
 * session so RLS is satisfied. Never throws — usage logging must not affect the
 * user-facing request.
 */
export async function recordTokenUsage(
  db: SupabaseClient,
  userId: string,
  event: {
    provider: string;
    kind: string;
    promptTokens?: number;
    completionTokens?: number;
    estimated?: boolean;
  },
): Promise<void> {
  const prompt = Math.max(0, Math.round(event.promptTokens ?? 0));
  const completion = Math.max(0, Math.round(event.completionTokens ?? 0));
  try {
    await db.from("token_usage").insert({
      user_id: userId,
      provider: event.provider,
      kind: event.kind,
      prompt_tokens: prompt,
      completion_tokens: completion,
      total_tokens: prompt + completion,
      estimated: event.estimated ?? true,
      day: new Date().toISOString().slice(0, 10),
    });
  } catch (err) {
    logger.warn("usage.record_failed", {
      reason: err instanceof Error ? err.message : String(err),
    });
  }
}
