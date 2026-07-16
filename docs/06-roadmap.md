# Development Roadmap

_Phase 0 document · Last updated: 2026-07-15 · Status: DRAFT for approval_

Built like a small software team: phase by phase, small commits, each feature tested and
documented. Milestones are ordered so you always have a runnable app.

## Phase 0 — Planning (this) ✅ pending your approval

Deliverables (all in `docs/`): overview & requirements, architecture & stack, DB schema/ERD,
API design, folder structure, this roadmap, README. **Exit criteria:** you approve the stack,
schema, and roadmap. No app code until then.

## V1 — MVP milestones

Each milestone ends green (typecheck + lint + tests pass) and is committed.

**M1 — Project skeleton & config**
Next.js + TypeScript + Tailwind + shadcn/ui; ESLint/Prettier; Vitest + Playwright configured;
Zod env loader; DI container stub; CI workflow (typecheck/lint/test); PWA manifest + service
worker shell. _Acceptance:_ app boots, CI green, installable shell on Android.

**M2 — Auth & data layer**
Supabase project; Drizzle schema + migrations; RLS policies; `profiles` trigger; sign-up /
sign-in / sign-out; protected `(app)` layout. _Acceptance:_ two users can register and only
see their own (empty) data.

**M3 — LLM router with failover**
`LlmProvider` port + Gemini/NVIDIA-Qwen/NVIDIA-Gemma/Groq adapters; router with quota
tracking + backoff; `/api/health`. _Acceptance:_ unit tests prove failover when provider #1
throws quota error; health endpoint reports provider state.

**M4 — Conversation core (text)**
Conversation list/create; `POST …/messages` streaming; tutor system prompt with level
context; persist messages + structured correction; conversation screen with streaming
bubbles + correction card + translation toggle. _Acceptance:_ FR-3, FR-5, FR-6, FR-7, FR-10
demonstrably work by typing.

**M5 — Voice**
Web Speech STT (mic → text) and TTS (spoken replies) behind `SpeechPort`; mic button UI;
voice on/off setting. _Acceptance:_ FR-4 works on Android Chrome over HTTPS.

**M6 — Progress, settings, offline, polish**
Dashboard (daily goal + stats + streak seed); settings (theme, voice, difficulty, goal);
IndexedDB read cache for offline history; loading/error states; animations. _Acceptance:_
FR-8, FR-9, FR-11; Playwright e2e (sign in → send → reply) green.

**M7 — Deploy**
Vercel project + env vars; production build; install as PWA on your Android; smoke test.
_Acceptance:_ full V1 flow works from your phone over HTTPS.

**V1 Definition of Done:** FR-1…FR-11 met, NFR-1…NFR-6 met, deployed, tests green, docs updated.

## V2 — Practice depth (post-V1)

Pronunciation scoring; word/grammar difficulty tagging; spaced-repetition flashcards (SM-2);
bookmarks/favourites; conversation categories + roleplay; daily challenges, weekly progress,
achievements, streaks; push notifications; AI lesson/exercise generator (listening/reading/
speaking/writing, quizzes, sentence builder); offline write-sync queue.

## V3 — Adaptive AI teacher ✅ implemented

**Hybrid memory (structured + semantic).**

- **Structured** (`learner_memory`, migration 0010): aggregated live from mistakes, completed
  lessons, category usage and review grades into weak grammar, mastered/favourite topics,
  confidence (0–1) and learning speed. Pure logic in `core/application/use-cases/memory.ts`
  (unit-tested).
- **Semantic** (`memory_embeddings`, pgvector): each mistake is embedded with **Jina**
  (`jina-embeddings-v3`, 1024-dim) and recalled by cosine similarity via the
  `match_learner_memory` RPC. Optional — with no `JINA_API_KEY` the app degrades cleanly to
  structured-only (a `NullEmbeddingProvider` is wired instead of the Jina adapter).

**What adapts.**

- **Maestro persona + memory-aware prompt:** the tutor holds a real back-and-forth, reacts
  instantly and firmly to mistakes (intensity scales with the difficulty setting — never
  demeaning), corrects facts, reinforces weak spots, leans on favourite topics and skips
  mastered material. Recently-struggled snippets are injected via semantic recall.
- **Adaptive lesson recommendations:** weakness-targeted "Recommended for you" in Learn and on
  the dashboard (`recommendLessons`).
- **Adaptive review:** words captured from real conversation mistakes are prioritized in the
  Review deck and badged "from your mistakes".
- **Insights panel:** dashboard card with confidence, pace, weak spots, mastered topics and
  recommendations (`GET /api/memory`).

**Update timing:** live after each chat turn (best-effort; never blocks the reply). Structured
memory is recomputed and the mistake is embedded in parallel.

Setup: run `supabase/migrations/0010_v3_memory.sql` and (optionally) set `JINA_API_KEY` —
see `docs/08-deploy-guide.md`.

## Working agreement

- **Branching:** short-lived feature branches → PR → CI must pass → merge to `main` (Vercel auto-deploys). Conventional Commits.
- **Every feature:** before → simple/production/enterprise choice offered + recommendation; after → what we built, why, how it works, what could improve, next step.
- **Tests:** domain/application unit-tested; one e2e for the critical path; router failover always tested.
- **No secrets in git;** `.env.example` documents required vars.

## Suggested next step after approval

Start **M1 (project skeleton & config)** — I'll present the simple/production/enterprise
options for the initial setup, recommend one, and wait for your go-ahead before generating code.
