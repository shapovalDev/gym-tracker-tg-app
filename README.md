# Gym Tracker — Telegram Mini App для силовых тренировок

Личный трекер: программы с циклом тренировок (A → B → C → D → A…), запись каждого подхода во время
тренировки, история и графики прогресса по реальным данным. Открывается прямо в Telegram.

**Стек:** Next.js 16 · React 19 · TypeScript (strict) · Hono (REST, OpenAPI) · Prisma 7 · PostgreSQL (Supabase) ·
Zod · TanStack Query · Recharts · Tailwind CSS 4 · Vitest · Testing Library · Playwright · Docker · GitHub Actions.

**Стоимость:** рассчитано на $0/мес (Vercel Hobby + Supabase Free + Telegram). Подробности и путь
масштабирования — [`docs/architecture/ARCHITECTURE.md`](docs/architecture/ARCHITECTURE.md).

## Возможности

- Программы с любым количеством тренировок, порядок, дублирование, архив, переключение активной.
- Личная библиотека упражнений с группами мышц, поиском и архивом.
- Экран тренировки для одной руки: крупные степперы веса и повторов, «прошлый раз», правка и удаление подходов,
  пропуск, офлайн-очередь без потерь и дублей, итог тренировки.
- История с фильтром по датам, правкой результатов и удалением.
- Прогресс: максимальный вес, повторы при выбранном весе, объём, e1RM (Эпли), рекорды, сравнение с прошлым периодом.
- Авторизация через Telegram `initData` с проверкой на сервере, полная изоляция данных пользователей.

## Структура

```
apps/web/            Next.js: страницы (app/), компоненты, клиент API, офлайн-очередь, e2e-тесты
packages/api/        REST API (Hono) + Prisma: схема, миграции, сервисы, авторизация, интеграционные тесты
packages/shared/     Zod-схемы, DTO, доменная логика (цикл, метрики, вес), юнит-тесты
docs/                architecture/, product/, api/ (OpenAPI), database/
```

## Требования

Node.js ≥ 22, pnpm 10 (`corepack enable`), Docker (для локального Postgres).

## Быстрый старт (локально, без Telegram)

```bash
corepack enable
pnpm install
cp .env.example .env          # значения по умолчанию подходят для локальной разработки
pnpm db:up                    # Postgres в Docker на localhost:5544
pnpm db:deploy                # применить миграции
pnpm dev                      # http://localhost:3000
```

В обычном браузере dev-режим получает **подписанную** initData с `GET /api/v1/dev/init-data`
(`ALLOW_DEV_AUTH=true`), поэтому проверка подписи работает так же, как в продакшене.
Swagger UI: http://localhost:3000/api/docs.

## Команды

