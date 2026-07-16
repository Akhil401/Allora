import type { LlmRouter } from "@/core/application/ports/llm";
import type { EmbeddingProvider } from "@/core/application/ports/embeddings";
import { FailoverLlmRouter } from "@/infrastructure/llm/router";
import { buildProviders } from "@/infrastructure/llm/factory";
import { buildEmbeddingProvider } from "@/infrastructure/embeddings/factory";

/**
 * Composition root (Dependency Injection).
 *
 * The ONE place that knows about concrete implementations. Dependencies are
 * created lazily and memoized as singletons per server instance. Repositories
 * are request-scoped (they need the per-request Supabase client) so they are
 * NOT built here — construct them in route handlers with the request client.
 */

let llmRouter: LlmRouter | undefined;
let embeddingProvider: EmbeddingProvider | undefined;

export const container = {
  getLlmRouter(): LlmRouter {
    if (!llmRouter) {
      llmRouter = new FailoverLlmRouter(buildProviders());
    }
    return llmRouter;
  },

  /** V3: Jina (or Null) embedding provider for semantic learner memory. */
  getEmbeddingProvider(): EmbeddingProvider {
    if (!embeddingProvider) {
      embeddingProvider = buildEmbeddingProvider();
    }
    return embeddingProvider;
  },

  /** Test/seam hook to inject a fake router in unit tests. */
  _setLlmRouter(router: LlmRouter): void {
    llmRouter = router;
  },

  /** Test/seam hook to inject a fake embedding provider in unit tests. */
  _setEmbeddingProvider(provider: EmbeddingProvider): void {
    embeddingProvider = provider;
  },
};

export type Container = typeof container;
