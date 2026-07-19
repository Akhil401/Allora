-- Patente theory: a shared, generate-once study guide per topic (like lesson
-- content caching). Written the first time a user opens a topic, then reused by
-- everyone. Run after 0014.

create table if not exists public.patente_theory (
  topic      text primary key,
  content    text not null,
  created_at timestamptz not null default now()
);

alter table public.patente_theory enable row level security;

-- Any signed-in user may read the shared guides and write a newly-generated one.
drop policy if exists "patente_theory_read" on public.patente_theory;
create policy "patente_theory_read" on public.patente_theory
  for select using ((select auth.uid()) is not null);

drop policy if exists "patente_theory_insert" on public.patente_theory;
create policy "patente_theory_insert" on public.patente_theory
  for insert with check ((select auth.uid()) is not null);
