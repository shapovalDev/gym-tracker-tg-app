import {
  analyticsQuerySchema,
  duplicateSchema,
  exerciseCreateSchema,
  exerciseHistoryQuerySchema,
  exerciseListQuerySchema,
  exerciseUpdateSchema,
  meUpdateSchema,
  programCreateSchema,
  programListQuerySchema,
  programUpdateSchema,
  reorderSchema,
  sessionCompleteSchema,
  sessionExerciseAddSchema,
  sessionListQuerySchema,
  sessionStartSchema,
  setUpsertSchema,
  summaryQuerySchema,
  workoutCreateSchema,
  workoutExerciseCreateSchema,
  workoutExerciseUpdateSchema,
  workoutUpdateSchema,
} from '@gym/shared';
import type { ApiRouter } from '../http/router';
import * as analytics from '../services/analytics';
import * as exercises from '../services/exercises';
import * as programs from '../services/programs';
import * as sessions from '../services/sessions';

const toMe = (u: { id: string; telegramId: bigint; locale: string | null; createdAt: Date }) => ({
  id: u.id,
  telegramId: u.telegramId.toString(),
  locale: u.locale === 'en' || u.locale === 'uk' ? u.locale : null,
  createdAt: u.createdAt.toISOString(),
});

const NF = { 404: 'Not found or not owned by the current user' };

