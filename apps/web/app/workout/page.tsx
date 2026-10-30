'use client';

import {
  previousCounterpart,
  setLabels,
  setsOfType,
  summarizeSession,
  type SessionDto,
  type SessionExerciseDto,
  type SetDto,
  type SetType,
} from '@gym/shared';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { CheckIcon, ChevronLeft, ChevronRight, DotsIcon, PlusIcon } from '@/components/icons';
import { useElapsed } from '@/components/shell';
import {
  ActionSheet,
  BottomBar,
  Button,
  ConfirmSheet,
  EmptyState,
  ErrorState,
  IconButton,
  LinkButton,
  PageLoader,
  Stat,
  cx,
} from '@/components/ui';
import { ExerciseNotes } from '@/features/exercises/notes';
import { ExercisePicker } from '@/features/exercises/exercise-picker';
import { SetEntry, type SetEntryValue } from '@/features/workout/set-entry';
import { ExerciseHistorySheet } from '@/features/workout/exercise-history-sheet';
import { LastTimeButton, SetDots, SetRow } from '@/features/workout/set-list';
import { errorMessage, http } from '@/lib/api';
import {
  formatClock,
  formatDate,
  formatDuration,
  formatVolume,
  muscleLabel,
  targetLabel,
} from '@/lib/format';
import { useApiMutation } from '@/lib/mutations';
import { discardSession, drain, push, useOutbox } from '@/lib/outbox';
import { applyPending } from '@/lib/outbox-core';
import { queryKeys, useActiveSession } from '@/lib/queries';
import { haptic, setClosingConfirmation } from '@/lib/telegram';
import { toast } from '@/lib/toast';
import { count, t } from '@/i18n';

export default function WorkoutPage() {
  const { data: serverSession, isLoading, error, refetch } = useActiveSession();
  const { queue } = useOutbox();
  const [summary, setSummary] = useState<SessionDto | null>(null);
  const session = useMemo(
    () => (serverSession ? applyPending(serverSession, queue) : null),
    [serverSession, queue],
  );

  useEffect(() => {
    setClosingConfirmation(!!serverSession);
    return () => setClosingConfirmation(false);
  }, [serverSession]);

  if (summary) return <WorkoutSummary session={summary} />;
  if (isLoading) return <PageLoader />;
  if (error) return <ErrorState message={errorMessage(error)} onRetry={() => refetch()} />;
  if (!session)
    return (
      <div className="pt-8">
        <EmptyState
          title={t('No workout right now')}
          text={t('Start a workout from Home.')}
          action={<LinkButton href="/">{t('Go to Home')}</LinkButton>}
        />
      </div>
    );
  return <ActiveWorkout session={session} onCompleted={setSummary} />;
}

/** Warm-ups never count towards the plan. */
const workingSets = (e: SessionExerciseDto) => e.sets.filter((s) => s.setType !== 'warmup');
const isDone = (e: SessionExerciseDto) => workingSets(e).length >= Math.max(e.plannedSets ?? 0, 1);

