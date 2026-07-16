-- Remove duplicate flashcards and prevent future dupes (one card per vocab item
-- per user). Keeps the most-progressed card. Run after 0008. Safe to re-run.

-- 1) Delete duplicates, keeping the card with the most review progress.
delete from public.flashcards f
using (
  select
    id,
    row_number() over (
      partition by user_id, vocabulary_item_id
      order by repetitions desc, due_at asc, id asc
    ) as rn
  from public.flashcards
) d
where f.id = d.id
  and d.rn > 1;

-- 2) Enforce one flashcard per (user, vocabulary item) going forward.
create unique index if not exists uq_flashcards_user_vocab
  on public.flashcards (user_id, vocabulary_item_id);
