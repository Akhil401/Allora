-- Review history: one row per flashcard review (for the day-wise history view).
-- Stores a snapshot of the term so history survives if the vocab is deleted.
-- Run after 0007. Safe to re-run.

create table if not exists public.review_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  vocabulary_item_id uuid references public.vocabulary_items (id) on delete set null,
  term_it text not null,
  term_en text not null,
  grade text not null,
  reviewed_at timestamptz not null default now()
);

alter table public.review_logs enable row level security;
create policy "review_logs_all_own" on public.review_logs
  for all using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create index if not exists idx_review_logs_user_time
  on public.review_logs (user_id, reviewed_at desc);
