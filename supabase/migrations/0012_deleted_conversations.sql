-- Soft-delete archive for conversations. When a user deletes a chat, we snapshot
-- the whole thing (conversation + messages + corrections) into this table, then
-- hard-delete it from the live tables. Keeps the main app clean while preserving
-- deleted chats for later reference/analysis. Run after 0001.

create table if not exists public.deleted_conversations (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  original_id uuid,
  title       text,
  data        jsonb not null default '{}'::jsonb, -- { conversation, messages }
  deleted_at  timestamptz not null default now()
);

create index if not exists idx_deleted_conversations_user
  on public.deleted_conversations (user_id, deleted_at desc);

alter table public.deleted_conversations enable row level security;

drop policy if exists "deleted_conversations_all_own" on public.deleted_conversations;
create policy "deleted_conversations_all_own" on public.deleted_conversations
  for all using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
