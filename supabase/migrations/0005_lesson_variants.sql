-- Lesson variants: allow up to 3 cached versions per lesson (variant 0 =
-- original, 1 & 2 = extra AI-generated angles). Shared cache → each generated
-- once ever. Run after 0004. Safe to re-run.

do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'lesson_content' and column_name = 'variant'
  ) then
    alter table public.lesson_content add column variant int not null default 0;
  end if;
end $$;

-- Move the primary key from (lesson_id) to (lesson_id, variant).
do $$
begin
  if exists (select 1 from pg_constraint where conname = 'lesson_content_pkey') then
    alter table public.lesson_content drop constraint lesson_content_pkey;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'lesson_content_pk') then
    alter table public.lesson_content add constraint lesson_content_pk primary key (lesson_id, variant);
  end if;
end $$;
