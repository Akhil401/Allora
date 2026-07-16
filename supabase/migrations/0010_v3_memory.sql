-- V3 — Adaptive memory: pgvector semantic memory + learner_memory enrichment.
-- Run once in the Supabase SQL Editor (or via `supabase db push`). Idempotent.
--
-- What this adds:
--   1. The `vector` extension (pgvector) for semantic similarity search.
--   2. `memory_embeddings` — per-user embedded snippets (mistakes/corrections/topics)
--      with an HNSW index for fast cosine nearest-neighbour retrieval.
--   3. Extra columns on `learner_memory` (cached summary + stats).
--   4. `match_learner_memory(query_embedding, match_count)` RPC for semantic recall,
--      scoped to the calling user via auth.uid() (+ RLS as defense in depth).
--
-- Embeddings are 1024-dim (jina-embeddings-v3). If you change the model/dimension,
-- update the vector(1024) size here AND JINA_EMBED_DIM in the app env.

-- ─────────────────────────────────────────────────────────────
-- 1. Extension
-- ─────────────────────────────────────────────────────────────
create extension if not exists vector;

-- ─────────────────────────────────────────────────────────────
-- 2. Semantic memory table
-- ─────────────────────────────────────────────────────────────
create table if not exists public.memory_embeddings (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users (id) on delete cascade,
  kind              text not null,                       -- 'mistake' | 'correction' | 'topic'
  content           text not null,                       -- the text that was embedded
  embedding         vector(1024),
  metadata          jsonb not null default '{}'::jsonb,  -- e.g. { "errorType": "verb_tense", "severity": "high" }
  source_message_id uuid references public.messages (id) on delete set null,
  created_at        timestamptz not null default now()
);

create index if not exists idx_memory_embeddings_user
  on public.memory_embeddings (user_id, created_at desc);

-- Approximate nearest-neighbour index (cosine). HNSW is available in Supabase's
-- pgvector build and gives good recall without tuning lists/probes.
create index if not exists idx_memory_embeddings_hnsw
  on public.memory_embeddings using hnsw (embedding vector_cosine_ops);

-- ─────────────────────────────────────────────────────────────
-- 3. learner_memory enrichment
-- ─────────────────────────────────────────────────────────────
alter table public.learner_memory
  add column if not exists summary_en text;
alter table public.learner_memory
  add column if not exists stats jsonb not null default '{}'::jsonb;

-- ─────────────────────────────────────────────────────────────
-- 4. Row-Level Security
-- ─────────────────────────────────────────────────────────────
alter table public.memory_embeddings enable row level security;
alter table public.learner_memory    enable row level security;

drop policy if exists "memory_embeddings_all_own" on public.memory_embeddings;
create policy "memory_embeddings_all_own" on public.memory_embeddings
  for all using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- learner_memory may already have a policy from 0001; recreate idempotently.
drop policy if exists "learner_memory_all_own" on public.learner_memory;
create policy "learner_memory_all_own" on public.learner_memory
  for all using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- ─────────────────────────────────────────────────────────────
-- 5. Semantic recall RPC (user-scoped)
-- ─────────────────────────────────────────────────────────────
-- SECURITY INVOKER (default): runs under the caller's role so RLS applies. We
-- also filter on auth.uid() so a user can only ever match their own snippets.
create or replace function public.match_learner_memory(
  query_embedding vector(1024),
  match_count int default 5
)
returns table (
  id uuid,
  kind text,
  content text,
  metadata jsonb,
  similarity float
)
language sql
stable
as $$
  select
    e.id,
    e.kind,
    e.content,
    e.metadata,
    1 - (e.embedding <=> query_embedding) as similarity
  from public.memory_embeddings e
  where e.user_id = (select auth.uid())
    and e.embedding is not null
  order by e.embedding <=> query_embedding
  limit greatest(1, match_count);
$$;
