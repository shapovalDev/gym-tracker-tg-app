'use client';

import {
  MUSCLE_GROUP_LABELS,
  summarizeSession,
  type SessionDto,
  type SessionExerciseDto,
  type SetDto,
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
  Card,
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
import { PreviousSets, SetDots, SetRow } from '@/features/workout/set-list';
import { errorMessage, http } from '@/lib/api';
import {
  formatClock,
  formatDate,
  formatDuration,
  formatVolume,
  plural,
  targetLabel,
} from '@/lib/format';
import { useApiMutation } from '@/lib/mutations';
import { discardSession, drain, push, useOutbox } from '@/lib/outbox';
import { applyPending } from '@/lib/outbox-core';
import { queryKeys, useActiveSession } from '@/lib/queries';
import { haptic, setClosingConfirmation } from '@/lib/telegram';
import { toast } from '@/lib/toast';

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
          title="Сейчас нет тренировки"
          text="Начните тренировку с главного экрана."
          action={<LinkButton href="/">На главную</LinkButton>}
        />
      </div>
    );
  return <ActiveWorkout session={session} onCompleted={setSummary} />;
}

const isDone = (e: SessionExerciseDto) => e.sets.length >= Math.max(e.plannedSets ?? 0, 1);

function ActiveWorkout({
  session,
  onCompleted,
}: {
  session: SessionDto;
  onCompleted: (s: SessionDto) => void;
}) {
  const router = useRouter();
  const qc = useQueryClient();
  const elapsed = useElapsed(session.startedAt);
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
        toast(`«${se.name}» убрано из тренировки`);
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
  // Exercises without recorded sets go immediately; with sets — after a confirmation.
  const askRemove = (se: SessionExerciseDto) =>
    se.sets.length ? setRemoving(se) : removeExercise.mutate(se);

  const finish = async () => {
    setFinishing(true);
    try {
      // Never complete while sets are still only on this device.
      if (!(await drain())) {
        toast(
          'Нет сети. Подходы сохранены на телефоне — завершите, когда связь появится.',
          'error',
        );
        return;
      }
      const done = await http.post<SessionDto>(`/sessions/${session.id}/complete`, {
        confirmIncomplete: true,
      });
      haptic.success();
      qc.setQueryData(queryKeys.activeSession, null);
      for (const key of [queryKeys.home, ['history'], ['analytics'], ['summary']])
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
        <p className="num text-[15px] text-muted" aria-label="Длительность тренировки">
          {formatClock(elapsed)}
        </p>
        <h1 className="font-display truncate text-[22px] leading-tight font-semibold">
          {session.workoutName ?? 'Свободная тренировка'}
        </h1>
      </div>
      <IconButton label="Действия с тренировкой" className="-mr-2" onClick={() => setMenu(true)}>
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
          <Card className="p-4">
            <div className="flex items-baseline justify-between">
              <span className="text-[15px] font-semibold">
                {doneCount} из {session.exercises.length}{' '}
                {plural(session.exercises.length, 'упражнения', 'упражнений', 'упражнений')}
              </span>
              <span className="text-[14px] text-muted">
                {live.totalSets} {plural(live.totalSets, 'подход', 'подхода', 'подходов')},{' '}
                {formatVolume(live.volumeKg)}
              </span>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-inset" aria-hidden>
              <div
                className="h-full rounded-full bg-done transition-[width]"
                style={{
                  width: `${session.exercises.length ? (doneCount / session.exercises.length) * 100 : 0}%`,
                }}
              />
            </div>
          </Card>

          {session.exercises.length === 0 ? (
            <EmptyState
              title="Добавьте упражнения"
              text="Это свободная тренировка: выберите упражнения из библиотеки."
              action={
                <Button onClick={() => setPicking(true)}>
                  <PlusIcon /> Добавить упражнения
                </Button>
              }
            />
          ) : (
            <ol className="space-y-2.5">
              {session.exercises.map((e, i) => {
                const completed = e.sets.filter((s) => s.status === 'completed').length;
                const done = isDone(e);
                const reps = targetLabel(null, e.targetRepsMin, e.targetRepsMax);
                return (
                  <li key={e.id}>
                    <button
                      type="button"
                      onClick={() => setOpenId(e.id)}
                      className={cx(
                        'press flex w-full items-center gap-3 rounded-[22px] border bg-card p-4 text-left',
                        done ? 'border-done/40' : 'border-line',
                      )}
                    >
                      <span
                        className={cx(
                          'num grid size-10 shrink-0 place-items-center rounded-full text-[15px] font-semibold',
                          done ? 'bg-done text-white' : 'bg-inset text-ink',
                        )}
                      >
                        {done ? <CheckIcon /> : i + 1}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[17px] leading-snug font-semibold">
                          {e.name}
                        </span>
                        <span className="mt-1.5 flex items-center gap-2.5">
                          <SetDots done={e.sets.length} planned={e.plannedSets ?? 0} />
                          <span className="text-[14px] text-muted">
                            {completed}
                            {e.plannedSets ? ` из ${e.plannedSets}` : ''}{' '}
                            {plural(e.plannedSets || completed, 'подход', 'подхода', 'подходов')}
                            {reps ? `, по ${reps}` : ''}
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

          <BottomBar flush>
            <Button
              variant="secondary"
              className="flex-1"
              onClick={() => setPicking(true)}
              loading={addExercise.isPending}
            >
              <PlusIcon /> Упражнение
            </Button>
            <Button variant="success" className="flex-1" onClick={() => setFinishOpen(true)}>
              Завершить
            </Button>
          </BottomBar>
        </>
      )}

      <ExercisePicker
        open={picking}
        onClose={() => setPicking(false)}
        title="Добавить в тренировку"
        addedIds={session.exercises.map((e) => e.exerciseId)}
        onPick={(e) => addExercise.mutate(e.id)}
      />
      <ActionSheet
        open={menu}
        onClose={() => setMenu(false)}
        title={session.workoutName ?? 'Свободная тренировка'}
        actions={[
          { label: 'Добавить упражнение', onClick: () => setPicking(true) },
          open && { label: `Убрать «${open.name}»`, danger: true, onClick: () => askRemove(open) },
          { label: 'Завершить тренировку', onClick: () => setFinishOpen(true) },
          {
            label: 'Отменить тренировку',
            hint: 'Не попадёт в историю и статистику',
            danger: true,
            onClick: () => setCancelOpen(true),
          },
        ]}
      />
      <ConfirmSheet
        open={finishOpen}
        onClose={() => setFinishOpen(false)}
        title="Завершить тренировку?"
        text={
          unfinished.length > 0
            ? `Не все подходы записаны: ${unfinished.map((e) => e.name).join(', ')}. Незаписанные подходы не засчитаются.`
            : 'Результаты сохранятся в истории.'
        }
        confirmLabel={unfinished.length > 0 ? 'Всё равно завершить' : 'Завершить'}
        loading={finishing}
        onConfirm={finish}
      />
      <ConfirmSheet
        open={!!removing}
        onClose={() => setRemoving(null)}
        title={`Убрать «${removing?.name ?? ''}»?`}
        text="Записанные подходы этого упражнения будут удалены."
        confirmLabel="Убрать"
        danger
        loading={removeExercise.isPending}
        onConfirm={() => removing && removeExercise.mutate(removing)}
      />
      <ConfirmSheet
        open={cancelOpen}
        onClose={() => setCancelOpen(false)}
        title="Отменить тренировку?"
        text="Она не засчитается как выполненная, цикл программы не сдвинется."
        confirmLabel="Отменить тренировку"
        danger
        loading={cancel.isPending}
        onConfirm={() => cancel.mutate(undefined)}
      />
    </>
  );
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
  const index = session.exercises.findIndex((e) => e.id === exercise.id);
  const prevEx = session.exercises[index - 1];
  const nextEx = session.exercises[index + 1];
  const sets = exercise.sets;
  const target = targetLabel(exercise.plannedSets, exercise.targetRepsMin, exercise.targetRepsMax);

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
        className="-ml-1 flex h-10 items-center gap-1 text-[15px] font-semibold text-primary"
      >
        <ChevronLeft /> Все упражнения
      </button>

      <div className="space-y-2.5">
        <p className="text-[14px] text-muted">
          Упражнение {index + 1} из {session.exercises.length}
          {exercise.muscleGroup
            ? `, ${MUSCLE_GROUP_LABELS[exercise.muscleGroup].toLowerCase()}`
            : ''}
        </p>
        <h2 className="text-[24px] leading-tight font-semibold">{exercise.name}</h2>
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-lg bg-inset px-2.5 py-1 text-[14px] font-semibold">
            {target ? `План: ${target}` : 'План не задан'}
          </span>
          <SetDots done={sets.length} planned={exercise.plannedSets ?? 0} />
        </div>
        <ExerciseNotes plan={exercise.notes} technique={exercise.description} />
      </div>

      {exercise.previous ? (
        <PreviousSets
          sets={exercise.previous.sets}
          date={formatDate(exercise.previous.date).toLowerCase()}
        />
      ) : (
        <p className="rounded-2xl border border-dashed border-line px-4 py-3 text-[14px] text-muted">
          Первый раз: прошлых результатов нет
        </p>
      )}

      {sets.length > 0 && (
        <ul className="space-y-2" aria-label="Подходы">
          {sets.map((s) =>
            editing?.id === s.id ? (
              <li key={s.id}>
                <SetEntry
                  key={`edit-${s.id}`}
                  setNumber={s.setNumber}
                  initial={{ weightKg: s.weightKg, reps: s.reps }}
                  submitLabel="Сохранить"
                  onSubmit={(v) => save(v, s)}
                  onCancel={() => setEditing(null)}
                />
              </li>
            ) : (
              <SetRow key={s.id} set={s} onEdit={() => setEditing(s)} onDelete={() => remove(s)} />
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
          setNumber={sets.length + 1}
          suggestion={suggestion}
          onSubmit={(v) => save(v)}
        />
      )}

      <button
        type="button"
        className="block w-full py-2 text-center text-[14px] font-medium text-danger"
        onClick={onRemove}
      >
        Убрать упражнение из тренировки
      </button>

      <BottomBar flush>
        <Button
          variant="secondary"
          aria-label="Предыдущее упражнение"
          disabled={!prevEx}
          onClick={() => prevEx && onNavigate(prevEx.id)}
        >
          <ChevronLeft />
        </Button>
        {nextEx ? (
          <Button className="min-w-0 flex-1" onClick={() => onNavigate(nextEx.id)}>
            <span className="truncate">Дальше: {nextEx.name}</span>
            <ChevronRight />
          </Button>
        ) : (
          <Button variant="secondary" className="flex-1" onClick={onBack}>
            К списку упражнений
          </Button>
        )}
      </BottomBar>
    </div>
  );
}

function WorkoutSummary({ session }: { session: SessionDto }) {
  const s = session.summary;
  return (
    <div className="space-y-5 pt-8">
      <div className="text-center">
        <div className="mx-auto grid size-16 place-items-center rounded-full bg-done text-white">
          <CheckIcon />
        </div>
        <h1 className="font-display mt-4 text-[24px] font-semibold">Тренировка завершена</h1>
        <p className="mt-1 text-muted">{session.workoutName ?? 'Свободная тренировка'}</p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Stat
          label="Общая длительность"
          value={formatDuration(s.durationSeconds)}
          sub="от старта до завершения"
        />
        <Stat label="Объём" value={formatVolume(s.volumeKg)} sub="вес × повторы" />
        <Stat label="Упражнений" value={s.exercisesCompleted} />
        <Stat
          label="Подходов"
          value={s.totalSets}
          sub={s.skippedSets ? `ещё ${s.skippedSets} пропущено` : undefined}
        />
      </div>
      <BottomBar flush>
        <LinkButton href={`/history/${session.id}`} variant="secondary" className="flex-1">
          Подробно
        </LinkButton>
        <LinkButton href="/" className="flex-1">
          На главную
        </LinkButton>
      </BottomBar>
    </div>
  );
}
