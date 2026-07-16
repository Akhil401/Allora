import type {
  LlmProvider,
  LlmRequest,
  LlmChunk,
  ProviderHealth,
} from "@/core/application/ports/llm";
import { ProviderError, QuotaExceededError, RateLimitError } from "@/core/domain/errors";
import { parseSseJson } from "../sse";

export interface GeminiConfig {
  id: string;
  apiKey: string;
  model: string; // e.g. gemini-2.0-flash
  baseUrl?: string;
}

/**
 * Adapter for Google Gemini's streamGenerateContent (SSE) endpoint. Maps the
 * OpenAI-style chat shape onto Gemini's contents/system_instruction format.
 */
export class GeminiProvider implements LlmProvider {
  readonly id: string;
  private cooldownUntil = 0;
  private readonly baseUrl: string;

  constructor(private readonly config: GeminiConfig) {
    this.id = config.id;
    this.baseUrl = config.baseUrl ?? "https://generativelanguage.googleapis.com/v1beta";
  }

  health(): ProviderHealth {
    return {
      id: this.id,
      healthy: Date.now() >= this.cooldownUntil,
      cooldownUntil: this.cooldownUntil || undefined,
    };
  }

  async *generate(input: LlmRequest): AsyncIterable<LlmChunk> {
    const contents = input.messages.map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));

    const url =
      `${this.baseUrl}/models/${this.config.model}:streamGenerateContent` +
      `?alt=sse&key=${encodeURIComponent(this.config.apiKey)}`;

    let res: Response;
    try {
      res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: input.system }] },
          contents,
          generationConfig: {
            maxOutputTokens: input.maxTokens ?? 1024,
            temperature: input.temperature ?? 0.6,
            ...(input.responseFormat === "json" ? { responseMimeType: "application/json" } : {}),
          },
        }),
      });
    } catch {
      throw new ProviderError(`Network error calling ${this.id}`, this.id);
    }

    if (!res.ok || !res.body) {
      throw this.mapError(res.status, await safeText(res));
    }

    for await (const data of parseSseJson(res.body)) {
      let json: GeminiStreamChunk;
      try {
        json = JSON.parse(data) as GeminiStreamChunk;
      } catch {
        continue;
      }
      const parts = json.candidates?.[0]?.content?.parts ?? [];
      for (const p of parts) {
        if (p.text) yield { delta: p.text };
      }
    }
  }

  private mapError(status: number, body: string): Error {
    if (status === 429) {
      this.cool(60_000);
      return new RateLimitError(`${this.id} rate limited: ${body}`);
    }
    if (status === 401 || status === 403) {
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

interface GeminiStreamChunk {
  candidates?: { content?: { parts?: { text?: string }[] } }[];
}

async function safeText(res: Response): Promise<string> {
  try {
    return (await res.text()).slice(0, 300);
  } catch {
    return "";
  }
}
