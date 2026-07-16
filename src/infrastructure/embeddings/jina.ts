import type { EmbeddingProvider, EmbeddingTask } from "@/core/application/ports/embeddings";
import { logger } from "@/lib/logger";

/**
 * Jina AI embeddings adapter (https://api.jina.ai/v1/embeddings).
 *
 * Model default: jina-embeddings-v3 — multilingual (handles Italian + English),
 * with task-specific LoRA adapters ("retrieval.query" vs "retrieval.passage")
 * and Matryoshka dimensions (we request 1024 to match the pgvector column).
 *
 * Free tier: ~1M tokens, 100 req/min — comfortably enough for live per-turn
 * embedding for a handful of users. Jina does not train on API inputs/outputs.
 */

const JINA_URL = "https://api.jina.ai/v1/embeddings";

interface JinaResponse {
  data?: { embedding: number[]; index: number }[];
  detail?: string;
}

export class JinaEmbeddingProvider implements EmbeddingProvider {
  readonly id = "jina";
  readonly available = true;
  readonly dimensions: number;
  private readonly apiKey: string;
  private readonly model: string;

  constructor(opts: { apiKey: string; model?: string; dimensions?: number }) {
    this.apiKey = opts.apiKey;
    this.model = opts.model ?? "jina-embeddings-v3";
    this.dimensions = opts.dimensions ?? 1024;
  }

  async embed(texts: string[], task: EmbeddingTask = "passage"): Promise<number[][]> {
    const input = texts.map((t) => t.trim()).filter(Boolean);
    if (input.length === 0) return [];

    const res = await fetch(JINA_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        // v3 task names are namespaced under "retrieval.*".
        task: task === "query" ? "retrieval.query" : "retrieval.passage",
        dimensions: this.dimensions,
        embedding_type: "float",
        input,
      }),
    });

    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as JinaResponse;
      throw new Error(`Jina embeddings failed (${res.status}): ${body.detail ?? res.statusText}`);
    }

    const json = (await res.json()) as JinaResponse;
    const rows = json.data ?? [];
    // Return in the same order as the input (Jina echoes `index`).
    return rows
      .slice()
      .sort((a, b) => a.index - b.index)
      .map((r) => r.embedding);
  }
}

/**
 * No-op provider used when JINA_API_KEY is absent. Keeps the whole app working
 * with structured-only memory: callers check `available` and skip semantic recall.
 */
export class NullEmbeddingProvider implements EmbeddingProvider {
  readonly id = "none";
  readonly available = false;
  readonly dimensions = 1024;

  async embed(): Promise<number[][]> {
    logger.debug("embeddings.disabled", { reason: "no JINA_API_KEY configured" });
    return [];
  }
}
