-- V2: make achievement awards idempotent (one row per user per code).
-- Run after 0002. Safe to re-run.

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'achievements_user_code'
  ) then
    alter table public.achievements
      add constraint achievements_user_code unique (user_id, code);
  end if;
end $$;
