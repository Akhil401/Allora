-- Cache patente question translations so they're saved once and reused (no
-- repeat LLM calls). Shared across users, keyed by question. Run after 0014.

create table if not exists public.patente_translations (
  question_id uuid primary key references public.patente_questions (id) on delete cascade,
  translation text not null,
  explanation text,
  created_at  timestamptz not null default now()
);

alter table public.patente_translations enable row level security;

drop policy if exists "patente_translations_read" on public.patente_translations;
create policy "patente_translations_read" on public.patente_translations
  for select using ((select auth.uid()) is not null);

drop policy if exists "patente_translations_insert" on public.patente_translations;
create policy "patente_translations_insert" on public.patente_translations
  for insert with check ((select auth.uid()) is not null);
