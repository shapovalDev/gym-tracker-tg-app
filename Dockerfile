# Single image: Next.js UI + REST API (packages/api mounted at /api).
FROM node:22-alpine AS base
RUN corepack enable
WORKDIR /app

FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/web/package.json apps/web/
COPY packages/api/package.json packages/api/
COPY packages/shared/package.json packages/shared/
COPY packages/api/prisma packages/api/prisma
COPY packages/api/prisma.config.ts packages/api/
RUN pnpm install --frozen-lockfile --ignore-scripts && pnpm --filter @gym/api exec prisma generate

FROM deps AS build
COPY . .
RUN pnpm --filter @gym/api exec prisma generate && pnpm --filter @gym/web build

# Migration image: has the Prisma CLI and migration files.
FROM deps AS migrate
CMD ["pnpm", "--filter", "@gym/api", "exec", "prisma", "migrate", "deploy"]

# Runtime image (default target — keep it the last stage).
FROM base AS runner
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0
RUN addgroup -S app && adduser -S app -G app
COPY --from=build --chown=app:app /app/apps/web/.next/standalone ./
COPY --from=build --chown=app:app /app/apps/web/.next/static ./apps/web/.next/static
# Migrations are applied by a separate step: `docker compose run --rm migrate` (see README).
USER app
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://127.0.0.1:3000/api/v1/health || exit 1
CMD ["node", "apps/web/server.js"]
