import type {
  LlmProvider,
  LlmRouter,
  LlmRequest,
  LlmStream,
  LlmChunk,
  ProviderHealth,
} from "@/core/application/ports/llm";
import { AllProvidersFailedError, ProviderError } from "@/core/domain/errors";
import { logger } from "@/lib/logger";

/**
 * Ordered failover router.
 *
 * Tries providers in configured order. Healthy providers first, then any in
 * cooldown as a last resort. A provider "wins" the moment it yields its first
 * chunk; if it throws before that (rate-limit / quota / provider error) the
 * router advances to the next. Mid-stream failures after the first chunk are
 * surfaced to the caller (the partial answer already streamed).
 */
export class FailoverLlmRouter implements LlmRouter {
  constructor(private readonly providers: LlmProvider[]) {
    if (providers.length === 0) {
      throw new Error("FailoverLlmRouter requires at least one provider.");
    }
  }

  providerHealth(): ProviderHealth[] {
    return this.providers.map((p) => p.health());
  }

  async generate(input: LlmRequest): Promise<LlmStream> {
    const healthy = this.providers.filter((p) => p.health().healthy);
    const unhealthy = this.providers.filter((p) => !p.health().healthy);
    const ordered = [...healthy, ...unhealthy];

    const failures: string[] = [];

    for (const provider of ordered) {
      const started = Date.now();
      try {
        const iterator = provider.generate(input)[Symbol.asyncIterator]();
        const first = await iterator.next();

        if (first.done) {
          failures.push(`${provider.id}: empty response`);
          logger.warn("llm.provider.empty", { provider: provider.id });
          continue;
        }

        logger.info("llm.provider.selected", {
          provider: provider.id,
          firstTokenMs: Date.now() - started,
        });

        const firstChunk = first.value;
        const stream = replay(firstChunk, iterator);
        return { providerId: provider.id, stream, rateLimit: provider.rateLimit?.() };
      } catch (err) {
        const reason = err instanceof Error ? err.message : String(err);
        failures.push(`${provider.id}: ${reason}`);
        logger.warn("llm.provider.failover", { provider: provider.id, reason });
        continue;
      }
    }

    logger.error("llm.all_providers_failed", { failures });
    throw new AllProvidersFailedError(`All providers failed: ${failures.join(" | ")}`);
  }
}

/** Yields the already-consumed first chunk, then the rest of the iterator. */
async function* replay(
  first: LlmChunk,
  iterator: AsyncIterator<LlmChunk>,
): AsyncIterable<LlmChunk> {
  yield first;
  try {
    while (true) {
      const next = await iterator.next();
      if (next.done) break;
      yield next.value;
    }
  } catch (err) {
    // Mid-stream failure: nothing to fail over to cleanly. Surface it.
    throw err instanceof Error ? err : new ProviderError(String(err));
  }
}
