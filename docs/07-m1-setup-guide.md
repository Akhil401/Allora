# M1 — Project Skeleton: Setup & Run Guide

_What was built in M1, and how to run it on your machine._

## What M1 delivers

A production-shaped, runnable Next.js skeleton — no features yet, but every seam
the roadmap needs is in place:

- **Next.js 15 (App Router) + React 19 + TypeScript (strict)** with `@/*` path aliases.
- **Tailwind + shadcn-compatible theme tokens** (light/dark via `.dark`) and a `cn()` helper.
- **App shell:** root layout with TanStack Query provider + service-worker registrar, a landing page, and an offline page.
- **Typed env loader** (`src/lib/config/env.ts`) — Zod-validated, server/client split, fail-fast.
- **Core ports + DI stub:** LLM port interfaces (`src/core/application/ports/llm.ts`), domain errors, and a composition root (`src/di/container.ts`) ready to wire adapters in M3/M4.
- **PWA shell:** `app/manifest.ts` + `public/sw.js` (network-first navigations, offline fallback).
- **Testing:** Vitest (unit, one passing sample) + Playwright (e2e smoke on a Pixel 7 profile).
- **CI:** GitHub Actions running typecheck → lint → unit tests → build on every PR.

## Prerequisites

- **Node.js 20+** and npm. Check: `node -v`.

## Run it (Windows / PowerShell)

```powershell
cd D:\new\pingo_ai
npm install
npm run dev
```

Open http://localhost:3000 — you should see the AI Tutor landing page. Toggle system
dark mode to see the theme tokens respond.

## Verify quality gates

```powershell
npm run typecheck   # tsc --noEmit, should pass clean
npm run lint        # next lint
npm run test        # vitest unit tests (domain-errors sample passes)
npm run build       # production build, succeeds with no .env
```

For the e2e smoke test (installs a browser the first time):

```powershell
npx playwright install
npm run test:e2e
```

## Environment variables

None are required to run M1. When we reach M2 (Supabase) and M3 (LLM), copy
`.env.example` → `.env.local` and fill in the relevant keys. The env loader marks
them optional for now and will promote them to required as each milestone lands.

## Testing on your Android phone

Local `next dev` over your LAN is **HTTP**, so the microphone will not work from the
phone yet (secure-context rule). Two options:

1. Wait for **M7 (deploy to Vercel)** — you'll get an HTTPS URL and can install the PWA.
2. Or run an HTTPS tunnel now: `npx cloudflared tunnel --url http://localhost:3000` and open the generated `https://…` URL on your phone.

## What's next — M2 (Auth & data layer)

Supabase project + Drizzle schema + migrations + RLS policies + sign-up/sign-in/out
and a protected app area. As always, I'll offer the simple/production/enterprise
options and recommend one before writing code.
