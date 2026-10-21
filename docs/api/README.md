# REST API

- Базовый путь: `/api/v1`. Документация генерируется из тех же Zod-схем, которые проверяют запросы:
  - Swagger UI: `GET /api/docs`
  - OpenAPI 3.1: `GET /api/v1/openapi.json` (снимок: [`openapi.json`](./openapi.json))
- Реализация: `packages/api` (Hono). Маршруты: `packages/api/src/routes/index.ts`. Типы ответов: `packages/shared/src/types.ts`.

## Аутентификация

Каждый защищённый запрос передаёт заголовок `Authorization: tma <Telegram.WebApp.initData>`.
Сервер проверяет HMAC-SHA256 (`secret = HMAC("WebAppData", bot_token)`), срок `auth_date`
(`INIT_DATA_MAX_AGE_SECONDS`) и только после этого берёт Telegram ID. ID из параметров запроса не принимается.
Пользователь создаётся при первом успешном запросе.

Публичные эндпоинты: `/health`, `/openapi.json`, `/telegram/webhook` (проверяет `X-Telegram-Bot-Api-Secret-Token`),
`/dev/init-data` (только при `ALLOW_DEV_AUTH=true` и `NODE_ENV≠production`).

## Ошибки

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request",
    "details": [{ "path": "reps", "message": "…" }]
  }
}
```

| HTTP | code                                                                                                                                   | Когда                                                                          |
| ---- | -------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| 400  | `VALIDATION_ERROR`, `BAD_REQUEST`                                                                                                      | Неверное тело/параметры, ID не UUID                                            |
| 401  | `UNAUTHORIZED`                                                                                                                         | Нет или неверная initData                                                      |
| 404  | `NOT_FOUND`                                                                                                                            | Ресурс не существует **или принадлежит другому пользователю** (не различаются) |
| 409  | `SESSION_IN_PROGRESS`, `INCOMPLETE_SESSION`, `SESSION_CANCELLED`, `PROGRAM_ARCHIVED`, `EXERCISE_ARCHIVED`, `TOO_MANY_SETS`, `CONFLICT` | Недопустимый переход состояния                                                 |
| 413  | `PAYLOAD_TOO_LARGE`                                                                                                                    | Тело > 32 КБ                                                                   |
| 500  | `INTERNAL`                                                                                                                             | Детали только в серверном логе                                                 |

## Идемпотентность и повторы

| Операция                                  | Как защищена от дублей                                                                                                                 |
| ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `PUT /sessions/{id}/sets/{setId}`         | `setId` генерирует клиент; PUT = создать или заменить. 201 при создании, 200 при повторе/правке                                        |
| `DELETE /sessions/{id}/sets/{setId}`      | Повторное удаление → 204                                                                                                               |
| `POST /sessions`                          | Необязательный клиентский `id`; повтор возвращает ту же сессию. Частичный уникальный индекс: одна незавершённая сессия на пользователя |
| `POST /sessions/{id}/exercises`           | Необязательный клиентский `id`                                                                                                         |
| `POST /sessions/{id}/complete`, `/cancel` | Повтор на уже завершённой/отменённой сессии возвращает её же                                                                           |

## Пагинация и фильтры

`GET /sessions?from=<ISO>&to=<ISO>&status=completed|cancelled|all&limit=20&cursor=<id>` → `{ items, nextCursor }`.
`from` включительно, `to` исключительно. По умолчанию — только завершённые.

## Эндпоинты

| Метод  | Путь                                                         | Назначение                                                          |
| ------ | ------------------------------------------------------------ | ------------------------------------------------------------------- |
| GET    | `/api/v1/me`                                                 | Current user                                                        |
| GET    | `/api/v1/me/home`                                            | Home screen state                                                   |
| GET    | `/api/v1/exercises`                                          | List/search exercise library                                        |
| POST   | `/api/v1/exercises`                                          | Create exercise                                                     |
| GET    | `/api/v1/exercises/{exerciseId}`                             | Get exercise                                                        |
| PATCH  | `/api/v1/exercises/{exerciseId}`                             | Update exercise (rename keeps history)                              |
| POST   | `/api/v1/exercises/{exerciseId}/archive`                     | Archive exercise (history kept)                                     |
| POST   | `/api/v1/exercises/{exerciseId}/unarchive`                   | Restore archived exercise                                           |
| GET    | `/api/v1/programs`                                           | List programs                                                       |
| POST   | `/api/v1/programs`                                           | Create program (optionally with workouts)                           |
| GET    | `/api/v1/programs/{programId}`                               | Program with workouts, planned exercises and next workout           |
| PATCH  | `/api/v1/programs/{programId}`                               | Update name/description                                             |
| POST   | `/api/v1/programs/{programId}/activate`                      | Make this the active program                                        |
| POST   | `/api/v1/programs/{programId}/archive`                       | Archive (history kept, deactivates)                                 |
| POST   | `/api/v1/programs/{programId}/unarchive`                     | Restore archived program                                            |
| POST   | `/api/v1/programs/{programId}/duplicate`                     | Deep copy of a program                                              |
| POST   | `/api/v1/programs/{programId}/workouts`                      | Append a workout to the cycle                                       |
| PUT    | `/api/v1/programs/{programId}/workouts/order`                | Reorder workouts (full list of ids)                                 |
| PATCH  | `/api/v1/workouts/{workoutId}`                               | Rename workout                                                      |
| DELETE | `/api/v1/workouts/{workoutId}`                               | Delete planned workout (sessions kept)                              |
| POST   | `/api/v1/workouts/{workoutId}/duplicate`                     | Duplicate workout                                                   |
| POST   | `/api/v1/workouts/{workoutId}/exercises`                     | Add planned exercise                                                |
| PUT    | `/api/v1/workouts/{workoutId}/exercises/order`               | Reorder planned exercises                                           |
| PATCH  | `/api/v1/workout-exercises/{workoutExerciseId}`              | Edit planned sets / rep range / notes                               |
| DELETE | `/api/v1/workout-exercises/{workoutExerciseId}`              | Remove planned exercise                                             |
| POST   | `/api/v1/sessions`                                           | Start a workout session (idempotent with client id)                 |
| GET    | `/api/v1/sessions`                                           | History (cursor pagination, date range)                             |
| GET    | `/api/v1/sessions/active`                                    | The unfinished session, or null                                     |
| GET    | `/api/v1/sessions/{sessionId}`                               | Session detail with previous results                                |
| DELETE | `/api/v1/sessions/{sessionId}`                               | Delete a session and its sets                                       |
| POST   | `/api/v1/sessions/{sessionId}/complete`                      | Finish session                                                      |
| POST   | `/api/v1/sessions/{sessionId}/cancel`                        | Cancel unfinished session                                           |
| POST   | `/api/v1/sessions/{sessionId}/exercises`                     | Add an exercise to a session                                        |
| DELETE | `/api/v1/sessions/{sessionId}/exercises/{sessionExerciseId}` | Remove an exercise (and its sets) from a session                    |
| PUT    | `/api/v1/sessions/{sessionId}/sets/{setId}`                  | Create or replace a set (client-generated id; safe to retry)        |
| DELETE | `/api/v1/sessions/{sessionId}/sets/{setId}`                  | Delete a set (idempotent); remaining sets renumbered                |
| GET    | `/api/v1/analytics/summary`                                  | Totals for a period vs the previous one                             |
| GET    | `/api/v1/analytics/exercises/{exerciseId}`                   | Time series, records and summary for one exercise                   |
| GET    | `/api/v1/health`                                             | Health check                                                        |
| POST   | `/api/v1/telegram/webhook`                                   | Telegram Bot API webhook (requires X-Telegram-Bot-Api-Secret-Token) |