| Команда                                              | Что делает                                                                                                                            |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm dev`                                           | Next.js + API в режиме разработки                                                                                                     |
| `pnpm dev:api`                                       | Отдельный API-сервер на `:4000` (опционально)                                                                                         |
| `pnpm db:up` / `pnpm db:deploy` / `pnpm db:migrate`  | Postgres в Docker / применить миграции / создать миграцию                                                                             |
| `pnpm lint` · `pnpm format:check` · `pnpm typecheck` | Проверки                                                                                                                              |
| `pnpm test`                                          | Юнит- и интеграционные тесты (нужен запущенный Postgres, создаётся БД `gym_test`)                                                     |
| `pnpm test:e2e`                                      | Playwright (поднимает свой dev-сервер на `:3100` и БД `gym_e2e`). Один раз: `pnpm --filter @gym/web exec playwright install chromium` |
| `pnpm build`                                         | Продакшен-сборка                                                                                                                      |
| `pnpm bot:setup`                                     | Настроить webhook, кнопку меню и команды бота                                                                                         |

## Переменные окружения

| Переменная                  | Обязательна  | Описание                                                                 |
| --------------------------- | ------------ | ------------------------------------------------------------------------ |
| `DATABASE_URL`              | да           | Подключение приложения. На Supabase — **Transaction pooler** (порт 6543) |
| `DIRECT_URL`                | для миграций | Прямое подключение (Supabase: Session pooler / direct, порт 5432)        |
| `TELEGRAM_BOT_TOKEN`        | да           | Токен от @BotFather. Только сервер                                       |
| `TELEGRAM_WEBHOOK_SECRET`   | для бота     | Случайная строка, проверяется в webhook                                  |
| `PUBLIC_APP_URL`            | да           | Публичный HTTPS-адрес Mini App                                           |
| `INIT_DATA_MAX_AGE_SECONDS` | нет          | Срок жизни initData, по умолчанию 7 дней                                 |
| `ALLOW_DEV_AUTH`            | нет          | `true` только локально. В production сервер с этим флагом не запустится  |
| `DEV_TELEGRAM_USER_ID`      | нет          | ID dev-пользователя                                                      |
| `CORS_ORIGIN`               | нет          | Нужен, только если API развёрнут отдельно от фронта                      |
| `API_PORT`                  | нет          | Порт отдельного API-сервера                                              |

## Деплой за $0: Supabase + Vercel + Telegram

1. **Supabase.** Создайте проект → _Connect_: возьмите строку **Transaction pooler** (6543) для `DATABASE_URL`
   и **Session pooler/Direct** (5432) для `DIRECT_URL`. Примените миграции со своей машины:
   `DIRECT_URL="postgresql://…:5432/postgres" pnpm db:deploy`.
2. **Бот.** В @BotFather: `/newbot` → токен.
3. **Vercel.** Импортируйте репозиторий, _Root Directory_ = `apps/web` (фреймворк Next.js определится сам,
   pnpm-воркспейс поддерживается). В _Environment Variables_ задайте `DATABASE_URL`, `TELEGRAM_BOT_TOKEN`,
   `TELEGRAM_WEBHOOK_SECRET`, `PUBLIC_APP_URL=https://<проект>.vercel.app`. `ALLOW_DEV_AUTH` **не задавайте**.
   Регион функций лучше выбрать рядом с регионом Supabase.
4. **Подключите бота к приложению** (нужен HTTPS-адрес):
   ```bash
   TELEGRAM_BOT_TOKEN=… TELEGRAM_WEBHOOK_SECRET=… PUBLIC_APP_URL=https://<проект>.vercel.app pnpm bot:setup
   ```
   Скрипт ставит webhook (`/api/v1/telegram/webhook`: ответ на `/start` с кнопкой), кнопку меню с Mini App и
   команду `/start`. Альтернатива — в @BotFather: _Bot Settings → Menu Button_ или `/newapp`.
5. Откройте бота в Telegram → кнопка «Тренировка».

> Бесплатный проект Supabase засыпает после ~7 дней без запросов. Восстановить его можно в панели.
> Vercel Hobby рассчитан на некоммерческое использование. Когда приложением начнут пользоваться другие люди,
> перейдите на Vercel Pro или Docker-хостинг (см. ниже).

### HTTPS для теста в Telegram с локальной машины

Telegram открывает Mini App только по HTTPS. Поднимите туннель (`cloudflared tunnel --url http://localhost:3000`
или `ngrok http 3000`), пропишите выданный адрес в `PUBLIC_APP_URL` и выполните `pnpm bot:setup`.
Внутри Telegram приходит настоящая initData, поэтому dev-эндпоинт не используется.

## Docker (самостоятельный хостинг)

```bash
docker compose --profile app up --build      # Postgres + миграции + приложение на :3000
```

Образ `runner` — standalone-сборка Next.js (UI + API), `migrate` применяет миграции. Для продакшена
передайте внешние `DATABASE_URL` и `DIRECT_URL`, а перед приложением поставьте HTTPS-прокси (Caddy, Traefik или
платформу вроде Fly или Render).

## Документация

- [Архитектура и решения](docs/architecture/ARCHITECTURE.md)
- [Продукт и рамки MVP](docs/product/PRODUCT.md) · [исходное ТЗ](docs/product/SPEC.md)
- [REST API](docs/api/README.md) · [OpenAPI](docs/api/openapi.json)
- [База данных](docs/database/README.md)
