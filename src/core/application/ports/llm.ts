/**
 * Ports for the LLM layer (hexagonal architecture). Use cases depend on these
 * interfaces only — never on Gemini/NVIDIA SDKs. Concrete adapters live in
 * src/infrastructure/llm/* and are wired in the DI container.
 */

export type ChatRole = "system" | "user" | "assistant";

export interface ChatMessage {
  role: ChatRole;
  content: string;
}

export interface LlmRequest {
  system: string;
  messages: ChatMessage[];
  /** "json" requests a structured object; "text" a plain reply. */
  responseFormat?: "text" | "json";
  maxTokens?: number;
  temperature?: number;
}

/** A streamed piece of the model output. */
export interface LlmChunk {
  delta: string;
}

export interface ProviderHealth {
  id: string;
  healthy: boolean;
  /** Epoch ms until which the provider is in cooldown, if any. */
  cooldownUntil?: number;
}

/**
 * Live remaining-quota snapshot parsed from a provider's `x-ratelimit-*`
 * response headers (Groq / Cerebras send these on every call). Values are for
 * the provider's *current rolling window*, not a lifetime allowance. Providers
 * that don't report headers (Gemini, NVIDIA) yield `undefined`.
 */
export interface RateLimitSnapshot {
  provider: string;
  /** Requests left in the request window (Groq: per day). */
  remainingRequests?: number | null;
  limitRequests?: number | null;
  /** Tokens left in the token window (Groq: per minute). */
  remainingTokens?: number | null;
  limitTokens?: number | null;
  /** Provider-formatted reset hints, e.g. "2m30s" or "1.5s". */
  resetRequests?: string | null;
  resetTokens?: string | null;
  /** Epoch ms when this snapshot was captured. */
  capturedAt: number;
}

/** A single model provider (Gemini, NVIDIA-Qwen, ...). */
export interface LlmProvider {
  readonly id: string;
  generate(input: LlmRequest): AsyncIterable<LlmChunk>;
  health(): ProviderHealth;
  /** Latest rate-limit snapshot from this provider's last call, if it reports one. */
  rateLimit?(): RateLimitSnapshot | undefined;
}

/** A selected provider's live stream plus which provider won. */
export interface LlmStream {
  providerId: string;
  stream: AsyncIterable<LlmChunk>;
  /** Remaining-quota snapshot for the winning provider, when available. */
  rateLimit?: RateLimitSnapshot;
}

/**
 * Router that tries providers in configured order, failing over on
 * rate-limit / quota / provider errors. `generate` resolves once a provider has
 * been chosen and has produced its first chunk (so `providerId` is known before
 * the caller starts streaming, with no race). If every provider fails it throws
 * AllProvidersFailedError.
 */
export interface LlmRouter {
  generate(input: LlmRequest): Promise<LlmStream>;
  providerHealth(): ProviderHealth[];
}
