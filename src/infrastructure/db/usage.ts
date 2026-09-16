import type { SupabaseClient } from "@supabase/supabase-js";
import type { RateLimitSnapshot } from "@/core/application/ports/llm";
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

/**
 * Upsert the latest rate-limit snapshot for a provider (best-effort). One row
 * per provider, so the admin panel can read live "remaining" numbers even
 * though it runs in a different serverless invocation than the chat call.
 * No-op when the provider didn't report headers. Never throws.
 */
export async function recordRateLimit(
  db: SupabaseClient,
  snapshot: RateLimitSnapshot | undefined,
): Promise<void> {
  if (!snapshot) return;
  try {
    await db.from("provider_rate_limits").upsert(
      {
        provider: snapshot.provider,
        remaining_requests: snapshot.remainingRequests ?? null,
        limit_requests: snapshot.limitRequests ?? null,
        remaining_tokens: snapshot.remainingTokens ?? null,
        limit_tokens: snapshot.limitTokens ?? null,
        reset_requests: snapshot.resetRequests ?? null,
        reset_tokens: snapshot.resetTokens ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "provider" },
    );
  } catch (err) {
    logger.warn("usage.rate_limit_record_failed", {
      reason: err instanceof Error ? err.message : String(err),
    });
  }
}
