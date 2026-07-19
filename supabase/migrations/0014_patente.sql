-- Patente (Italian driving-licence theory) module.
-- `patente_questions` is a shared, read-only bank (imported once via the service
-- role from the open ministry-mirror dataset). `patente_attempts` logs each
-- user's answers for progress + mistakes review. Run after 0001.

create table if not exists public.patente_questions (
  id         uuid primary key default gen_random_uuid(),
  ext_id     text unique,                 -- source id, for idempotent re-import
  topic      text not null,               -- argomento
  text_it    text not null,               -- the true/false statement
  correct    boolean not null,            -- true = "Vero"
  image      text,                        -- image URL (road sign), if any
  source     text not null default 'ministeriale',
  created_at timestamptz not null default now()
);

create index if not exists idx_patente_questions_topic on public.patente_questions (topic);

alter table public.patente_questions enable row level security;

-- Any signed-in user can read the bank; nobody writes via the anon/user role
-- (the import uses the service role, which bypasses RLS).
drop policy if exists "patente_questions_read" on public.patente_questions;
create policy "patente_questions_read" on public.patente_questions
  for select using ((select auth.uid()) is not null);

create table if not exists public.patente_attempts (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  question_id uuid not null references public.patente_questions (id) on delete cascade,
  topic       text not null,
  kind        text not null default 'practice',  -- 'practice' | 'exam'
  chosen      boolean not null,
  correct     boolean not null,
  created_at  timestamptz not null default now()
);

create index if not exists idx_patente_attempts_user on public.patente_attempts (user_id, created_at desc);
create index if not exists idx_patente_attempts_user_topic on public.patente_attempts (user_id, topic);

alter table public.patente_attempts enable row level security;

drop policy if exists "patente_attempts_all_own" on public.patente_attempts;
create policy "patente_attempts_all_own" on public.patente_attempts
  for all using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- ─────────────────────────────────────────────────────────────
-- Helper RPCs (public bank → SECURITY DEFINER; only read questions)
-- ─────────────────────────────────────────────────────────────
create or replace function public.patente_topics()
returns table (topic text, count bigint)
language sql stable security definer set search_path = public
as $$
  select topic, count(*)::bigint as count
  from public.patente_questions
  group by topic
  order by topic;
$$;
grant execute on function public.patente_topics() to authenticated;

create or replace function public.patente_random_by_topic(p_topic text, p_limit int default 20)
returns setof public.patente_questions
language sql stable security definer set search_path = public
as $$
  select * from public.patente_questions
  where topic = p_topic
  order by random()
  limit greatest(1, p_limit);
$$;
grant execute on function public.patente_random_by_topic(text, int) to authenticated;

create or replace function public.patente_exam_set(p_limit int default 30)
returns setof public.patente_questions
language sql stable security definer set search_path = public
as $$
  select * from public.patente_questions
  order by random()
  limit greatest(1, p_limit);
$$;
grant execute on function public.patente_exam_set(int) to authenticated;
