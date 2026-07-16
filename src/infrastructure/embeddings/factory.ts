import type { EmbeddingProvider } from "@/core/application/ports/embeddings";
import { serverEnv } from "@/lib/config/env";
import { logger } from "@/lib/logger";
import { JinaEmbeddingProvider, NullEmbeddingProvider } from "./jina";

/**
 * Build the embedding provider from environment configuration. Returns a real
 * Jina adapter when JINA_API_KEY is set, otherwise a Null provider so the app
 * degrades gracefully to structured-only memory (no crash, no semantic recall).
 */
export function buildEmbeddingProvider(): EmbeddingProvider {
  if (!serverEnv.JINA_API_KEY) {
    logger.info("embeddings.provider", { id: "none" });
    return new NullEmbeddingProvider();
  }

  const dimensions = serverEnv.JINA_EMBED_DIM ? Number(serverEnv.JINA_EMBED_DIM) : 1024;
  logger.info("embeddings.provider", {
    id: "jina",
    model: serverEnv.JINA_MODEL ?? "jina-embeddings-v3",
  });
  return new JinaEmbeddingProvider({
    apiKey: serverEnv.JINA_API_KEY,
    model: serverEnv.JINA_MODEL,
    dimensions,
  });
}
