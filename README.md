# Gym Tracker — Telegram Mini App for strength training

A personal tracker: programs with a rotating workout cycle (A → B → C → D → A…), logging every set during the
workout, history and progress charts built from real data. Opens right inside Telegram.

**Stack:** Next.js 16 · React 19 · TypeScript (strict) · Hono (REST, OpenAPI) · Prisma 7 · PostgreSQL (Supabase) ·
Zod · TanStack Query · Recharts · Tailwind CSS 4 · Vitest · Testing Library · Playwright · Docker · GitHub Actions.

**Cost:** designed to run at $0/month (Vercel Hobby + Supabase Free + Telegram). Details and the scaling path:
[`docs/architecture/ARCHITECTURE.md`](docs/architecture/ARCHITECTURE.md).

## Features

- Programs with any number of workouts, ordering, duplication, archive, switching the active program.
- Personal exercise library with muscle groups, technique notes, search and archive.
- One-handed workout screen: large weight/reps steppers, "last time", notes, edit/delete/skip sets,
  offline queue without data loss or duplicates, workout summary.
- History with a date filter, editing results and deleting sessions.
- Progress: max weight, reps at a selected weight, volume, personal records, comparison with the previous period.
- Telegram `initData` authentication verified on the server; complete isolation of user data.

## Structure

```
apps/web/            Next.js: pages (app/), components, API client, offline outbox, e2e tests
packages/api/        REST API (Hono) + Prisma: schema, migrations, services, auth, integration tests
packages/shared/     Zod schemas, DTOs, domain logic (cycle, metrics, weight), unit tests
docs/                architecture/, product/, api/ (OpenAPI), database/
```

## Requirements

Node.js ≥ 22, pnpm 10 (`corepack enable`), Docker (for local Postgres).

## Quick start (local, without Telegram)

```bash
corepack enable
pnpm install
cp .env.example .env          # the defaults work for local development
pnpm db:up                    # Postgres in Docker on localhost:5544
pnpm db:deploy                # apply migrations
pnpm dev                      # http://localhost:3000
```

In a regular browser, dev mode gets **signed** initData from `GET /api/v1/dev/init-data`
(`ALLOW_DEV_AUTH=true`), so signature verification works exactly as in production.
Swagger UI: http://localhost:3000/api/docs.

## Commands

| Command                                              | What it does                                                                                                                                                                                  |
| ---------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm dev`                                           | Next.js + API in development mode                                                                                                                                                             |
| `pnpm dev:api`                                       | Standalone API server on `:4000` (optional)                                                                                                                                                   |
| `pnpm db:up` / `pnpm db:deploy` / `pnpm db:migrate`  | Postgres in Docker / apply migrations / create a migration                                                                                                                                    |
| `pnpm lint` · `pnpm format:check` · `pnpm typecheck` | Checks                                                                                                                                                                                        |
| `pnpm test`                                          | Unit and integration tests (needs Postgres running; creates database `gym_test`)                                                                                                              |
| `pnpm test:e2e`                                      | Playwright (own dev server on `:3100`, database `gym_e2e`). Once: `pnpm --filter @gym/web exec playwright install chromium`. Stop other `next dev` servers of this repo first (see CLAUDE.md) |
| `pnpm build`                                         | Production build                                                                                                                                                                              |
| `pnpm bot:setup`                                     | Configure the bot webhook, menu button and commands                                                                                                                                           |

## Environment variables

| Variable                    | Required       | Description                                                            |
| --------------------------- | -------------- | ---------------------------------------------------------------------- |
| `DATABASE_URL`              | yes            | App connection. On Supabase use the **Transaction pooler** (port 6543) |
| `DIRECT_URL`                | for migrations | Direct connection (Supabase: Session pooler, port 5432)                |
| `TELEGRAM_BOT_TOKEN`        | yes            | Token from @BotFather. Server only                                     |
| `TELEGRAM_WEBHOOK_SECRET`   | for the bot    | Random string, checked by the webhook                                  |
| `PUBLIC_APP_URL`            | yes            | Public HTTPS URL of the Mini App                                       |
| `INIT_DATA_MAX_AGE_SECONDS` | no             | initData lifetime, 7 days by default                                   |
| `ALLOW_DEV_AUTH`            | no             | `true` only locally. In production the server refuses to start with it |
| `DEV_TELEGRAM_USER_ID`      | no             | Id of the dev user                                                     |
| `CORS_ORIGIN`               | no             | Only needed when the API is deployed separately from the frontend      |
| `API_PORT`                  | no             | Port of the standalone API server                                      |

## Deploying for $0: Supabase + Vercel + Telegram

1. **Supabase.** Create a project → _Connect_ → _Direct_: copy the **Transaction pooler** string (6543) into
   `DATABASE_URL` and the **Session pooler** string (5432) into `DIRECT_URL` (the "Direct connection" host is
   IPv6-only). Apply migrations from your machine: `DIRECT_URL="postgresql://…:5432/postgres" pnpm db:deploy`.
2. **Bot.** In @BotFather: `/newbot` → token.
3. **Vercel.** Import the repository with _Root Directory_ = `apps/web` and _Build Command_ =
   `cd ../.. && pnpm build`. Set `DATABASE_URL`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`,
   `PUBLIC_APP_URL=https://<project>.vercel.app`. Do **not** set `ALLOW_DEV_AUTH`. Put the function region
   next to the Supabase region (e.g. `dub1` for eu-west-1). With the CLI: `vercel link`, `vercel env add`,
   `vercel deploy --prod` from the repo root (`.vercelignore` keeps local `.env*` files out of the upload).
4. **Connect the bot** (needs the HTTPS URL):
   ```bash
   TELEGRAM_BOT_TOKEN=… TELEGRAM_WEBHOOK_SECRET=… PUBLIC_APP_URL=https://<project>.vercel.app pnpm bot:setup
   ```
   This sets the webhook (`/api/v1/telegram/webhook`, replies to `/start` with a button), the menu button that
   opens the Mini App, and the `/start` command.
5. Open the bot in Telegram → "Тренировка" button.

> A free Supabase project pauses after ~7 days without requests — restore it from the dashboard.
> Vercel Hobby is for non-commercial use; move to Vercel Pro or Docker hosting once other people use the app.

### HTTPS for testing in Telegram from a local machine

Telegram opens Mini Apps only over HTTPS. Start a tunnel (`cloudflared tunnel --url http://localhost:3000`
or `ngrok http 3000`), put the URL into `PUBLIC_APP_URL` and run `pnpm bot:setup`. Inside Telegram real
initData is sent, so the dev endpoint is not used.

## Docker (self-hosting)

```bash
docker compose --profile app up --build      # Postgres + migrations + app on :3000
```

The `runner` image is the Next.js standalone build (UI + API); `migrate` applies migrations. In production pass
external `DATABASE_URL`/`DIRECT_URL` and put an HTTPS proxy in front (Caddy, Traefik, or a platform like Fly/Render).

## Documentation

- [Architecture and decisions](docs/architecture/ARCHITECTURE.md)
- [Product and MVP scope](docs/product/PRODUCT.md) · [original specification](docs/product/SPEC.md)
- [REST API](docs/api/README.md) · [OpenAPI](docs/api/openapi.json)
- [Database](docs/database/README.md)
