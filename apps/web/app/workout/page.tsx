'use client';

import type { SessionDto, SessionExerciseDto, SetDto } from '@gym/shared';
import { summarizeSession } from '@gym/shared';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useElapsed } from '@/components/shell';
import {
  Button,
  ConfirmSheet,
  EmptyState,
  ErrorState,
  LinkButton,
  PageLoader,
  Stat,
  cx,
} from '@/components/ui';
import { ExercisePicker } from '@/features/exercises/exercise-picker';
import { SetEntry, type SetEntryValue } from '@/features/workout/set-entry';
import { PreviousSets, SetRow } from '@/features/workout/set-list';
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
          icon="⏱️"
          title="Нет активной тренировки"
          text="Начните тренировку с главного экрана."
          action={<LinkButton href="/">На главную</LinkButton>}
        />
      </div>
    );
  return <ActiveWorkout session={session} onCompleted={setSummary} />;
}

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
  const [finishOpen, setFinishOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [finishing, setFinishing] = useState(false);

  const open = session.exercises.find((e) => e.id === openId) ?? null;
  const unfinished = session.exercises.filter(
    (e) => e.sets.length < Math.max(e.plannedSets ?? 0, 1),
  );
  const live = summarizeSession({
    startedAt: new Date(session.startedAt),
    completedAt: null,
    exercises: session.exercises,
  });

  const addExercise = useApiMutation(
    (exerciseId: string) =>
      http.post<SessionDto>(`/sessions/${session.id}/exercises`, {
        id: crypto.randomUUID(),
        exerciseId,
      }),
    {
      onSuccess: (s) => {
        qc.setQueryData(queryKeys.activeSession, s);
        setOpenId(s.exercises.at(-1)!.id);
      },
    },
  );
  const removeExercise = useApiMutation(
    (seId: string) => http.del<SessionDto>(`/sessions/${session.id}/exercises/${seId}`),
    {
      onSuccess: (s) => {
        qc.setQueryData(queryKeys.activeSession, s);
        setOpenId(null);
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

  const finish = async () => {
    setFinishing(true);
    try {
      // Never complete while sets are still only on this device.
      const synced = await drain();
      if (!synced) {
        toast(
          'Нет сети: подходы сохранены на устройстве. Завершите, когда связь появится.',
          'error',
        );
        return;
      }
      const done = await http.post<SessionDto>(`/sessions/${session.id}/complete`, {
        confirmIncomplete: true,
      });
      haptic.success();
      qc.setQueryData(queryKeys.activeSession, null);
      void qc.invalidateQueries({ queryKey: queryKeys.home });
      void qc.invalidateQueries({ queryKey: ['history'] });
      void qc.invalidateQueries({ queryKey: ['analytics'] });
      void qc.invalidateQueries({ queryKey: ['summary'] });
      onCompleted(done);
    } catch (e) {
      toast(errorMessage(e), 'error');
    } finally {
      setFinishing(false);
      setFinishOpen(false);
    }
  };

  return (
    <>
      <header
        className="sticky z-20 -mx-4 flex items-center justify-between gap-3 bg-bg/95 px-4 py-2 backdrop-blur"
        style={{ top: 'var(--safe-top)' }}
      >
        <div className="min-w-0">
          <p
            className="num text-[13px] font-medium text-muted"
            aria-label="Длительность тренировки"
          >
            ⏱ {formatClock(elapsed)}
          </p>
          <h1 className="truncate text-xl font-bold">
            {session.workoutName ?? 'Свободная тренировка'}
          </h1>
        </div>
        <Button size="sm" variant="success" onClick={() => setFinishOpen(true)}>
          Завершить
        </Button>
      </header>

      {open ? (
        <ExerciseView
          session={session}
          exercise={open}
          onBack={() => setOpenId(null)}
          onNavigate={setOpenId}
          onRemove={() => removeExercise.mutate(open.id)}
        />
      ) : (
        <>
          <div className="grid grid-cols-3 gap-2">
            <MiniStat label="Подходы" value={live.totalSets} />
            <MiniStat
              label="Упражнения"
              value={`${live.exercisesCompleted}/${session.exercises.length}`}
            />
            <MiniStat label="Объём" value={formatVolume(live.volumeKg)} />
          </div>
          {session.exercises.length === 0 && (
            <EmptyState
              icon="➕"
              title="Добавьте упражнение"
              text="Свободная тренировка: выберите упражнения из библиотеки."
            />
          )}
          <ul className="space-y-2">
            {session.exercises.map((e, i) => {
              const done = e.sets.filter((s) => s.status === 'completed').length;
              const target = e.plannedSets ?? 0;
              const complete = e.sets.length >= Math.max(target, 1);
              return (
                <li key={e.id}>
                  <button
                    type="button"
                    onClick={() => setOpenId(e.id)}
                    className="press flex w-full items-center gap-3 rounded-3xl bg-surface p-4 text-left"
                  >
                    <span
                      className={cx(
                        'num grid size-10 shrink-0 place-items-center rounded-full text-sm font-bold',
                        complete ? 'bg-success text-white' : 'bg-surface-2',
                      )}
                    >
                      {complete ? '✓' : i + 1}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[17px] font-semibold">{e.name}</span>
                      <span className="block text-sm text-muted">
                        {done}
                        {target ? ` из ${target}` : ''}{' '}
                        {plural(target || done, 'подход', 'подхода', 'подходов')}
                        {targetLabel(null, e.targetRepsMin, e.targetRepsMax)
                          ? ` · цель ${targetLabel(null, e.targetRepsMin, e.targetRepsMax)}`
                          : ''}
                      </span>
                    </span>
                    <span className="text-muted" aria-hidden>
                      ›
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          <Button
            block
            variant="secondary"
            onClick={() => setPicking(true)}
            loading={addExercise.isPending}
          >
            + Добавить упражнение
          </Button>
          <Button block variant="danger" onClick={() => setCancelOpen(true)}>
            Отменить тренировку
          </Button>
        </>
      )}

      <ExercisePicker
        open={picking}
        onClose={() => setPicking(false)}
        onPick={(e) => {
          setPicking(false);
          addExercise.mutate(e.id);
        }}
      />
      <ConfirmSheet
        open={finishOpen}
        onClose={() => setFinishOpen(false)}
        title="Завершить тренировку?"
        text={
          unfinished.length > 0
            ? `Не все подходы записаны: ${unfinished.map((e) => e.name).join(', ')}. Незаписанные подходы не будут засчитаны.`
            : 'Результаты сохранятся в истории.'
        }
        confirmLabel={unfinished.length > 0 ? 'Всё равно завершить' : 'Завершить'}
        loading={finishing}
        onConfirm={finish}
      />
      <ConfirmSheet
        open={cancelOpen}
        onClose={() => setCancelOpen(false)}
        title="Отменить тренировку?"
        text="Тренировка не будет засчитана как выполненная, а цикл программы не сдвинется."
        confirmLabel="Отменить тренировку"
        danger
        loading={cancel.isPending}
        onConfirm={() => cancel.mutate(undefined)}
      />
    </>
  );
}

function MiniStat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-surface px-3 py-2">
      <div className="text-[11px] text-muted">{label}</div>
      <div className="num truncate text-lg font-bold">{value}</div>
    </div>
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
  const [removeOpen, setRemoveOpen] = useState(false);
  const index = session.exercises.findIndex((e) => e.id === exercise.id);
  const prevEx = session.exercises[index - 1];
  const nextEx = session.exercises[index + 1];
  const sets = exercise.sets;
  const nextNumber = sets.length + 1;
  const target = targetLabel(exercise.plannedSets, exercise.targetRepsMin, exercise.targetRepsMax);

  // Suggestion only: last set of today, else the same set from last time.
  const suggestion = useMemo(() => {
    const last = sets.at(-1);
    if (last) return { weightKg: last.weightKg, reps: last.reps };
    const prev = exercise.previous?.sets.find((s) => s.setNumber === 1 && s.status === 'completed');
    return prev ? { weightKg: prev.weightKg, reps: prev.reps } : null;
  }, [sets, exercise.previous]);

  useEffect(() => setEditing(null), [exercise.id]);

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
    <div className="anim-in space-y-4">
      <button type="button" onClick={onBack} className="text-[15px] font-medium text-link">
        ‹ Все упражнения
      </button>
      <div>
        <h2 className="text-2xl font-bold">{exercise.name}</h2>
        <p className="text-[15px] text-muted">
          {target ? `План: ${target}` : 'План не задан'}
          {exercise.notes ? ` · ${exercise.notes}` : ''}
        </p>
      </div>

      {exercise.previous ? (
        <PreviousSets sets={exercise.previous.sets} date={formatDate(exercise.previous.date)} />
      ) : (
        <p className="rounded-2xl bg-surface-2 px-3 py-2 text-sm text-muted">
          Первый раз — предыдущих результатов нет
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
          setNumber={nextNumber}
          suggestion={suggestion}
          onSubmit={(v) => save(v)}
        />
      )}

      <div className="flex gap-2">
        <Button
          variant="secondary"
          className="flex-1"
          disabled={!prevEx}
          onClick={() => prevEx && onNavigate(prevEx.id)}
        >
          ‹ Пред.
        </Button>
        {nextEx ? (
          <Button className="flex-[2] truncate" onClick={() => onNavigate(nextEx.id)}>
            Далее: {nextEx.name.length > 14 ? `${nextEx.name.slice(0, 13)}…` : nextEx.name} ›
          </Button>
        ) : (
          <Button variant="secondary" className="flex-1" onClick={onBack}>
            К списку
          </Button>
        )}
      </div>
      <button
        type="button"
        className="block w-full py-2 text-center text-sm font-medium text-danger"
        onClick={() => setRemoveOpen(true)}
      >
        Убрать упражнение из тренировки
      </button>
      <ConfirmSheet
        open={removeOpen}
        onClose={() => setRemoveOpen(false)}
        title="Убрать упражнение?"
        text={sets.length ? 'Записанные подходы этого упражнения будут удалены.' : undefined}
        confirmLabel="Убрать"
        danger
        onConfirm={() => {
          setRemoveOpen(false);
          onRemove();
        }}
      />
    </div>
  );
}

function WorkoutSummary({ session }: { session: SessionDto }) {
  const s = session.summary;
  return (
    <div className="anim-in space-y-5 pt-6">
      <div className="text-center">
        <div className="text-5xl" aria-hidden>
          🎉
        </div>
        <h1 className="mt-3 text-2xl font-bold">Тренировка завершена</h1>
        <p className="text-muted">{session.workoutName ?? 'Свободная тренировка'}</p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Stat
          label="Общая длительность"
          value={formatDuration(s.durationSeconds)}
          sub="от старта до завершения"
        />
        <Stat label="Упражнений" value={s.exercisesCompleted} />
        <Stat
          label="Подходов"
          value={s.totalSets}
          sub={s.skippedSets ? `пропущено: ${s.skippedSets}` : undefined}
        />
        <Stat label="Объём" value={formatVolume(s.volumeKg)} sub="Σ вес × повторы" />
      </div>
      <LinkButton href="/" className="w-full">
        На главную
      </LinkButton>
      <LinkButton href={`/history/${session.id}`} variant="secondary" className="w-full">
        Открыть в истории
      </LinkButton>
    </div>
  );
}
