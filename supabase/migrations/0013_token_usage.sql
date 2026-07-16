-- Self-logged LLM / embedding usage. Providers don't expose remaining free-tier
-- quota, so we record our own consumption (exact where the provider returns it,
-- otherwise estimated from text length) and compare to published free limits in
-- the admin usage panel. Run after 0001.

create table if not exists public.token_usage (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users (id) on delete cascade,
  provider          text not null,             -- 'gemini' | 'nvidia-qwen' | 'groq' | 'jina' | ...
  kind              text not null,             -- 'chat' | 'talk' | 'correction' | 'embedding' | ...
  prompt_tokens     int not null default 0,
  completion_tokens int not null default 0,
  total_tokens      int not null default 0,
  estimated         boolean not null default true,
  day               date not null default current_date,
  created_at        timestamptz not null default now()
);

create index if not exists idx_token_usage_provider_day on public.token_usage (provider, day);
create index if not exists idx_token_usage_day on public.token_usage (day desc);

alter table public.token_usage enable row level security;

-- Users may only write their own rows. Reads for the admin panel go through the
-- service-role client (bypasses RLS) after an admin-email check in the route.
drop policy if exists "token_usage_insert_own" on public.token_usage;
create policy "token_usage_insert_own" on public.token_usage
  for insert with check (user_id = (select auth.uid()));

drop policy if exists "token_usage_select_own" on public.token_usage;
create policy "token_usage_select_own" on public.token_usage
  for select using (user_id = (select auth.uid()));
