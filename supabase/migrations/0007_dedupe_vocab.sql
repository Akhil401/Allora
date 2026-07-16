-- Remove duplicate vocabulary and prevent future dupes.
-- Keeps the OLDEST row per (user, case-insensitive term); cascades remove the
-- extra flashcards automatically. Run after 0006. Safe to re-run.

-- 1) Delete duplicates, keeping the earliest per user + normalized term.
delete from public.vocabulary_items v
using (
  select
    id,
    row_number() over (
      partition by user_id, lower(btrim(term_it))
      order by created_at asc, id asc
    ) as rn
  from public.vocabulary_items
) d
where v.id = d.id
  and d.rn > 1;

-- 2) Enforce uniqueness going forward (per user, case- and space-insensitive).
create unique index if not exists uq_vocab_user_term
  on public.vocabulary_items (user_id, lower(btrim(term_it)));
