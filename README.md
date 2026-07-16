# AI Tutor Replica — AI Italian Tutor

A personal, AI-powered Italian language tutor (English → Italian) for a small group (2–3 members),
built as a **Next.js full-stack PWA** on free-tier infrastructure. Spoken conversation practice
with grammar/pronunciation feedback and adaptive progress tracking.

> **Status:** V1 (MVP) code complete. Configure Supabase + LLM keys and run — see
> [docs/08-deploy-guide.md](docs/08-deploy-guide.md).

## Stack

| Concern             | Choice                                                                                 |
| ------------------- | -------------------------------------------------------------------------------------- |
| Client / runtime    | Next.js 15 (App Router) full-stack PWA + React 19                                      |
| Hosting             | Vercel (HTTPS) — Cloudflare Pages / tunnel alternative                                 |
| Target device       | Android Chrome                                                                         |
| AI (LLM)            | Multi-provider failover router: Gemini → NVIDIA NIM (Qwen) → NVIDIA NIM (Gemma) → Groq |
| Speech              | Web Speech API — `SpeechRecognition` (STT) + `SpeechSynthesis` (TTS)                   |
| Database + Auth     | Supabase (Postgres + Auth + Row-Level Security)                                        |
| ORM / schema        | Drizzle (types + migrations); queries via Supabase client (RLS-safe)                   |
| UI                  | Tailwind CSS + shadcn-compatible tokens                                                |
| Validation          | Zod (all boundaries + LLM output)                                                      |
| Client state / data | TanStack Query + Zustand                                                               |
| Testing             | Vitest (unit) + Playwright (e2e)                                                       |
| CI/CD               | GitHub Actions + Vercel                                                                |

## What V1 does

Sign up / sign in (per-user isolation via RLS) → dashboard with daily goal, streak and stats →
conversations list → live chat with the AI tutor: **type or speak** Italian, get a **streamed
spoken reply**, a **grammar correction with English explanation**, and **on-demand translation**.
Settings for theme, tutor voice, level, difficulty and daily goal. Offline read-cache + PWA install.

## Run it

```powershell
cd D:\new\pingo_ai
npm install
# configure .env.local (see docs/08-deploy-guide.md), then:
npm run dev
```

Quality gates: `npm run typecheck`, `npm run lint`, `npm run test`, `npm run build`.

## Documentation

| Doc                                                                  | Contents                                                         |
| -------------------------------------------------------------------- | ---------------------------------------------------------------- |
| [01 — Overview & Requirements](docs/01-overview-and-requirements.md) | Vision, personas, tutor contract, scope, requirements.           |
| [02 — Architecture & Stack](docs/02-architecture-and-stack.md)       | Clean Architecture, diagrams, LLM router, flows, security, ADRs. |
| [03 — Database Schema & ERD](docs/03-database-schema.md)             | ERD, tables, RLS, indexing, migrations.                          |
| [04 — API Design](docs/04-api-design.md)                             | REST handlers, streaming tutor endpoint, error model.            |
| [05 — Folder Structure](docs/05-folder-structure.md)                 | Project layout + conventions.                                    |
| [06 — Roadmap](docs/06-roadmap.md)                                   | V1 milestones → V2 → V3.                                         |
| [07 — M1 Setup Guide](docs/07-m1-setup-guide.md)                     | Skeleton run notes.                                              |
| [08 — Deploy Guide](docs/08-deploy-guide.md)                         | **Supabase + Vercel setup, env vars, deploy.**                   |

## Key constraints

- **Mic needs HTTPS** (`getUserMedia`/Web Speech only work over HTTPS or `localhost`).
- **Secrets are server-only** — all LLM/DB calls run in Route Handlers; the browser only sees `NEXT_PUBLIC_*`.
- **Free by design** — the LLM router fails over across your free providers with per-provider cooldown.

## Project layout (top level)

```
app/            Next.js routes (auth, app area, API route handlers)
src/core/       domain + application (framework-agnostic, unit-tested)
src/infrastructure/  LLM adapters, Supabase repos, offline cache
src/presentation/    React components, hooks, stores
supabase/migrations/ SQL: schema + RLS + trigger + seeds + progress RPC
tests/          Vitest (unit) + Playwright (e2e)
docs/           the documents above
```