export function registerRoutes(r: ApiRouter) {
  // ---- Me ------------------------------------------------------------------
  r.route(
    { method: 'get', path: '/me', tag: 'Me', summary: 'Current user', response: 'MeDto' },
    async ({ c }) => {
      const user = await c.get('db').user.findUniqueOrThrow({ where: { id: c.get('userId') } });
      return toMe(user);
    },
  );
  r.route(
    {
      method: 'patch',
      path: '/me',
      tag: 'Me',
      summary: 'Update preferences (UI language)',
      body: meUpdateSchema,
      response: 'MeDto',
    },
    async ({ c, body }) =>
      toMe(
        await c
          .get('db')
          .user.update({ where: { id: c.get('userId') }, data: { locale: body.locale } }),
      ),
  );
  r.route(
    {
      method: 'get',
      path: '/me/home',
      tag: 'Me',
      summary: 'Home screen state',
      response: 'HomeDto',
    },
    ({ c }) => analytics.homeState(c.get('db'), c.get('userId')),
  );

  // ---- Exercises -----------------------------------------------------------
  r.route(
    {
      method: 'get',
      path: '/exercises',
      tag: 'Exercises',
      summary: 'List/search exercise library',
      query: exerciseListQuerySchema,
      response: '{ items: ExerciseDto[] }',
    },
    ({ c, query }) => exercises.listExercises(c.get('db'), c.get('userId'), query),
  );
  r.route(
    {
      method: 'post',
      path: '/exercises',
      tag: 'Exercises',
      summary: 'Create exercise',
      body: exerciseCreateSchema,
      status: 201,
      response: 'ExerciseDto',
    },
    ({ c, body }) => exercises.createExercise(c.get('db'), c.get('userId'), body),
  );
  r.route(
    {
      method: 'get',
      path: '/exercises/:exerciseId',
      tag: 'Exercises',
      summary: 'Get exercise',
      response: 'ExerciseDto',
      errors: NF,
    },
    ({ c, params }) => exercises.getExercise(c.get('db'), c.get('userId'), params.exerciseId!),
  );
  r.route(
    {
      method: 'get',
      path: '/exercises/:exerciseId/history',
      tag: 'Exercises',
      summary: 'Recent completed sessions of an exercise with all sets',
      query: exerciseHistoryQuerySchema,
      response: '{ items: ExerciseHistoryEntryDto[] }',
      errors: NF,
    },
    ({ c, params, query }) =>
      exercises.exerciseHistory(c.get('db'), c.get('userId'), params.exerciseId!, query.limit ?? 6),
  );
  r.route(
    {
      method: 'patch',
      path: '/exercises/:exerciseId',
      tag: 'Exercises',
      summary: 'Update exercise (rename keeps history)',
      body: exerciseUpdateSchema,
      response: 'ExerciseDto',
      errors: NF,
    },
    ({ c, params, body }) =>
      exercises.updateExercise(c.get('db'), c.get('userId'), params.exerciseId!, body),
  );
  r.route(
    {
      method: 'post',
      path: '/exercises/:exerciseId/archive',
      tag: 'Exercises',
      summary: 'Archive exercise (history kept)',
      response: 'ExerciseDto',
      errors: NF,
    },
    ({ c, params }) =>
      exercises.setExerciseArchived(c.get('db'), c.get('userId'), params.exerciseId!, true),
  );
  r.route(
    {
      method: 'post',
      path: '/exercises/:exerciseId/unarchive',
      tag: 'Exercises',
      summary: 'Restore archived exercise',
      response: 'ExerciseDto',
      errors: NF,
    },
    ({ c, params }) =>
      exercises.setExerciseArchived(c.get('db'), c.get('userId'), params.exerciseId!, false),
  );

  // ---- Programs ------------------------------------------------------------
  r.route(
    {
      method: 'get',
      path: '/programs',
      tag: 'Programs',
      summary: 'List programs',
      query: programListQuerySchema,
      response: '{ items: ProgramSummaryDto[] }',
    },
    ({ c, query }) =>
      programs.listPrograms(c.get('db'), c.get('userId'), query.archived === 'true'),
  );
  r.route(
    {
      method: 'post',
      path: '/programs',
      tag: 'Programs',
      summary: 'Create program (optionally with workouts)',
      body: programCreateSchema,
      status: 201,
      response: 'ProgramDto',
    },
    ({ c, body }) => programs.createProgram(c.get('db'), c.get('userId'), body),
  );
  r.route(
    {
      method: 'get',
      path: '/programs/:programId',
      tag: 'Programs',
      summary: 'Program with workouts, planned exercises and next workout',
      response: 'ProgramDto',
      errors: NF,
    },
    ({ c, params }) => programs.getProgram(c.get('db'), c.get('userId'), params.programId!),
  );
  r.route(
    {
      method: 'patch',
      path: '/programs/:programId',
      tag: 'Programs',
      summary: 'Update name/description',
      body: programUpdateSchema,
      response: 'ProgramDto',
      errors: NF,
    },
    ({ c, params, body }) =>
      programs.updateProgram(c.get('db'), c.get('userId'), params.programId!, body),
  );
  r.route(
    {
      method: 'post',
      path: '/programs/:programId/activate',
      tag: 'Programs',
      summary: 'Make this the active program',
      response: 'ProgramDto',
      errors: { ...NF, 409: 'Program is archived' },
    },
    ({ c, params }) => programs.activateProgram(c.get('db'), c.get('userId'), params.programId!),
  );
  r.route(
    {
      method: 'post',
      path: '/programs/:programId/archive',
      tag: 'Programs',
      summary: 'Archive (history kept, deactivates)',
      response: 'ProgramDto',
      errors: NF,
    },
    ({ c, params }) =>
      programs.setProgramArchived(c.get('db'), c.get('userId'), params.programId!, true),
  );
  r.route(
    {
      method: 'post',
      path: '/programs/:programId/unarchive',
      tag: 'Programs',
      summary: 'Restore archived program',
      response: 'ProgramDto',
      errors: NF,
    },
    ({ c, params }) =>
      programs.setProgramArchived(c.get('db'), c.get('userId'), params.programId!, false),
  );
  r.route(
    {
      method: 'post',
      path: '/programs/:programId/duplicate',
      body: duplicateSchema,
      tag: 'Programs',
      summary: 'Deep copy of a program',
      status: 201,
      response: 'ProgramDto',
      errors: NF,
    },
    ({ c, params, body }) =>
      programs.duplicateProgram(c.get('db'), c.get('userId'), params.programId!, body.name),
  );
  r.route(
    {
      method: 'post',
      path: '/programs/:programId/workouts',
      tag: 'Workouts',
      summary: 'Append a workout to the cycle',
      body: workoutCreateSchema,
      status: 201,
      response: 'ProgramDto',
      errors: NF,
    },
    ({ c, params, body }) =>
      programs.addWorkout(c.get('db'), c.get('userId'), params.programId!, body.name),
  );
  r.route(
    {
      method: 'put',
      path: '/programs/:programId/workouts/order',
      tag: 'Workouts',
      summary: 'Reorder workouts (full list of ids)',
      body: reorderSchema,
      response: 'ProgramDto',
      errors: NF,
    },
    ({ c, params, body }) =>
      programs.reorderWorkouts(c.get('db'), c.get('userId'), params.programId!, body.ids),
  );

  // ---- Workouts ------------------------------------------------------------
  r.route(
    {
      method: 'patch',
      path: '/workouts/:workoutId',
      tag: 'Workouts',
      summary: 'Rename workout or change its day of the week',
      body: workoutUpdateSchema,
      response: 'ProgramDto',
      errors: { ...NF, 409: 'WEEKDAY_TAKEN: another workout is planned for this day' },
    },
    ({ c, params, body }) =>
      programs.updateWorkout(c.get('db'), c.get('userId'), params.workoutId!, body),
  );
  r.route(
    {
      method: 'delete',
      path: '/workouts/:workoutId',
      tag: 'Workouts',
      summary: 'Delete planned workout (sessions kept)',
      response: 'ProgramDto',
      errors: NF,
    },
    ({ c, params }) => programs.deleteWorkout(c.get('db'), c.get('userId'), params.workoutId!),
  );
  r.route(
    {
      method: 'post',
      path: '/workouts/:workoutId/duplicate',
      body: duplicateSchema,
      tag: 'Workouts',
      summary: 'Duplicate workout',
      status: 201,
      response: 'ProgramDto',
      errors: NF,
    },
    ({ c, params, body }) =>
      programs.duplicateWorkout(c.get('db'), c.get('userId'), params.workoutId!, body.name),
  );
  r.route(
    {
      method: 'post',
      path: '/workouts/:workoutId/exercises',
      tag: 'Workouts',
      summary: 'Add planned exercise',
      body: workoutExerciseCreateSchema,
      status: 201,
      response: 'ProgramDto',
      errors: { ...NF, 409: 'Exercise archived' },
    },
    ({ c, params, body }) =>
      programs.addWorkoutExercise(c.get('db'), c.get('userId'), params.workoutId!, body),
  );
  r.route(
    {
      method: 'put',
      path: '/workouts/:workoutId/exercises/order',
      tag: 'Workouts',
      summary: 'Reorder planned exercises',
      body: reorderSchema,
      response: 'ProgramDto',
      errors: NF,
    },
    ({ c, params, body }) =>
      programs.reorderWorkoutExercises(c.get('db'), c.get('userId'), params.workoutId!, body.ids),
  );
  r.route(
    {
      method: 'patch',
      path: '/workout-exercises/:workoutExerciseId',
      tag: 'Workouts',
      summary: 'Edit planned sets / rep range / notes',
      body: workoutExerciseUpdateSchema,
      response: 'ProgramDto',
      errors: NF,
    },
    ({ c, params, body }) =>
      programs.updateWorkoutExercise(c.get('db'), c.get('userId'), params.workoutExerciseId!, body),
  );
  r.route(
    {
      method: 'delete',
      path: '/workout-exercises/:workoutExerciseId',
      tag: 'Workouts',
      summary: 'Remove planned exercise',
      response: 'ProgramDto',
      errors: NF,
    },
    ({ c, params }) =>
      programs.deleteWorkoutExercise(c.get('db'), c.get('userId'), params.workoutExerciseId!),
  );

  // ---- Sessions ------------------------------------------------------------
  r.route(
    {
      method: 'post',
      path: '/sessions',
      tag: 'Sessions',
      summary: 'Start a workout session (idempotent with client id)',
      body: sessionStartSchema,
      status: 201,
      response: 'SessionDto',
      errors: { ...NF, 409: 'SESSION_IN_PROGRESS: another session is unfinished' },
    },
    ({ c, body }) => sessions.startSession(c.get('db'), c.get('userId'), body),
  );
  r.route(
    {
      method: 'get',
      path: '/sessions/active',
      tag: 'Sessions',
      summary: 'The unfinished session, or null',
      response: '{ session: SessionDto | null }',
    },
    async ({ c }) => ({ session: await sessions.getActiveSession(c.get('db'), c.get('userId')) }),
  );
  r.route(
    {
      method: 'get',
      path: '/sessions',
      tag: 'Sessions',
      summary: 'History (cursor pagination, date range)',
      query: sessionListQuerySchema,
      response: 'Paginated<SessionListItemDto>',
    },
    ({ c, query }) => sessions.listSessions(c.get('db'), c.get('userId'), query),
  );
  r.route(
    {
      method: 'get',
      path: '/sessions/:sessionId',
      tag: 'Sessions',
      summary: 'Session detail with previous results',
      response: 'SessionDto',
      errors: NF,
    },
    ({ c, params }) => sessions.getSession(c.get('db'), c.get('userId'), params.sessionId!),
  );
  r.route(
    {
      method: 'delete',
      path: '/sessions/:sessionId',
      tag: 'Sessions',
      summary: 'Delete a session and its sets',
      status: 204,
      errors: NF,
    },
    async ({ c, params }) =>
      sessions.deleteSession(c.get('db'), c.get('userId'), params.sessionId!),
  );
  r.route(
    {
      method: 'post',
      path: '/sessions/:sessionId/complete',
      tag: 'Sessions',
      summary: 'Finish session',
      body: sessionCompleteSchema,
      response: 'SessionDto',
      errors: {
        ...NF,
        409: 'INCOMPLETE_SESSION (resend with confirmIncomplete) or SESSION_CANCELLED',
      },
    },
    ({ c, params, body }) =>
      sessions.completeSession(
        c.get('db'),
        c.get('userId'),
        params.sessionId!,
        body.confirmIncomplete ?? false,
      ),
  );
  r.route(
    {
      method: 'post',
      path: '/sessions/:sessionId/cancel',
      tag: 'Sessions',
      summary: 'Cancel unfinished session',
      response: 'SessionDto',
      errors: { ...NF, 409: 'Already completed' },
    },
    ({ c, params }) => sessions.cancelSession(c.get('db'), c.get('userId'), params.sessionId!),
  );
  r.route(
    {
      method: 'post',
      path: '/sessions/:sessionId/exercises',
      tag: 'Sessions',
      summary: 'Add an exercise to a session',
      body: sessionExerciseAddSchema,
      status: 201,
      response: 'SessionDto',
      errors: NF,
    },
    ({ c, params, body }) =>
      sessions.addSessionExercise(c.get('db'), c.get('userId'), params.sessionId!, body),
  );
  r.route(
    {
      method: 'delete',
      path: '/sessions/:sessionId/exercises/:sessionExerciseId',
      tag: 'Sessions',
      summary: 'Remove an exercise (and its sets) from a session',
      response: 'SessionDto',
      errors: NF,
    },
    ({ c, params }) =>
      sessions.removeSessionExercise(
        c.get('db'),
        c.get('userId'),
        params.sessionId!,
        params.sessionExerciseId!,
      ),
  );
  r.route(
    {
      method: 'put',
      path: '/sessions/:sessionId/sets/:setId',
      tag: 'Sessions',
      summary: 'Create or replace a set (client-generated id; safe to retry)',
      body: setUpsertSchema,
      response: 'SetDto',
      errors: { ...NF, 409: 'Session cancelled / too many sets' },
    },
    async ({ c, params, body }) => {
      const { set, created } = await sessions.upsertSet(
        c.get('db'),
        c.get('userId'),
        params.sessionId!,
        params.setId!,
        body,
      );
      c.status(created ? 201 : 200);
      return set;
    },
  );
  r.route(
    {
      method: 'delete',
      path: '/sessions/:sessionId/sets/:setId',
      tag: 'Sessions',
      summary: 'Delete a set (idempotent); remaining sets renumbered',
      status: 204,
      errors: NF,
    },
    async ({ c, params }) =>
      sessions.deleteSet(c.get('db'), c.get('userId'), params.sessionId!, params.setId!),
  );

  // ---- Analytics -----------------------------------------------------------
  r.route(
    {
      method: 'get',
      path: '/analytics/summary',
      tag: 'Analytics',
      summary: 'Totals for a period vs the previous one',
      query: summaryQuerySchema,
      response: 'StatsSummaryDto',
    },
    ({ c, query }) => analytics.statsSummary(c.get('db'), c.get('userId'), query.period),
  );
  r.route(
    {
      method: 'get',
      path: '/analytics/exercises/:exerciseId',
      tag: 'Analytics',
      summary: 'Time series, records and summary for one exercise',
      query: analyticsQuerySchema,
      response: 'ExerciseAnalyticsDto',
      errors: NF,
    },
    ({ c, params, query }) =>
      analytics.exerciseAnalytics(
        c.get('db'),
        c.get('userId'),
        params.exerciseId!,
        query.period,
        query.weightKg,
      ),
  );
}
