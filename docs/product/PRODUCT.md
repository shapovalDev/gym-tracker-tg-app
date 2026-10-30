# Product: Gym Tracker (Telegram Mini App)

The original specification is in [`SPEC.md`](./SPEC.md). This file records what the MVP includes and
the decisions taken where the specification left a choice.

## MVP — implemented

- **Home:** the next workout of the active program with its exercise list, "Start" / "Continue", choosing
  another workout of the cycle, this week's strip (done and planned days), the last workout, counters for 7
  and 30 days, empty state.
- **Programs:** any number of workouts per program, rename, description, add/delete/reorder workouts,
  planned exercises per workout (sets, rep range, note), reordering, one-tap removal with undo, adding several
  exercises from the library in one go, duplicating workouts and programs, switching the active program, archive.
  Optional weekly schedule: when creating a program, each workout can be pinned to a day of the week (one
  workout per day); the cycle is then ordered by the days. The day can be changed later ("Name and day").
  With a schedule the next workout follows the calendar: today's workout, or — on a rest day or once
  something of the program was done today — the one of the next planned day. Without pinned days the cycle
  decides as before.
- **Exercise library:** create, muscle group, technique notes, search, filter, edit, archive. Technique notes
  and plan notes are shown in the workout plan and during the workout.
- **Workout:** start and restore after reload, exercise list with set progress, exercise screen (plan, notes,
  "last time", recorded sets, weight/reps steppers), edit/delete/skip sets, add/remove exercises, finish with a
  confirmation when sets are missing, cancel, summary (duration, exercises, sets, volume), offline queue.
- **Set details:** a set can be marked as a warm-up (shown as Р1, Р2…; excluded from volume, charts, records
  and from the planned-set count) and can carry a comment (≤ 200 chars, quick options).
- **Last time, per set:** the entry form shows the matching set from the previous session (n-th working set vs
  n-th working set, warm-up vs warm-up). A compact \"last time\" button opens the exercise history sheet with all
  sets, weights, warm-ups and comments of recent sessions.
- **History:** paginated list, period filter (30/90 days, custom), details, editing and adding sets, deleting a session.
- **Progress:** exercise and period (30 days / 90 days / year / all time), charts of max weight, reps at a
  selected weight and volume, table view, personal records, totals and change versus the previous period.

- **Languages:** English and Ukrainian (Russian removed). Default from the Telegram language (`uk` → Ukrainian,
  otherwise English); the choice is stored per user on the server.
- **Leaving a workout:** the tab bar stays available during a workout; a banner on every other page leads back.

## Decisions on open questions

| Question                                             | Decision                                                                                                             |
| ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Next workout when the last completed one was deleted | The cycle restarts from the first workout                                                                            |
| Switching the active program                         | Each program keeps its own cycle position                                                                            |
| Skipping a workout                                   | A skip is not a completion. If you pick another workout manually and finish it, the next one is the workout after it |
| Cancelled workout                                    | Stored with status `cancelled`; not in history by default, not in statistics, does not advance the cycle             |
| Finishing without all planned sets                   | Requires confirmation; unrecorded sets simply do not exist                                                           |
| "Last time"                                          | Sets of the same exercise (by id) from the latest completed session before the current one                           |
| Matching \"last time\" set                           | By position within the set type, so warm-ups never shift the comparison of working sets                              |
| Weight suggestion                                    | Fields are pre-filled from the previous set, but nothing is saved until "Record set" is tapped                       |
| e1RM                                                 | Removed from the UI at the user's request (the API still computes it, Epley formula, for possible future use)        |
| Records                                              | All time; charts and totals use the selected period                                                                  |
| Reps chart                                           | Best reps at the selected weight; defaults to the heaviest weight of the period                                      |
| Weight                                               | 0–1000 kg, step 0.01, rounded to hundredths                                                                          |
| Duration                                             | From start to finish, labelled as total workout duration                                                             |

## Out of MVP scope

Social features, AI coach, nutrition, wearables, periodization, payments, admin panel, roles,
push notifications (section 14 of the spec). Storybook is not set up so as not to delay the MVP.

## Ideas for later

Rest timer, session notes, supersets, pounds, CSV export, program templates, reminders via the bot,
restricting the bot to an allowlist of Telegram ids.
