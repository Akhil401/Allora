# API Design

_Phase 0 document · Last updated: 2026-07-15 · Status: DRAFT for approval_

REST-style **Route Handlers** under `app/api/*` act as the backend-for-frontend (BFF).
Some reads are done directly in React Server Components via the Supabase server client;
the endpoints below are for mutations and streaming.

## 1. Conventions

- **Auth:** every endpoint (except `/api/health`) requires a valid Supabase session; the handler resolves `auth.uid()` server-side. No `user_id` is trusted from the client.
- **Validation:** request bodies parsed with **Zod**; invalid → `400` with a problem object.
- **Errors (RFC 9457-style):** `{ "error": { "code": "rate_limited", "message": "...", "details": {} } }`. Codes: `unauthorized` (401), `forbidden` (403), `not_found` (404), `validation_error` (400), `rate_limited` (429), `provider_unavailable` (502), `internal` (500).
- **Streaming:** tutor replies stream via `text/event-stream` (SSE) / `ReadableStream`; the final SSE event carries the Zod-validated correction object.
- **IDs:** UUIDs. **Time:** ISO-8601 UTC.

## 2. REST vs GraphQL (decision)

**REST (Route Handlers)** chosen: the surface is small and mutation-centric, streaming is
first-class, and it needs zero extra dependencies in Next.js. **GraphQL rejected** for V1 —
overhead (schema/resolvers/client) with no payoff at this scale. Revisit only if the client
grows many divergent read shapes.

## 3. Endpoints (V1)

### Auth

Handled by Supabase Auth SDK on the client + SSR session helpers; no custom auth endpoints.
A DB trigger creates a `profiles` row on first sign-in.

### Conversations

| Method   | Path                     | Body                      | Returns                                              |
| -------- | ------------------------ | ------------------------- | ---------------------------------------------------- |
| `GET`    | `/api/conversations`     | —                         | list of user's conversations (id, title, updated_at) |
| `POST`   | `/api/conversations`     | `{ title?, categoryId? }` | created conversation                                 |
| `GET`    | `/api/conversations/:id` | —                         | conversation + messages                              |
| `PATCH`  | `/api/conversations/:id` | `{ title?, status? }`     | updated conversation                                 |
| `DELETE` | `/api/conversations/:id` | —                         | `204`                                                |

### Messages / tutor (core)

```
POST /api/conversations/:id/messages        (streaming)
```

Request:

```json
{
  "text": "Ieri io andato al ristorante",
  "audioSource": "mic", // "mic" | "text"
  "wantSpokenReply": true
}
```

Server steps: validate → load learner context (level, recent mistakes, prefs) → build
system prompt → call **LLM Router** (with failover) → stream Italian reply → persist
user msg, tutor msg, correction, mistakes, vocab.

SSE stream:

```
event: token      data: {"delta":"Ottimo! "}
event: token      data: {"delta":"Piccola correzione… "}
...
event: correction data: { <CorrectionObject> }
event: done       data: {"providerUsed":"gemini","messageId":"..."}
```

`CorrectionObject` (Zod-validated LLM structured output):

```json
{
  "hasError": true,
  "originalText": "Ieri io andato al ristorante",
  "correctedText": "Ieri sono andato al ristorante",
  "explanationEn": "Passato prossimo needs the auxiliary 'essere' with 'andare': 'sono andato'.",
  "errors": [
    { "type": "auxiliary_verb", "detail": "Missing 'sono' before 'andato'.", "severity": "med" }
  ],
  "vocabulary": [{ "termIt": "ristorante", "termEn": "restaurant", "partOfSpeech": "noun" }]
}
```

### Translation

| Method | Path                          | Body | Returns                                             |
| ------ | ----------------------------- | ---- | --------------------------------------------------- |
| `POST` | `/api/messages/:id/translate` | —    | `{ contentEn }` (generated + cached on the message) |

### Progress & settings

| Method  | Path                  | Body                                                                   | Returns                                                             |
| ------- | --------------------- | ---------------------------------------------------------------------- | ------------------------------------------------------------------- |
| `GET`   | `/api/progress/today` | —                                                                      | `{ messagesCount, minutesPracticed, goalMinutes, goalMet, streak }` |
| `GET`   | `/api/settings`       | —                                                                      | settings object                                                     |
| `PATCH` | `/api/settings`       | `{ theme?, voiceOutputEnabled?, tutorDifficulty?, dailyGoalMinutes? }` | updated settings                                                    |

### Health

| Method | Path          | Returns                                                     |
| ------ | ------------- | ----------------------------------------------------------- |
| `GET`  | `/api/health` | `{ ok: true, providers: [{ id, healthy, cooldownUntil }] }` |

## 4. LLM router contract (internal)

Not an HTTP endpoint — an internal service the message handler calls.

```ts
interface LlmRequest {
  system: string;
  messages: { role: "user" | "assistant"; content: string }[];
  stream: true;
  responseFormat?: "text" | "json"; // json → CorrectionObject
  maxTokens?: number;
}

interface LlmRouter {
  generate(req: LlmRequest): AsyncIterable<LlmChunk>; // tries providers in order
}
```

Failover triggers: `RateLimitError`, `QuotaExceededError`, `ProviderTimeout`,
`ProviderError (5xx)`. On trigger → mark provider cooling-down → try next. If all fail →
`502 provider_unavailable`. The chosen provider id is returned in the `done` event and
stored on the message.

## 5. Rate limiting

Per-user token-bucket on `POST /api/conversations/:id/messages` (e.g. N requests/min) to
protect free provider quotas. Exceed → `429 rate_limited` with `Retry-After`.

## 6. Endpoints deferred to V2/V3

`/api/flashcards/due`, `/api/flashcards/:id/review` (SM-2), `/api/lessons/generate`,
`/api/categories`, `/api/challenges/daily`, `/api/achievements`, `/api/pronunciation/score`,
`/api/memory` (V3 adaptivity). Listed now so the URL space is planned.
