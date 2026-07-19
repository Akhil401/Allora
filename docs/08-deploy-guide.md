# V1 Setup & Deploy Guide (Supabase + Vercel)

_Everything you need to run the app locally and ship it to your phone. Steps that
require your accounts are marked **[you]**._

## 1. Install & first run (local)

```powershell
cd D:\new\pingo_ai
npm install
```

You'll run the app after configuring env vars below. Locally, the mic works on
`http://localhost:3000`; from your phone you need HTTPS (step 5).

## 2. Create the Supabase project **[you]**

1. Go to supabase.com → New project (free tier). Pick a region near you.
2. In **Project Settings → API**, copy:
   - Project URL → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon` public key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY` (keep secret)
3. In **Project Settings → Database**, copy the connection string → `DATABASE_URL`.
4. Open the **SQL Editor** and run **every** migration in
   `supabase/migrations/` in filename order (0001 → 0014). Highlights:
   - `0001_init.sql` (tables, RLS, trigger, seeds)
   - `0002_progress_rpc.sql` (progress function)
   - `0003`–`0009` (V2 + Learn: SRS, achievements, lessons, variants, dedupe)
   - `0010_v3_memory.sql` (**V3**: enables the `vector` extension, adds
     `memory_embeddings` + the `match_learner_memory` RPC, extends `learner_memory`).
     Re-running is safe; if `create extension vector` errors, enable **pgvector**
     under **Database → Extensions** first, then re-run.
   - `0011`–`0013` (activity/time tracking, deleted-chat archive, token-usage logging).
   - `0014_patente.sql` (**Patente** mode: question bank + attempts + helper RPCs).
5. **Load the patente question bank** (for Patente mode): after migration 0014,
   run once locally: `node scripts/import-patente.mjs`. It reads
   `NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` from `.env.local`,
   downloads the open ministry-mirror dataset (~7k questions) and fills
   `patente_questions`. Re-runnable (idempotent on `ext_id`).
5. (Optional) **Authentication → Providers → Email**: for the fastest personal
   setup, disable "Confirm email" so sign-up logs you straight in. Leave it on if
   you prefer email confirmation (the app handles both).

## 3. Get your LLM keys **[you]**

You already have these — put whichever you have into `.env.local`:

- `GEMINI_API_KEY` — Google AI Studio key.
- `NVIDIA_API_KEY` — NVIDIA build (NIM) key (covers Qwen + Gemma).
- `GROQ_API_KEY` — optional extra fallback.

The router uses whatever keys are present, in the order set by
`LLM_PROVIDER_ORDER` (default `gemini,nvidia-qwen,nvidia-gemma,groq`). Missing
keys are simply skipped. Override a model with `GEMINI_MODEL`,
`NVIDIA_QWEN_MODEL`, `NVIDIA_GEMMA_MODEL`, or `GROQ_MODEL` if a default name
changes.

### Jina embeddings (V3 adaptive memory) — optional but recommended

1. Go to **https://jina.ai/embeddings/** and copy the free API key shown in the
   playground (1M free tokens; sign in with Google/email to keep it).
2. Put it in `.env.local` as `JINA_API_KEY=jina_...`. Defaults
   `JINA_MODEL=jina-embeddings-v3` and `JINA_EMBED_DIM=1024` match migration 0010.
3. Leave `JINA_API_KEY` blank to run with **structured-only** memory — the tutor
   still adapts (weak spots, recommendations, insights); it just skips semantic
   recall of past mistakes. If you change `JINA_EMBED_DIM`, update the
   `vector(N)` size in migration 0010 to match.

## 4. Configure `.env.local`

Copy `.env.example` → `.env.local` and fill it in. Then:

```powershell
npm run dev
```

Sign up at http://localhost:3000/sign-up, then chat at `/conversations`.
Check `GET /api/health` to see which providers are live.

## 5. Use it on your Android phone

Because the mic needs HTTPS, either deploy (step 6) or tunnel:

```powershell
npx cloudflared tunnel --url http://localhost:3000
```

Open the printed `https://…` URL on your phone → Chrome menu → **Add to Home
screen** to install the PWA.

## 6. Deploy to Vercel **[you]**

1. Push the repo to GitHub.
2. vercel.com → New Project → import the repo (framework auto-detected: Next.js).
3. Add **all** env vars from `.env.local` under **Settings → Environment
   Variables** (Production + Preview).
4. Deploy. Open the `https://…vercel.app` URL on your phone and install the PWA.
5. In Supabase **Authentication → URL Configuration**, add your Vercel URL to the
   allowed redirect/site URLs.

## 7. Quality gates (run anytime / in CI)

```powershell
npm run typecheck
npm run lint
npm run test        # unit: router failover, streak, correction parser, domain errors
npm run test:e2e    # requires: npx playwright install  (runs the landing smoke test)
npm run build
```

GitHub Actions (`.github/workflows/ci.yml`) runs typecheck → lint → unit tests →
build on every push/PR automatically.

## Notes & known V1 limits

- **Two LLM calls per turn** (reply + correction). Simple and robust; if you want
  to halve quota usage later, merge them into one structured call.
- **Offline** covers reading the cached conversation list (IndexedDB) and the app
  shell (service worker). Sending requires connectivity. Queued offline sends are
  a V2 item.
- **Corrections on reload:** live corrections show during a session; re-fetching
  historical corrections on page reload is a small follow-up (data is persisted).
- Add real PWA icons in `public/icons/` before sharing widely.
