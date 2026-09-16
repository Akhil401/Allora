-- Live rate-limit snapshot per LLM provider, captured from the x-ratelimit-*
-- response headers that Groq / Cerebras (OpenAI-compatible) return on every call.
-- One row per provider, upserted on each request with the newest numbers, so the
-- admin panel can show "requests left today / tokens left this minute" instead of
-- only our own estimates. Providers that don't send these headers (Gemini,
-- NVIDIA) simply never get a row. Run after 0013.

create table if not exists public.provider_rate_limits (
  provider            text primary key,          -- 'groq' | 'cerebras' | ...
  remaining_requests  bigint,                    -- requests left in the request window
  limit_requests      bigint,                    -- request-window cap
  remaining_tokens    bigint,                    -- tokens left in the token window
  limit_tokens        bigint,                    -- token-window cap
  reset_requests      text,                      -- when the request window resets (provider string, e.g. '2m30s')
  reset_tokens        text,                      -- when the token window resets
  updated_at          timestamptz not null default now()
);

alter table public.provider_rate_limits enable row level security;

-- Any signed-in member may write the latest snapshot (shared, low-sensitivity,
-- provider-level data — not per-user). Reads for the admin panel go through the
-- service-role client after an admin-email check in the route.
drop policy if exists "prl_insert" on public.provider_rate_limits;
create policy "prl_insert" on public.provider_rate_limits
  for insert with check ((select auth.uid()) is not null);

drop policy if exists "prl_update" on public.provider_rate_limits;
create policy "prl_update" on public.provider_rate_limits
  for update using ((select auth.uid()) is not null);
