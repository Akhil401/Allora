import type {
  LlmProvider,
  LlmRequest,
  LlmChunk,
  ProviderHealth,
  RateLimitSnapshot,
} from "@/core/application/ports/llm";
import { ProviderError, QuotaExceededError, RateLimitError } from "@/core/domain/errors";
import { parseSseJson } from "../sse";

export interface OpenAiCompatibleConfig {
  id: string;
  baseUrl: string; // e.g. https://integrate.api.nvidia.com/v1
  apiKey: string;
  model: string;
}

/**
 * Adapter for any OpenAI-compatible /chat/completions streaming endpoint.
 * Used for NVIDIA NIM and Groq (both speak the OpenAI wire format).
 */
export class OpenAiCompatibleProvider implements LlmProvider {
  readonly id: string;
  private cooldownUntil = 0;
  private lastRateLimit: RateLimitSnapshot | undefined;

  constructor(private readonly config: OpenAiCompatibleConfig) {
    this.id = config.id;
  }

  health(): ProviderHealth {
    return {
      id: this.id,
      healthy: Date.now() >= this.cooldownUntil,
      cooldownUntil: this.cooldownUntil || undefined,
    };
  }

  /** Latest remaining-quota snapshot from this provider's `x-ratelimit-*` headers. */
  rateLimit(): RateLimitSnapshot | undefined {
    return this.lastRateLimit;
  }

  /** Parse OpenAI-style rate-limit headers (Groq / Cerebras) into a snapshot. */
  private captureRateLimit(headers: Headers): void {
    const num = (k: string): number | null => {
      const v = headers.get(k);
      if (v == null || v.trim() === "") return null;
      const n = Number(v);
      return Number.isFinite(n) ? n : null;
    };
    const str = (k: string): string | null => headers.get(k) || null;

    const remainingRequests = num("x-ratelimit-remaining-requests");
    const remainingTokens = num("x-ratelimit-remaining-tokens");
    const limitRequests = num("x-ratelimit-limit-requests");
    const limitTokens = num("x-ratelimit-limit-tokens");

    // Only record when the provider actually sent rate-limit headers.
    if (
      remainingRequests == null &&
      remainingTokens == null &&
      limitRequests == null &&
      limitTokens == null
    ) {
      return;
    }
    this.lastRateLimit = {
      provider: this.id,
      remainingRequests,
      limitRequests,
      remainingTokens,
      limitTokens,
      resetRequests: str("x-ratelimit-reset-requests"),
      resetTokens: str("x-ratelimit-reset-tokens"),
      capturedAt: Date.now(),
    };
  }

  async *generate(input: LlmRequest): AsyncIterable<LlmChunk> {
    const messages = [
      { role: "system", content: input.system },
      ...input.messages.map((m) => ({ role: m.role, content: m.content })),
    ];

    let res: Response;
    try {
      res = await fetch(`${this.config.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify({
          model: this.config.model,
          messages,
          stream: true,
          max_tokens: input.maxTokens ?? 1024,
          temperature: input.temperature ?? 0.6,
          ...(input.responseFormat === "json" ? { response_format: { type: "json_object" } } : {}),
        }),
      });
    } catch {
      throw new ProviderError(`Network error calling ${this.id}`, this.id);
    }

    // Capture remaining-quota headers whether the call succeeded or was limited.
    this.captureRateLimit(res.headers);

    if (!res.ok || !res.body) {
      throw this.mapError(res.status, await safeText(res));
    }

    for await (const data of parseSseJson(res.body)) {
      let json: OpenAiStreamChunk;
      try {
        json = JSON.parse(data) as OpenAiStreamChunk;
      } catch {
        continue;
      }
      const delta = json.choices?.[0]?.delta?.content;
      if (delta) yield { delta };
    }
  }

  private mapError(status: number, body: string): Error {
    if (status === 429) {
      this.cool(60_000);
      return new RateLimitError(`${this.id} rate limited: ${body}`);
    }
    if (status === 401 || status === 402 || status === 403) {
      this.cool(5 * 60_000);
      return new QuotaExceededError(`${this.id} quota/auth error: ${body}`);
    }
    this.cool(30_000);
    return new ProviderError(`${this.id} HTTP ${status}: ${body}`, this.id);
  }

  private cool(ms: number) {
    this.cooldownUntil = Date.now() + ms;
  }
}

interface OpenAiStreamChunk {
  choices?: { delta?: { content?: string } }[];
}

async function safeText(res: Response): Promise<string> {
  try {
    return (await res.text()).slice(0, 300);
  } catch {
    return "";
  }
}
