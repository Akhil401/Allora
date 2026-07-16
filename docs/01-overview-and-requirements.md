# AI Tutor Replica — Project Overview & Requirements

_Phase 0 document · Last updated: 2026-07-15 · Status: DRAFT for approval_

---

## 1. Vision

An AI-powered Italian language tutor (English → Italian) for personal and small-group
use (2–3 members). It should feel like AI Tutor / Speak AI: you hold a spoken
conversation with an AI tutor, get grammar and pronunciation feedback, and the app
tracks what you've learned and adapts over time.

Delivered as a **Next.js full-stack Progressive Web App (PWA)**, installable on an
Android phone, running on free-tier infrastructure.

## 2. Goals & non-goals

**Goals**

- Real spoken conversation practice with an AI Italian tutor.
- Corrective feedback: grammar, vocabulary, sentence structure, pronunciation.
- Progress tracking that drives adaptive lessons (the app gets more useful the more you use it).
- Production-quality architecture (Clean Architecture, typed contracts, tests, CI/CD) even though it's personal.
- Stay effectively free (LLM failover across free providers; free hosting + DB).

**Non-goals (for now)**

- App-store distribution (PWA install is enough).
- iOS as a first-class target (Android Chrome is primary; keep code portable).
- Massive scale / many concurrent users (designed for a handful).

## 3. Target users (personas)

| Persona            | Description                                           | Primary need                                        |
| ------------------ | ----------------------------------------------------- | --------------------------------------------------- |
| **Akhil (owner)**  | Fullstack engineer, English speaker learning Italian. | Daily conversational practice + grammar correction. |
| **Invited member** | 1–2 friends/family also learning Italian.             | Own account, own progress, isolated data.           |

Auth is required because data must be isolated per user (Supabase Auth + Row-Level Security).

## 4. The AI tutor — behavioural contract

The tutor behaves like an experienced Italian teacher:

- **Speaks Italian** at the learner's level; explains mistakes **in English**.
- **Corrects** grammar, word choice, sentence structure, and (V2+) pronunciation.
- **Explains _why_** an answer is wrong and guides — does not just hand over the answer.
- **Encourages** and keeps difficulty appropriate to the learner's tracked level.
- **Adapts** (V3): reinforces weak areas, skips mastered ones, uses topics the learner likes.

This contract is enforced through system-prompt engineering + injected learner context
(level, recent mistakes, mastered items, preferred topics). See `02-architecture-and-stack.md`.

## 5. Scope by version

### V1 — MVP (conversational tutor that works end-to-end)

Functional:

- Auth (sign up / sign in / sign out) for 2–3 members; per-user data isolation.
- Home / learning dashboard with daily goal and basic stats.
- Conversation screen: text + **microphone** input (Web Speech STT) and **spoken** tutor replies (Web Speech TTS).
- AI tutor chat with the behavioural contract above, powered by the multi-provider LLM router with failover.
- Correction view: grammar correction, vocabulary explanation, English translation of Italian.
- Conversation history (persisted, per user).
- Progress tracking: daily goal, streak seed, basic learning statistics.
- Settings: light/dark mode, voice on/off, tutor difficulty.
- Offline cache of prior conversations; graceful loading & error states.

Non-functional:

- Clean Architecture (domain / application / infrastructure / presentation), Repository pattern, DI.
- Typed end-to-end (TypeScript + Zod validation at boundaries).
- Secrets in env vars only; never shipped to the client.
- Unit tests (Vitest) for domain/application logic; one happy-path e2e (Playwright).
- Installable PWA over HTTPS (Vercel).

### V2 — Practice depth

Pronunciation analysis & score; word/grammar difficulty tagging; vocabulary review with
**spaced repetition** flashcards; bookmarks/favourite words; conversation **categories**
(restaurant, airport, hotel, travel, shopping, business, doctor, dating, interview, roleplay…);
daily challenges, weekly progress, achievements, streaks; push notifications;
AI lesson/exercise generator (listening/reading/speaking/writing, quizzes, sentence builder).

