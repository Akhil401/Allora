import { z } from "zod";

/**
 * Typed, validated environment configuration.
 *
 * Why: a single source of truth for env vars with runtime validation, so a
 * malformed variable fails loudly and early instead of causing a mysterious
 * runtime error deep in a request.
 *
 * Blank values are treated as "not set" — leaving a key empty in .env.local
 * (e.g. an LLM provider you don't use) is fine; the router just skips it.
 *
 * Security: only NEXT_PUBLIC_* values are safe to reach the browser. Never read
 * a server secret from client code — import { serverEnv } only in server files.
 */

/** Optional string that treats "" as undefined. */
const optionalStr = z.preprocess((v) => (v === "" ? undefined : v), z.string().min(1).optional());

/** Optional URL that treats "" as undefined. */
const optionalUrl = z.preprocess((v) => (v === "" ? undefined : v), z.string().url().optional());

const serverSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),

  // --- M2: Supabase (server side) ---
  SUPABASE_SERVICE_ROLE_KEY: optionalStr,
  DATABASE_URL: optionalUrl,

  // --- M3: LLM providers (failover chain) ---
  GEMINI_API_KEY: optionalStr,
  NVIDIA_API_KEY: optionalStr,
  GROQ_API_KEY: optionalStr,
  OPENROUTER_API_KEY: optionalStr,
  // Comma-separated provider order, e.g. "gemini,nvidia-qwen,nvidia-gemma,groq"
  LLM_PROVIDER_ORDER: optionalStr,

  // --- V3: Jina embeddings (semantic learner memory) ---
  // Optional: without it the app runs with structured-only memory.
  JINA_API_KEY: optionalStr,
  JINA_MODEL: optionalStr, // default "jina-embeddings-v3"
  JINA_EMBED_DIM: optionalStr, // default "1024" (must match the pgvector column)
});

const clientSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: optionalUrl,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: optionalStr,
});

/** Server-only env. Import from server components / route handlers / infra. */
export const serverEnv = serverSchema.parse(process.env);

/**
 * Client-safe env. Next inlines NEXT_PUBLIC_* at build time, so they must be
 * referenced explicitly (not via a dynamic key) for the inlining to work.
 */
export const clientEnv = clientSchema.parse({
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
});

export type ServerEnv = z.infer<typeof serverSchema>;
export type ClientEnv = z.infer<typeof clientSchema>;
