# База данных

PostgreSQL (локально — Docker, в проде — Supabase). ORM — Prisma 7 (`packages/api/prisma/schema.prisma`),
драйвер `@prisma/adapter-pg`.

## Модель

```
User ─┬─ Exercise                     (личная библиотека)
      ├─ TrainingProgram ── ProgramWorkout ── WorkoutExercise ──► Exercise     ← ПЛАН
      └─ WorkoutSession ── SessionExercise ── ExerciseSet                      ← ФАКТ
                 │                 └──► Exercise (exerciseId — стабильная связь для аналитики)
                 └──► TrainingProgram / ProgramWorkout (SET NULL при удалении)
```

**План и факт разделены.** При старте тренировки упражнения плана копируются в `SessionExercise`
вместе со снимками (`exerciseNameSnapshot`, плановые подходы/повторы). Поэтому редактирование,
переупорядочивание или удаление программы не меняет историю.

## Правила целостности

| Правило                                                          | Где обеспечено                                                                                                        |
| ---------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Все данные принадлежат пользователю                              | `userId` у корневых сущностей; вложенные проверяются через цепочку родителей в каждом запросе (`services/common.ts`)  |
| Одна активная программа на пользователя                          | частичный уникальный индекс `TrainingProgram_one_active_per_user`                                                     |
| Одна незавершённая сессия на пользователя                        | частичный уникальный индекс `WorkoutSession_one_in_progress_per_user`                                                 |
| Порядок тренировок/упражнений уникален и плотный (0..n-1)        | `UNIQUE(programId, position)`, `UNIQUE(workoutId, position)`; переупорядочивание в транзакции в 2 шага (`applyOrder`) |
| Вес 0–1000 кг, `NUMERIC(6,2)`                                    | Zod + `CHECK`                                                                                                         |
| Повторы 0–1000, у выполненного подхода ≥ 1                       | Zod + `CHECK ExerciseSet_completed_needs_reps`                                                                        |
| Удаление упражнения из библиотеки невозможно, если оно в истории | `ON DELETE RESTRICT`; вместо удаления — архив (`archivedAt`)                                                          |
| Удаление тренировки плана не удаляет сессии                      | `ON DELETE SET NULL` + снимок названия                                                                                |
| Удаление сессии удаляет её подходы                               | `ON DELETE CASCADE` (статистика считается на лету и сразу обновляется)                                                |

**Округление веса:** до 0,01 кг, половина — от нуля (`roundWeightKg`). В расчётах объёма вес переводится в
целые сотые килограмма, чтобы суммы были точными.

**Единицы:** храним килограммы (`weightKg`). Для поддержки фунтов достаточно добавить настройку отображения
и конвертацию на клиенте — схема не меняется.

## Индексы

- `WorkoutSession(userId, status, startedAt DESC)` — история, активная сессия, счётчики.
- `WorkoutSession(programId, status, completedAt DESC)` — расчёт следующей тренировки цикла.
- `SessionExercise(exerciseId)`, `ExerciseSet(sessionExerciseId, setNumber)` — аналитика и «прошлый раз».
- `Exercise(userId, archivedAt)`, `TrainingProgram(userId, archivedAt)` — списки.

## Миграции

```bash
pnpm db:migrate              # dev: создать/применить миграцию (prisma migrate dev)
pnpm db:deploy               # прод/CI: применить существующие миграции (prisma migrate deploy)
pnpm --filter @gym/api db:studio
```

Миграции используют `DIRECT_URL` (прямое подключение), приложение — `DATABASE_URL` (на Supabase — пулер).
Частичные индексы и `CHECK` дописаны в SQL миграции вручную: Prisma их не описывает.
При изменении схемы создавайте миграцию через `prisma migrate dev --create-only`, проверяйте SQL и
сохраняйте эти ограничения.
