import type { LlmProvider } from "@/core/application/ports/llm";
import { serverEnv } from "@/lib/config/env";
import { logger } from "@/lib/logger";
import { GeminiProvider } from "./providers/gemini";
import { OpenAiCompatibleProvider } from "./providers/openai-compatible";

/**
 * Build the ordered provider list from environment configuration.
 *
 * LLM_PROVIDER_ORDER (comma-separated ids) sets the failover order, e.g.
 *   gemini,nvidia-qwen,nvidia-gemma,groq
 * A provider is only included if its API key is present, so the app runs with
 * whatever subset of keys you have configured.
 *
 * Model names have sensible free-tier defaults and can be overridden per env.
 */

const NVIDIA_BASE = "https://integrate.api.nvidia.com/v1";
const GROQ_BASE = "https://api.groq.com/openai/v1";
const CEREBRAS_BASE = "https://api.cerebras.ai/v1";

type Builder = () => LlmProvider | null;

const builders: Record<string, Builder> = {
  gemini: () =>
    serverEnv.GEMINI_API_KEY
      ? new GeminiProvider({
          id: "gemini",
          apiKey: serverEnv.GEMINI_API_KEY,
          model: process.env.GEMINI_MODEL ?? "gemini-2.0-flash",
        })
      : null,

  "nvidia-qwen": () =>
    serverEnv.NVIDIA_API_KEY
      ? new OpenAiCompatibleProvider({
          id: "nvidia-qwen",
          baseUrl: NVIDIA_BASE,
          apiKey: serverEnv.NVIDIA_API_KEY,
          model: process.env.NVIDIA_QWEN_MODEL ?? "qwen/qwen2.5-7b-instruct",
        })
      : null,

  "nvidia-gemma": () =>
    serverEnv.NVIDIA_API_KEY
      ? new OpenAiCompatibleProvider({
          id: "nvidia-gemma",
          baseUrl: NVIDIA_BASE,
          apiKey: serverEnv.NVIDIA_API_KEY,
          model: process.env.NVIDIA_GEMMA_MODEL ?? "google/gemma-2-9b-it",
        })
      : null,

  groq: () =>
    serverEnv.GROQ_API_KEY
      ? new OpenAiCompatibleProvider({
          id: "groq",
          baseUrl: GROQ_BASE,
          apiKey: serverEnv.GROQ_API_KEY,
          model: process.env.GROQ_MODEL ?? "openai/gpt-oss-120b",
        })
      : null,

  cerebras: () =>
    serverEnv.CEREBRAS_API_KEY
      ? new OpenAiCompatibleProvider({
          id: "cerebras",
          baseUrl: CEREBRAS_BASE,
          apiKey: serverEnv.CEREBRAS_API_KEY,
          model: process.env.CEREBRAS_MODEL ?? "llama-3.3-70b",
        })
      : null,
};

const DEFAULT_ORDER = ["cerebras", "groq", "gemini", "nvidia-qwen", "nvidia-gemma"];

export function buildProviders(): LlmProvider[] {
  const order = (serverEnv.LLM_PROVIDER_ORDER ?? DEFAULT_ORDER.join(","))
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const providers: LlmProvider[] = [];
  for (const id of order) {
    const builder = builders[id];
    if (!builder) {
      logger.warn("llm.unknown_provider_id", { id });
      continue;
    }
    const provider = builder();
    if (provider) providers.push(provider);
  }

  logger.info("llm.providers_configured", { ids: providers.map((p) => p.id) });
  return providers;
}
