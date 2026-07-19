/**
 * Token estimation + free-tier reference for the admin usage panel.
 *
 * Providers rarely return remaining free-tier quota, and their limits are often
 * request-based (RPM/RPD) rather than token-based, so treat these as guidance,
 * not gospel. `tokenBudget` is only set where a numeric token cap is meaningful
 * (e.g. Jina's ~1M free tokens) so we can draw a % gauge.
 */

/** Rough token estimate: ~4 characters per token. Good enough for a gauge. */
export function estimateTokens(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}

export function estimateTokensFromChars(chars: number): number {
  return Math.max(0, Math.ceil(chars / 4));
}

export interface ProviderLimit {
  id: string;
  label: string;
  freeTierNote: string;
  /** Numeric token cap for a progress gauge, when one is meaningful. */
  tokenBudget?: number;
}

export const PROVIDER_LIMITS: ProviderLimit[] = [
  {
    id: "gemini",
    label: "Gemini",
    freeTierNote:
      "Free tier is request-limited (per-minute & per-day), not token-capped; limits vary by model.",
  },
  {
    id: "nvidia-qwen",
    label: "NVIDIA NIM · Qwen",
    freeTierNote: "Free NIM credits, rate-limited per minute.",
  },
  {
    id: "nvidia-gemma",
    label: "NVIDIA NIM · Gemma",
    freeTierNote: "Free NIM credits, rate-limited per minute.",
  },
  {
    id: "groq",
    label: "Groq",
    freeTierNote: "Free tier: generous tokens/day plus requests/min limits.",
  },
  {
    id: "cerebras",
    label: "Cerebras",
    freeTierNote: "Free tier: generous daily token allowance; very fast inference.",
  },
  {
    id: "jina",
    label: "Jina embeddings",
    freeTierNote: "Free: ~1,000,000 tokens total on a new key.",
    tokenBudget: 1_000_000,
  },
];

export function providerLabel(id: string): string {
  return PROVIDER_LIMITS.find((p) => p.id === id)?.label ?? id;
}