### V3 — Adaptive AI teacher (persistent memory)

Long-term learner memory: words learned, grammar/pronunciation weaknesses, favourite
topics, past conversations, confidence level, learning speed, difficulty. AI auto-adapts
lessons (e.g. more past-tense drills for a weak learner; football dialogues for a football fan;
never re-teaches mastered greetings).

## 6. Functional requirements (V1, testable)

| ID    | Requirement                                                                                      |
| ----- | ------------------------------------------------------------------------------------------------ |
| FR-1  | A user can create an account and sign in/out.                                                    |
| FR-2  | A signed-in user only ever sees their own conversations and progress.                            |
| FR-3  | A user can start a conversation and send a message by typing.                                    |
| FR-4  | A user can send a message by voice; speech is transcribed to Italian/English text.               |
| FR-5  | The tutor replies in Italian at the user's level and can speak the reply aloud.                  |
| FR-6  | The tutor detects mistakes and produces a correction (grammar + explanation in English).         |
| FR-7  | A user can view an English translation of any Italian tutor message.                             |
| FR-8  | Conversations are saved and reloadable, including offline (cached).                              |
| FR-9  | A daily goal + basic stats (messages, minutes, streak) are visible on the dashboard.             |
| FR-10 | If the primary LLM fails/rate-limits, the request transparently falls back to the next provider. |
| FR-11 | A user can toggle light/dark mode and voice output.                                              |

## 7. Non-functional requirements

| ID    | Requirement                                                                           |
| ----- | ------------------------------------------------------------------------------------- |
| NFR-1 | Mic + speech require HTTPS; app is served over HTTPS (Vercel) or localhost in dev.    |
| NFR-2 | No secret/API key is ever exposed to the browser; all provider calls are server-side. |
| NFR-3 | LLM cost stays within free tiers via provider failover + quota tracking.              |
| NFR-4 | First tutor token appears quickly; responses stream to the UI.                        |
| NFR-5 | Domain + application layers are unit-tested; provider router has failover tests.      |
| NFR-6 | Codebase follows SOLID/DRY/KISS; no hardcoded config; typed boundaries with Zod.      |

## 8. Key risks & mitigations

| Risk                                  | Mitigation                                                                                                                 |
| ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Mic silently fails on phone over HTTP | Serve over HTTPS (Vercel); document the secure-context rule.                                                               |
| Free LLM quotas exhausted             | Router with ordered failover across Gemini → NVIDIA NIM (Qwen, Gemma) → extra free fallbacks + per-provider quota/backoff. |
| iOS Safari STT weakness               | Android is primary; keep STT behind an interface for a future Whisper fallback.                                            |
| Browser data cleared → progress lost  | Server-side source of truth in Supabase Postgres; IndexedDB is only a cache.                                               |
| Vendor lock-in (Supabase)             | Drizzle schema in code; repository layer isolates DB access.                                                               |

## 9. Locked decisions (summary)

See `02-architecture-and-stack.md` for full rationale.

- **Client/runtime:** Next.js (App Router) full-stack PWA · **Host:** Vercel (Cloudflare Pages alt) · **Target:** Android Chrome.
- **LLM:** Multi-provider router with failover — Gemini (Google key) → NVIDIA NIM (Qwen) → NVIDIA NIM (Gemma) → Groq/OpenRouter (extra).
- **Speech:** Web Speech API — `SpeechRecognition` (STT) + `SpeechSynthesis` (TTS).
- **DB + Auth:** Supabase (Postgres + Auth + RLS) · **ORM:** Drizzle.
- **UI:** Tailwind + shadcn/ui · **Validation:** Zod · **State/data:** TanStack Query + Zustand.
- **Testing:** Vitest + Playwright · **CI/CD:** GitHub Actions + Vercel.