function ActiveWorkout({
  session,
  onCompleted,
}: {
  session: SessionDto;
  onCompleted: (s: SessionDto) => void;
}) {
  const router = useRouter();
  const qc = useQueryClient();
  const [openId, setOpenId] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  const [menu, setMenu] = useState(false);
  const [finishOpen, setFinishOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [removing, setRemoving] = useState<SessionExerciseDto | null>(null);
  const [finishing, setFinishing] = useState(false);

  const open = session.exercises.find((e) => e.id === openId) ?? null;
  const unfinished = session.exercises.filter((e) => !isDone(e));
  const doneCount = session.exercises.length - unfinished.length;
  const live = summarizeSession({
    startedAt: new Date(session.startedAt),
    completedAt: null,
    exercises: session.exercises,
  });

  const setSession = (s: SessionDto) => qc.setQueryData(queryKeys.activeSession, s);
  const addExercise = useApiMutation(
    (exerciseId: string) =>
      http.post<SessionDto>(`/sessions/${session.id}/exercises`, {
        id: crypto.randomUUID(),
        exerciseId,
      }),
    { onSuccess: setSession },
  );
  const removeExercise = useApiMutation(
    (se: SessionExerciseDto) => http.del<SessionDto>(`/sessions/${session.id}/exercises/${se.id}`),
    {
      onSuccess: (s, se) => {
        setSession(s);
        setOpenId(null);
        setRemoving(null);
        toast(t('“{name}” removed from the workout', { name: se.name }));
      },
    },
  );
  const cancel = useApiMutation(() => http.post<SessionDto>(`/sessions/${session.id}/cancel`), {
    invalidate: [['home'], ['history']],
    onSuccess: () => {
      discardSession(session.id);
      qc.setQueryData(queryKeys.activeSession, null);
      router.replace('/');
    },
  });
  // Always confirmed: the button sits right under the set list and is easy to hit by accident.
  const askRemove = (se: SessionExerciseDto) => setRemoving(se);

  const finish = async () => {
    setFinishing(true);
    try {
      // Never complete while sets are still only on this device.
      if (!(await drain())) {
        toast(
          t('Offline. Sets are saved on the phone — finish when the connection is back.'),
          'error',
        );
        return;
      }
      const done = await http.post<SessionDto>(`/sessions/${session.id}/complete`, {
        confirmIncomplete: true,
      });
      haptic.success();
      qc.setQueryData(queryKeys.activeSession, null);
      for (const key of [
        queryKeys.home,
        ['history'],
        ['analytics'],
        ['summary'],
        ['exercise-history'],
      ])
        void qc.invalidateQueries({ queryKey: key });
      onCompleted(done);
    } catch (e) {
      toast(errorMessage(e), 'error');
    } finally {
      setFinishing(false);
      setFinishOpen(false);
    }
  };

  const header = (
    <header className="flex items-start justify-between gap-2 px-1 pt-3">
      <div className="min-w-0">
        <p className="num text-[18px] font-semibold text-muted" aria-label={t('Workout duration')}>
          <WorkoutClock startedAt={session.startedAt} />
        </p>
        <h1 className="display truncate text-[34px] leading-[1.02]">
          {session.workoutName ?? t('Free workout')}
        </h1>
      </div>
      <IconButton label={t('Workout actions')} className="-mr-2" onClick={() => setMenu(true)}>
        <DotsIcon />
      </IconButton>
    </header>
  );

  return (
    <>
      {header}
      {open ? (
        <ExerciseView
          key={open.id}
          session={session}
          exercise={open}
          onBack={() => setOpenId(null)}
          onNavigate={setOpenId}
          onRemove={() => askRemove(open)}
        />
      ) : (
        <>
          <div className="space-y-2 px-1">
            <div className="flex items-baseline justify-between gap-3">
              <span className="eyebrow">
                {t('{done} of {total} exercises', {
                  done: doneCount,
                  total: session.exercises.length,
                })}
              </span>
              <span className="text-[13px] font-semibold">
                {count(live.totalSets, 'set')} · {formatVolume(live.volumeKg)}
              </span>
            </div>
            {session.exercises.length > 0 && (
              <div className="flex gap-1.5" aria-hidden>
                {session.exercises.map((e) => (
                  <span
                    key={e.id}
                    className={cx(
                      'h-2 flex-1 rounded-full transition-colors',
                      isDone(e) ? 'bg-done' : e.sets.length ? 'bg-muted' : 'bg-inset',
                    )}
                  />
                ))}
              </div>
            )}
          </div>

          {session.exercises.length === 0 ? (
            <EmptyState
              title={t('Add exercises')}
              text={t('This is a free workout: pick exercises from your library.')}
              action={
                <Button onClick={() => setPicking(true)}>
                  <PlusIcon /> {t('Add exercises')}
                </Button>
              }
            />
          ) : (
            <ol className="space-y-2">
              {session.exercises.map((e, i) => {
                const completed = workingSets(e).filter((s) => s.status === 'completed').length;
                const done = isDone(e);
                const started = !done && e.sets.length > 0;
                const reps = targetLabel(null, e.targetRepsMin, e.targetRepsMax);
                return (
                  <li key={e.id}>
                    <button
                      type="button"
                      onClick={() => setOpenId(e.id)}
                      className={cx(
                        'press flex w-full items-center gap-3.5 rounded-2xl px-3.5 py-3 text-left',
                        done
                          ? 'border border-line'
                          : started
                            ? 'border-2 border-ink bg-card'
                            : 'border border-line bg-card',
                      )}
                    >
                      <span
                        className={cx(
                          'num grid size-9 shrink-0 place-items-center rounded-[10px] text-[17px] font-bold',
                          done
                            ? 'bg-done text-on-done'
                            : started
                              ? 'bg-ink text-bg'
                              : 'bg-inset text-muted',
                        )}
                      >
                        {done ? <CheckIcon /> : i + 1}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[16px] leading-snug font-semibold">
                          {e.name}
                        </span>
                        <span className="mt-1 flex items-center gap-2">
                          <SetDots done={workingSets(e).length} planned={e.plannedSets ?? 0} />
                          <span className="text-[13px] text-muted">
                            {e.plannedSets
                              ? t('{done} of {total} sets', {
                                  done: completed,
                                  total: e.plannedSets,
                                })
                              : count(completed, 'set')}
                            {/* targetLabel already says "reps" */}
                            {reps ? ` · ${reps}` : ''}
                          </span>
                        </span>
                      </span>
                      <span className="text-muted">
                        <ChevronRight />
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>
          )}

          <BottomBar>
            <Button
              variant="secondary"
              size="lg"
              onClick={() => setPicking(true)}
              loading={addExercise.isPending}
            >
              <PlusIcon /> {t('Exercise')}
            </Button>
            <Button size="lg" className="flex-1" onClick={() => setFinishOpen(true)}>
              {t('Finish')}
            </Button>
          </BottomBar>
        </>
      )}

      <ExercisePicker
        open={picking}
        onClose={() => setPicking(false)}
        title={t('Add to workout')}
        addedIds={session.exercises.map((e) => e.exerciseId)}
        onPick={(e) => addExercise.mutate(e.id)}
      />
      <ActionSheet
        open={menu}
        onClose={() => setMenu(false)}
        title={session.workoutName ?? t('Free workout')}
        actions={[
          { label: t('Add exercise'), onClick: () => setPicking(true) },
          open && {
            label: t('Remove “{name}”', { name: open.name }),
            danger: true,
            onClick: () => askRemove(open),
          },
          { label: t('Finish workout'), onClick: () => setFinishOpen(true) },
          {
            label: t('Cancel workout'),
            hint: t('Will not appear in history or statistics'),
            danger: true,
            onClick: () => setCancelOpen(true),
          },
        ]}
      />
      <ConfirmSheet
        open={finishOpen}
        onClose={() => setFinishOpen(false)}
        title={t('Finish the workout?')}
        text={
          unfinished.length > 0
            ? t('Not all sets are recorded: {names}. Unrecorded sets will not count.', {
                names: unfinished.map((e) => e.name).join(', '),
              })
            : t('The results will be saved to history.')
        }
        confirmLabel={unfinished.length > 0 ? t('Finish anyway') : t('Finish')}
        loading={finishing}
        onConfirm={finish}
      />
      <ConfirmSheet
        open={!!removing}
        onClose={() => setRemoving(null)}
        title={t('Remove “{name}”?', { name: removing?.name ?? '' })}
        text={
          removing?.sets.length
            ? t('The recorded sets of this exercise will be deleted.')
            : t('You can add it again with “Add exercise”.')
        }
        confirmLabel={t('Remove')}
        danger
        loading={removeExercise.isPending}
        onConfirm={() => removing && removeExercise.mutate(removing)}
      />
      <ConfirmSheet
        open={cancelOpen}
        onClose={() => setCancelOpen(false)}
        title={t('Cancel the workout?')}
        text={t('It will not count as done, and the program cycle will not move.')}
        confirmLabel={t('Cancel workout')}
        danger
        loading={cancel.isPending}
        onConfirm={() => cancel.mutate(undefined)}
      />
    </>
  );
}

/** Only this tiny component re-renders every second, not the whole workout screen. */
function WorkoutClock({ startedAt }: { startedAt: string }) {
  return <>{formatClock(useElapsed(startedAt))}</>;
}

function ExerciseView({
  session,
  exercise,
  onBack,
  onNavigate,
  onRemove,
}: {
  session: SessionDto;
  exercise: SessionExerciseDto;
  onBack: () => void;
  onNavigate: (id: string) => void;
  onRemove: () => void;
}) {
  const [editing, setEditing] = useState<SetDto | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const index = session.exercises.findIndex((e) => e.id === exercise.id);
  const prevEx = session.exercises[index - 1];
  const nextEx = session.exercises[index + 1];
  const sets = exercise.sets;
  const target = targetLabel(exercise.plannedSets, exercise.targetRepsMin, exercise.targetRepsMax);
  const labels = setLabels(sets, t('W'));
  const counts = {
    working: setsOfType(sets, 'working').length,
    warmup: setsOfType(sets, 'warmup').length,
  };
  /** Last time's counterpart of the n-th set of a type (n is 0-based). */
  const lastTimeAt = (type: SetType, n: number) =>
    previousCounterpart(exercise.previous?.sets, type, n);

  // Suggestion only: last set of today, else the first set from last time.
  const suggestion = useMemo(() => {
    const last = sets.at(-1);
    if (last) return { weightKg: last.weightKg, reps: last.reps };
    const prev = exercise.previous?.sets.find((s) => s.status === 'completed');
    return prev ? { weightKg: prev.weightKg, reps: prev.reps } : null;
  }, [sets, exercise.previous]);

  // Rendered state can lag behind fast taps; number new sets from a ref so two
  // quick "Записать" never produce the same set number.
  const numbered = useRef({ exerciseId: exercise.id, last: sets.length });
  if (numbered.current.exerciseId !== exercise.id)
    numbered.current = { exerciseId: exercise.id, last: sets.length };
  else numbered.current.last = Math.max(numbered.current.last, sets.length);

  const save = (v: SetEntryValue, set?: SetDto) => {
    const setNumber = set?.setNumber ?? ++numbered.current.last;
    push({
      kind: 'putSet',
      sessionId: session.id,
      setId: set?.id ?? crypto.randomUUID(),
      body: {
        sessionExerciseId: exercise.id,
        setNumber,
        weightKg: v.weightKg,
        reps: v.reps,
        status: v.status,
        setType: v.setType,
        note: v.note,
      },
    });
    haptic.tap();
    setEditing(null);
  };
  const remove = (set: SetDto) => {
    numbered.current.last = Math.max(0, numbered.current.last - 1);
    push({ kind: 'deleteSet', sessionId: session.id, setId: set.id });
    setEditing(null);
  };

  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={onBack}
        className="press flex h-10 items-center gap-0.5 rounded-xl border border-line pr-3 pl-1.5 text-[14px] font-semibold"
      >
        <ChevronLeft /> {t('All exercises')}
      </button>

      <div className="space-y-2.5">
        <p className="eyebrow">
          {t('Exercise {n} of {total}', { n: index + 1, total: session.exercises.length })}
          {exercise.muscleGroup ? ` · ${muscleLabel(exercise.muscleGroup)}` : ''}
        </p>
        <h2 className="display text-[32px] leading-[1.02]">{exercise.name}</h2>
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="rounded-lg bg-inset px-2.5 py-1 text-[13px] font-semibold">
            {target ? t('Plan: {target}', { target }) : t('No plan set')}
          </span>
          <SetDots done={workingSets(exercise).length} planned={exercise.plannedSets ?? 0} />
        </div>
        <ExerciseNotes plan={exercise.notes} technique={exercise.description} />
      </div>

      <LastTimeButton
        previous={exercise.previous}
        date={exercise.previous ? formatDate(exercise.previous.date).toLowerCase() : null}
        onOpen={() => setHistoryOpen(true)}
      />

      {sets.length > 0 && (
        <ul className="space-y-2" aria-label={t('Sets')}>
          {sets.map((s) =>
            editing?.id === s.id ? (
              <li key={s.id}>
                <SetEntry
                  key={`edit-${s.id}`}
                  title={t('Edit: {name}', {
                    name:
                      s.setType === 'warmup'
                        ? t('Warm-up {n}', { n: (labels.get(s) ?? '').replace(/^\D+/, '') })
                        : t('Set {n}', { n: labels.get(s) ?? '' }),
                  })}
                  initial={{ weightKg: s.weightKg, reps: s.reps, setType: s.setType, note: s.note }}
                  lastTime={(type) =>
                    lastTimeAt(
                      type,
                      setsOfType(sets, type).findIndex((x) => x.id === s.id),
                    )
                  }
                  submitLabel={t('Save')}
                  onSubmit={(v) => save(v, s)}
                  onCancel={() => setEditing(null)}
                />
              </li>
            ) : (
              <SetRow
                key={s.id}
                set={s}
                label={labels.get(s) ?? ''}
                onEdit={() => setEditing(s)}
                onDelete={() => remove(s)}
              />
            ),
          )}
        </ul>
      )}

      {/* Stays mounted between sets: after "Записать" the fields keep the values just
          entered (the natural suggestion for the next set). Remounting here would race
          with fast input and could overwrite what the user is typing. */}
      {!editing && (
        <SetEntry
          key={`new-${exercise.id}`}
          counts={counts}
          suggestion={suggestion}
          lastTime={(type) => lastTimeAt(type, counts[type])}
          onSubmit={(v) => save(v)}
        />
      )}

      <button
        type="button"
        className="block w-full py-2 text-center text-[14px] font-medium text-danger"
        onClick={onRemove}
      >
        {t('Remove exercise from the workout')}
      </button>

      <ExerciseHistorySheet
        exerciseId={exercise.exerciseId}
        name={exercise.name}
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
      />

      <BottomBar>
        <Button
          variant="secondary"
          aria-label={t('Previous exercise')}
          disabled={!prevEx}
          onClick={() => prevEx && onNavigate(prevEx.id)}
        >
          <ChevronLeft />
        </Button>
        {nextEx ? (
          <Button className="min-w-0 flex-1" onClick={() => onNavigate(nextEx.id)}>
            <span className="truncate">{t('Next: {name}', { name: nextEx.name })}</span>
            <ChevronRight />
          </Button>
        ) : (
          <Button className="flex-1" onClick={onBack}>
            {t('Back to exercise list')}
          </Button>
        )}
      </BottomBar>
    </div>
  );
}

function WorkoutSummary({ session }: { session: SessionDto }) {
  const s = session.summary;
  return (
    <div className="space-y-3 pt-4">
      <div className="relative overflow-hidden rounded-[24px] bg-island px-5 pt-6 pb-5 text-on-island">
        <span className="grid size-14 place-items-center rounded-full bg-island-btn text-on-island-btn">
          <CheckIcon />
        </span>
        <h1 className="display mt-4 text-[42px] leading-[0.98]">{t('Workout finished')}</h1>
        <p className="mt-2 text-[15px] text-island-muted">
          {session.workoutName ?? t('Free workout')} · {formatDate(session.startedAt)}
        </p>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Stat
          label={t('Total duration')}
          value={formatDuration(s.durationSeconds)}
          sub={t('from start to finish')}
        />
        <Stat label={t('Volume')} value={formatVolume(s.volumeKg)} sub={t('weight × reps')} />
        <Stat label={t('Exercises')} value={s.exercisesCompleted} />
        <Stat
          label={t('Sets')}
          value={s.totalSets}
          sub={s.skippedSets ? t('{n} more skipped', { n: s.skippedSets }) : undefined}
        />
      </div>
      <BottomBar>
        <LinkButton
          href={`/history/${session.id}`}
          variant="secondary"
          size="lg"
          className="flex-1"
        >
          {t('Details')}
        </LinkButton>
        <LinkButton href="/" size="lg" className="flex-1">
          {t('Go to Home')}
        </LinkButton>
      </BottomBar>
    </div>
  );
}
