# Folder Structure

_Phase 0 document · Last updated: 2026-07-15 · Status: DRAFT for approval_

Next.js App Router, organised by **Clean Architecture layers + feature modules**. The
`src/core` layer is framework-agnostic (domain + application + ports); `src/infrastructure`
holds adapters; `app/` is presentation + BFF.

```
pingo_ai/
├─ app/                                  # Next.js App Router (presentation + BFF)
│  ├─ (auth)/
│  │  ├─ sign-in/page.tsx
│  │  └─ sign-up/page.tsx
│  ├─ (app)/                             # authenticated area (layout guards session)
│  │  ├─ layout.tsx
│  │  ├─ dashboard/page.tsx              # daily goal + stats
│  │  ├─ conversations/
│  │  │  ├─ page.tsx                     # list
│  │  │  └─ [id]/page.tsx                # conversation + mic + corrections
│  │  └─ settings/page.tsx
│  ├─ api/                               # Route Handlers (BFF)
│  │  ├─ conversations/route.ts
│  │  ├─ conversations/[id]/route.ts
│  │  ├─ conversations/[id]/messages/route.ts   # streaming tutor endpoint
│  │  ├─ messages/[id]/translate/route.ts
│  │  ├─ progress/today/route.ts
│  │  ├─ settings/route.ts
│  │  └─ health/route.ts
│  ├─ layout.tsx                         # root: theme provider, fonts
│  ├─ manifest.ts                        # PWA manifest
│  └─ globals.css
│
├─ src/
│  ├─ core/                              # framework-agnostic (no Next/Supabase imports)
│  │  ├─ domain/
│  │  │  ├─ entities/                    # Conversation, Message, Correction, Mistake, ...
│  │  │  ├─ value-objects/               # CefrLevel, ErrorType, ...
│  │  │  └─ errors/                      # DomainError, RateLimitError, QuotaExceededError
│  │  ├─ application/
│  │  │  ├─ ports/                       # interfaces: LlmProvider, LlmRouter,
│  │  │  │                               #   ConversationRepository, SpeechPort, CachePort
│  │  │  └─ use-cases/                   # SendTutorMessage, CorrectText, TranslateMessage,
│  │  │                                  #   GetTodayProgress, UpdateSettings
│  │  └─ prompts/                        # tutor system prompt builders (context injection)
│  │
│  ├─ infrastructure/                    # adapters implementing ports
│  │  ├─ llm/
│  │  │  ├─ router.ts                    # failover + quota/backoff
│  │  │  ├─ providers/gemini.ts
│  │  │  ├─ providers/nvidia-qwen.ts
│  │  │  ├─ providers/nvidia-gemma.ts
│  │  │  └─ providers/groq.ts            # extra fallback
│  │  ├─ db/
│  │  │  ├─ schema.ts                    # Drizzle schema
│  │  │  ├─ client.ts                    # Supabase server/client factories
│  │  │  ├─ migrations/                  # generated SQL + RLS policies + seeds
│  │  │  └─ repositories/                # SupabaseConversationRepository, ...
│  │  ├─ speech/
│  │  │  ├─ web-speech-stt.ts            # SpeechRecognition wrapper (client)
│  │  │  └─ web-speech-tts.ts            # SpeechSynthesis wrapper (client)
│  │  └─ cache/indexeddb.ts             # Dexie offline cache
│  │
│  ├─ presentation/                      # reusable UI (not routes)
│  │  ├─ components/ui/                  # shadcn/ui primitives
│  │  ├─ components/                     # ChatBubble, MicButton, CorrectionCard, StatCard
│  │  ├─ hooks/                          # useTutorStream, useSpeech, useTheme
│  │  └─ stores/                         # Zustand: theme, voice toggle
│  │
│  ├─ lib/
│  │  ├─ config/env.ts                   # Zod-validated env loader (fail fast)
│  │  ├─ validation/                     # shared Zod schemas (CorrectionObject, DTOs)
│  │  ├─ http/problem.ts                 # error → problem-response mapper
│  │  └─ logger.ts                       # structured logging (no secrets)
│  └─ di/container.ts                    # composition root: wires ports → adapters
│
├─ tests/
│  ├─ unit/                              # Vitest: use-cases, router failover, prompts
│  └─ e2e/                               # Playwright: sign-in → send message → reply
│
├─ public/                              # icons, PWA assets
├─ .github/workflows/ci.yml             # typecheck + lint + test
├─ drizzle.config.ts
├─ .env.example                          # documents required vars (no secrets)
├─ .env.local                           # real secrets (gitignored)
├─ next.config.ts
├─ tailwind.config.ts
├─ package.json
├─ README.md
└─ docs/                                 # these Phase 0 documents
```

## Why this layout

- **`src/core` has zero framework imports** — pure TypeScript, trivially unit-testable, and portable if Next.js or Supabase is ever swapped. Use cases depend only on **ports** (interfaces).
- **`src/infrastructure` implements the ports** — Gemini/NVIDIA adapters, Supabase repositories, Web Speech wrappers, IndexedDB cache. Swap an adapter without touching a use case.
- **`app/` is thin** — Route Handlers validate input, resolve the session, call a use case from the DI container, and shape the response. No business logic in route files.
- **`src/di/container.ts` is the composition root** — the one place that knows concrete classes; everything else receives interfaces (dependency inversion → testable).
- **Feature grouping inside `app/(app)/`** keeps screens cohesive while shared UI lives in `src/presentation`.

## Naming & conventions

- Files: `kebab-case.ts`; React components: `PascalCase.tsx`; hooks: `useX.ts`.
- One public export per domain/use-case file; interfaces in `ports/` are the contract surface.
- No secrets in code — only `src/lib/config/env.ts` reads `process.env`, validated by Zod.
