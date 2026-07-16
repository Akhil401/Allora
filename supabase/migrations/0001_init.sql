-- AI Tutor — initial schema, RLS, trigger, seeds.
-- Run this once in the Supabase SQL Editor (or via `supabase db push`).
-- Mirrors src/infrastructure/db/schema.ts. Idempotent-ish: safe to re-run after
-- a fresh project (uses IF NOT EXISTS where practical).

-- ─────────────────────────────────────────────────────────────
-- Tables
-- ─────────────────────────────────────────────────────────────

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  native_language text not null default 'en',
  target_language text not null default 'it',
  cefr_level text not null default 'A1',
  created_at timestamptz not null default now()
);

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title_en text not null,
  title_it text not null,
  is_roleplay boolean not null default false
);

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  category_id uuid references public.categories (id) on delete set null,
  title text not null default 'Nuova conversazione',
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null,
  content_it text not null,
  content_en text,
  audio_source text not null default 'text',
  provider_used text,
  created_at timestamptz not null default now()
);

create table if not exists public.corrections (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.messages (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  original_text text not null,
  corrected_text text not null,
  explanation_en text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.mistakes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  correction_id uuid not null references public.corrections (id) on delete cascade,
  error_type text not null,
  detail_en text not null,
  severity text not null default 'low',
  created_at timestamptz not null default now()
);

create table if not exists public.vocabulary_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  source_message_id uuid references public.messages (id) on delete set null,
  term_it text not null,
  term_en text not null,
  part_of_speech text,
  difficulty text default 'medium',
  is_bookmarked boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.flashcards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  vocabulary_item_id uuid not null references public.vocabulary_items (id) on delete cascade,
  ease_factor integer not null default 250,
  interval_days integer not null default 0,
  repetitions integer not null default 0,
  due_at timestamptz not null default now()
);

create table if not exists public.daily_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  day date not null,
  messages_count integer not null default 0,
  minutes_practiced integer not null default 0,
  goal_minutes integer not null default 10,
  goal_met boolean not null default false,
  constraint daily_progress_user_day unique (user_id, day)
);

create table if not exists public.achievements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  code text not null,
  earned_at timestamptz not null default now()
);

create table if not exists public.settings (
  user_id uuid primary key references auth.users (id) on delete cascade,
  theme text not null default 'system',
  voice_output_enabled boolean not null default true,
  tutor_difficulty text not null default 'normal',
  daily_goal_minutes integer not null default 10
);

create table if not exists public.learner_memory (
  user_id uuid primary key references auth.users (id) on delete cascade,
  mastered_topics jsonb not null default '[]'::jsonb,
  weak_grammar jsonb not null default '[]'::jsonb,
  weak_pronunciation jsonb not null default '[]'::jsonb,
  favorite_topics jsonb not null default '[]'::jsonb,
  confidence numeric not null default 0,
  learning_speed text not null default 'normal',
  updated_at timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────
-- Indexes
-- ─────────────────────────────────────────────────────────────
create index if not exists idx_conversations_user_updated
  on public.conversations (user_id, updated_at desc);
create index if not exists idx_messages_conversation_created
  on public.messages (conversation_id, created_at);
create index if not exists idx_mistakes_user_type
  on public.mistakes (user_id, error_type);
create index if not exists idx_flashcards_user_due
  on public.flashcards (user_id, due_at);

-- ─────────────────────────────────────────────────────────────
-- Row-Level Security
-- ─────────────────────────────────────────────────────────────
alter table public.profiles          enable row level security;
alter table public.conversations     enable row level security;
alter table public.messages          enable row level security;
alter table public.corrections       enable row level security;
alter table public.mistakes          enable row level security;
alter table public.vocabulary_items  enable row level security;
alter table public.flashcards        enable row level security;
alter table public.daily_progress    enable row level security;
alter table public.achievements      enable row level security;
alter table public.settings          enable row level security;
alter table public.learner_memory    enable row level security;
alter table public.categories        enable row level security;

-- profiles: row is keyed by id = auth.uid()
create policy "profiles_select_own" on public.profiles
  for select using (id = (select auth.uid()));
create policy "profiles_modify_own" on public.profiles
  for update using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- Helper: for every user-owned table, "own rows" via user_id = auth.uid().
-- (Written explicitly per table for clarity/auditability.)
create policy "conversations_all_own" on public.conversations
  for all using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "messages_all_own" on public.messages
  for all using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "corrections_all_own" on public.corrections
  for all using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "mistakes_all_own" on public.mistakes
  for all using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "vocabulary_all_own" on public.vocabulary_items
  for all using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "flashcards_all_own" on public.flashcards
  for all using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "daily_progress_all_own" on public.daily_progress
  for all using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "achievements_all_own" on public.achievements
  for all using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "settings_all_own" on public.settings
  for all using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "learner_memory_all_own" on public.learner_memory
  for all using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- categories: read-only reference data for any authenticated user
create policy "categories_read" on public.categories
  for select to authenticated using (true);

-- ─────────────────────────────────────────────────────────────
-- Trigger: provision profile + settings + memory on new auth user
-- ─────────────────────────────────────────────────────────────
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
    values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)))
    on conflict (id) do nothing;
  insert into public.settings (user_id) values (new.id) on conflict (user_id) do nothing;
  insert into public.learner_memory (user_id) values (new.id) on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ─────────────────────────────────────────────────────────────
-- Seed: conversation categories (V2 uses these; safe to seed now)
-- ─────────────────────────────────────────────────────────────
insert into public.categories (slug, title_en, title_it, is_roleplay) values
  ('free-talk',  'Free talk',      'Conversazione libera', false),
  ('restaurant', 'Restaurant',     'Ristorante',           true),
  ('airport',    'Airport',        'Aeroporto',            true),
  ('hotel',      'Hotel',          'Hotel',                true),
  ('travel',     'Travel',         'Viaggi',               true),
  ('shopping',   'Shopping',       'Shopping',             true),
  ('business',   'Business',       'Lavoro',               true),
  ('doctor',     'Doctor',         'Dal medico',           true),
  ('dating',     'Dating',         'Appuntamenti',         true),
  ('interview',  'Job interview',  'Colloquio di lavoro',  true)
on conflict (slug) do nothing;
