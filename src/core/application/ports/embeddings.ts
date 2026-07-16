/**
 * Port for the text-embedding layer (hexagonal architecture). Use cases and
 * repositories depend on this interface only — never on the Jina SDK/HTTP.
 * Concrete adapters live in src/infrastructure/embeddings/* and are wired in
 * the DI container.
 *
 * V3 uses embeddings to build a semantic memory of the learner: each correction
 * / mistake / topic is embedded and stored in pgvector, then recalled by
 * cosine similarity to make the tutor aware of past struggles.
 */

/** Whether the text describes something to store ("passage") or to search with ("query"). */
export type EmbeddingTask = "query" | "passage";

export interface EmbeddingProvider {
  readonly id: string;
  /** True only when a real provider is configured (API key present). */
  readonly available: boolean;
  /** Vector dimensionality (must match the DB `vector(N)` column). */
  readonly dimensions: number;
  /**
   * Embed one or more texts. Returns one vector per input, in order. When the
   * provider is unavailable this resolves to an empty array (callers must guard
   * on `available` and treat missing embeddings as "semantic memory disabled").
   */
  embed(texts: string[], task?: EmbeddingTask): Promise<number[][]>;
}
