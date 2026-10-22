# Database

PostgreSQL (Docker locally, Supabase in production). ORM: Prisma 7 (`packages/api/prisma/schema.prisma`)
with the `@prisma/adapter-pg` driver.

## Model

```
User ─┬─ Exercise                     (personal library)
      ├─ TrainingProgram ── ProgramWorkout ── WorkoutExercise ──► Exercise     ← PLAN
      └─ WorkoutSession ── SessionExercise ── ExerciseSet                      ← ACTUAL
                 │                 └──► Exercise (exerciseId — stable link used by analytics)
                 └──► TrainingProgram / ProgramWorkout (SET NULL on delete)
```

**Plan and history are separate.** When a workout starts, its planned exercises are copied into
`SessionExercise` together with snapshots (`exerciseNameSnapshot`, planned sets/reps, notes). Editing,
reordering or deleting the program therefore never changes history.

## Integrity rules

| Rule                                                                                                                       | Enforced by                                                                                                                |
| -------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| All data belongs to a user                                                                                                 | `userId` on root entities; nested entities are checked through the parent chain on every request (`services/common.ts`)    |
| At most one active program per user                                                                                        | partial unique index `TrainingProgram_one_active_per_user`                                                                 |
| At most one unfinished session per user                                                                                    | partial unique index `WorkoutSession_one_in_progress_per_user`                                                             |
| Workout/exercise order is unique and dense (0..n-1)                                                                        | `UNIQUE(programId, position)`, `UNIQUE(workoutId, position)`; reordering runs in a transaction in two steps (`applyOrder`) |
| Weight 0–1000 kg, `NUMERIC(6,2)`                                                                                           | Zod + `CHECK`                                                                                                              |
| Reps 0–1000, a completed set has ≥ 1                                                                                       | Zod + `CHECK ExerciseSet_completed_needs_reps`                                                                             |
| Set type `working` / `warmup` (default `working`); warm-ups are excluded from all statistics and from filling planned sets | `SetType` enum + `isWorkingSet` in `@gym/shared`                                                                           |
| Set comment up to 200 characters                                                                                           | `VARCHAR(200)` + Zod                                                                                                       |
| A library exercise used in history cannot be deleted                                                                       | `ON DELETE RESTRICT`; archive (`archivedAt`) instead                                                                       |
| Deleting a planned workout keeps its sessions                                                                              | `ON DELETE SET NULL` + name snapshot                                                                                       |
| Deleting a session deletes its sets                                                                                        | `ON DELETE CASCADE` (statistics are computed on read, so they update immediately)                                          |

**Weight rounding:** to 0.01 kg, half away from zero (`roundWeightKg`). Volume sums are computed in integer
hundredths of a kilogram so they are exact.

**Units:** stored in kilograms (`weightKg`). Supporting pounds only needs a display setting and client-side
conversion — the schema does not change.

## Indexes

- `WorkoutSession(userId, status, startedAt DESC)` — history, active session, counters.
- `WorkoutSession(programId, status, completedAt DESC)` — next workout of the cycle.
- `SessionExercise(exerciseId)`, `ExerciseSet(sessionExerciseId, setNumber)` — analytics and "last time".
- `Exercise(userId, archivedAt)`, `TrainingProgram(userId, archivedAt)` — lists.

## Migrations

```bash
pnpm db:migrate              # dev: create/apply a migration (prisma migrate dev)
pnpm db:deploy               # prod/CI: apply existing migrations (prisma migrate deploy)
pnpm --filter @gym/api db:studio
```

Migrations use `DIRECT_URL` (direct/session connection); the app uses `DATABASE_URL` (Supabase transaction
pooler). Partial indexes and `CHECK` constraints are written by hand in the migration SQL because Prisma cannot
describe them. When changing the schema, create the migration with `prisma migrate dev --create-only`, review
the SQL and keep those constraints.
