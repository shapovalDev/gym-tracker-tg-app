# Architecture

## Main constraint: minimal running cost

The app is used by one person today but should be able to grow into a public product. It therefore
**deploys as a single service on free tiers**, while the backend is a separate package that can be moved
to its own service without rewriting.

| Component         | Now (≈ $0/month)                                           | When it grows                                                                                                           |
| ----------------- | ---------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| UI + API          | Vercel Hobby (one Next.js project, API in a route handler) | Vercel Pro **or** the Docker image on any VPS / Fly / Render; the API can run on its own (`packages/api/src/server.ts`) |
| Database          | Supabase Free (Postgres)                                   | Supabase Pro, Neon or self-hosted Postgres — only `DATABASE_URL` changes                                                |
| Bot               | Telegram Bot API via webhook (no always-on process)        | unchanged                                                                                                               |
| External services | none (no analytics, Sentry, Redis or queues)               | added when needed                                                                                                       |

Free-tier limits (check the providers' current terms): Vercel Hobby is for non-commercial use; a free
Supabase project **is paused after ~7 days without requests** (restored from the dashboard) and has a
database size limit. For a personal tracker this is plenty: a year of workouts is a few megabytes.

## Structure

```
apps/web            Next.js 16 (App Router) — UI; app/api/[[...route]] mounts the API
packages/api        Hono REST API: routes, services, Telegram auth, Prisma
packages/shared     Zod schemas, DTO types, domain logic (cycle, metrics, weight, periods)
```

Dependencies point one way: `web → api → shared`, `web → shared`. The frontend never talks to the database
and never sees secrets — everything goes through REST.

## Key decisions

1. **Hono inside Next.js instead of a separate server.** One deployment, one origin (no CORS), no extra cost.
   `createApp()` is a plain fetch app; `@hono/node-server` runs the same app for a standalone deployment.
2. **Validation and OpenAPI from one source.** `ApiRouter` registers a route, validates input with Zod schemas
   from `@gym/shared` and builds the OpenAPI document from the same schemas. The client uses them too.
3. **Business logic lives in pure functions in `@gym/shared/domain`** (next workout, volume, records, periods),
   covered by unit tests; API services and UI components only call them.
4. **Analytics are computed on read** from the recorded sets of completed sessions. There are no cached
   aggregates, so edits and deletions are reflected immediately. Per-user data is small; materialized
   aggregates can be added later without changing the API.
5. **The workout cycle is derived, not stored:** "the workout after the last _completed_ session of this
   program". Cancelling or skipping does not advance it, rest days do not matter. If the last completed workout
   was deleted, the cycle restarts from the first one. Each program keeps its own position.
6. **Reliable set saving.** Every set change is first written to a `localStorage` outbox
   (`apps/web/src/lib/outbox.ts`) and then sent in order with retries. The server is idempotent (PUT with a client
   UUID, DELETE succeeds when already gone), so retries cannot create duplicates. A workout cannot be finished
   while the queue still has unsent changes.
7. **Authentication on every request with `initData`** (HMAC, no own sessions or JWT): nothing to store or
   invalidate. `telegramId → userId` is cached in process memory.
8. **Local development without disabling verification.** `GET /api/v1/dev/init-data` returns initData _signed
   with the real bot token_, so requests go through the normal verification path. The endpoint exists only with
   `ALLOW_DEV_AUTH=true`; with `NODE_ENV=production` the server refuses to start with that flag.
9. **Own colour palette, Telegram light/dark.** Telegram theme colours are often too close to each other, so the
   UI uses its own tokens (page / card / inset surfaces with clear contrast) and follows Telegram's `colorScheme`;
   the Telegram header and background are painted to match. Workouts are identified by competition-plate colours
   (A red, B blue, C yellow, D green, E white). Fonts (Golos Text, Unbounded) are self-hosted at build time.
   The SDK is the official `telegram-web-app.js` with a thin typed wrapper (`src/lib/telegram.ts`).

## Workout data flow

```
[Record set] → outbox (localStorage) → PUT /sessions/:id/sets/:uuid → Postgres
       │                                   ▲ retried with backoff when offline
       └─ the UI shows the set immediately (applyPending: server data + queue)
```

## Security

- `initData` is verified on the server: HMAC, age, duplicate keys, `user.id` format.
- Ownership is checked on every request through the parent chain; another user's data always returns 404.
- All input goes through Zod; bodies are limited to 32 KB; path ids must be UUIDs.
- 500 errors are logged without headers or bodies (they contain initData); the client only gets a code.
- Secrets live only in env vars. `TELEGRAM_BOT_TOKEN` never reaches the client bundle (there are no `NEXT_PUBLIC_*` secrets).
- The bot webhook checks `X-Telegram-Bot-Api-Secret-Token` with a constant-time comparison.
- Pages do not send `X-Frame-Options: DENY`, because Telegram Web opens Mini Apps in a frame.

## Scaling (when needed)

- Split out the API: deploy `packages/api` on its own (`pnpm --filter @gym/api start`), set `CORS_ORIGIN`, point the client `BASE` at it.
- Rate limiting: a Hono middleware plus a shared store (Upstash/Redis) once there are several instances.
- Analytics aggregates: an `ExerciseSessionStat` table updated in the same transaction as set writes.
- Monitoring: logs are already structured JSON; plug in a collector.
