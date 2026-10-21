# CLAUDE.md

Telegram Mini App for strength-training tracking. pnpm monorepo. UI text is Russian; code, comments and identifiers are English.

## Layout

- `packages/shared` — Zod request schemas (`schemas.ts`), response DTOs (`types.ts`), pure domain logic (`domain/`: cycle, metrics, weight, period). No I/O.
- `packages/api` — Hono REST API (`createApp()` in `src/app.ts`), Prisma 7 schema/migrations, services (`src/services/*`), Telegram auth (`src/auth/*`). Routes are declared in `src/routes/index.ts` via `ApiRouter.route()`, which validates input and generates OpenAPI from the same Zod schemas.
- `apps/web` — Next.js 16 App Router, client-rendered pages in `app/`. API is mounted at `app/api/[[...route]]/route.ts`. Data fetching via TanStack Query hooks in `src/lib/queries.ts`; set mutations go through the durable outbox in `src/lib/outbox.ts`.

## Rules

- Business logic lives in `packages/shared/src/domain` or `packages/api/src/services`, never in React components.
- The frontend talks only to `/api/v1`; never import Prisma or secrets into client code. No `NEXT_PUBLIC_*` secrets.
- Every service function takes `userId` and checks ownership through the parent chain (`services/common.ts` `owned*` helpers). Not-owned ⇒ 404.
- History must never depend on the plan: sessions store name snapshots; plan relations are `SET NULL`; exercises are archived, not deleted.
- Weights: `NUMERIC(6,2)`, use `toCentiKg`/`roundWeightKg` for arithmetic.
- Set writes are idempotent (`PUT /sessions/:id/sets/:clientUuid`). Keep new write endpoints retry-safe.
- Partial unique indexes and CHECK constraints are hand-written in migration SQL — preserve them when generating new migrations (`prisma migrate dev --create-only`, then review).
- Never weaken `initData` verification; local dev uses `/api/v1/dev/init-data` (signed with the real token, dev only).

## Commands

```bash
pnpm db:up && pnpm db:deploy   # local Postgres (localhost:5544) + migrations
pnpm dev                        # http://localhost:3000 (Swagger: /api/docs)
pnpm lint && pnpm format:check && pnpm typecheck
pnpm test                       # shared unit + api integration (needs Postgres) + web component tests
pnpm test:e2e                   # Playwright, own dev server on :3100 and DB gym_e2e
pnpm build
```

After changing `schema.prisma`: `pnpm --filter @gym/api exec prisma migrate dev --name <name>` (regenerates the client into `packages/api/src/generated`, which is git-ignored).

## Gotchas

- Vitest's on-disk module cache is disabled (`fsModuleCache: false`) — it lives at the repo root and was shared across packages, causing "failed to find the runner" errors. If they reappear: `npx vitest --clearCache`.
- E2E uses `NEXT_DIST_DIR=.next-e2e` so it can run next to a normal `pnpm dev`.
- `SetEntry` must stay mounted between sets (keyed per exercise); remounting races with fast input.
