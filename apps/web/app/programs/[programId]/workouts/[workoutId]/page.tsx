'use client';

import type { ProgramDto, WorkoutExerciseDto } from '@gym/shared';
import { useQueryClient } from '@tanstack/react-query';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { moveItem, ReorderButtons } from '@/components/reorder';
import {
  Button,
  ConfirmSheet,
  EmptyState,
  ErrorState,
  Field,
  PageHeader,
  PageLoader,
  Section,
  Sheet,
  TextArea,
} from '@/components/ui';
import { ExercisePicker } from '@/features/exercises/exercise-picker';
import { useStartWorkout } from '@/features/workout/use-start-workout';
import { errorMessage, http } from '@/lib/api';
import { targetLabel } from '@/lib/format';
import { useApiMutation } from '@/lib/mutations';
import { queryKeys, useProgram } from '@/lib/queries';

const toInt = (v: string) => (v.trim() === '' ? null : Number.parseInt(v, 10));

export default function WorkoutEditorPage() {
  const { programId, workoutId } = useParams<{ programId: string; workoutId: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const { data: program, isLoading, error, refetch } = useProgram(programId);
  const { start, pending: starting } = useStartWorkout();
  const [picking, setPicking] = useState(false);
  const [editing, setEditing] = useState<WorkoutExerciseDto | null>(null);
  const [renaming, setRenaming] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const setProgram = (p: ProgramDto) => qc.setQueryData(queryKeys.program(p.id), p);
  const opts = { invalidate: [['home'], ['programs']], onSuccess: setProgram };
  const add = useApiMutation(
    (exerciseId: string) =>
      http.post<ProgramDto>(`/workouts/${workoutId}/exercises`, { exerciseId }),
    opts,
  );
  const reorder = useApiMutation(
    (ids: string[]) => http.put<ProgramDto>(`/workouts/${workoutId}/exercises/order`, { ids }),
    opts,
  );
  const remove = useApiMutation(
    (id: string) => http.del<ProgramDto>(`/workout-exercises/${id}`),
    opts,
  );
  const duplicate = useApiMutation(
    () => http.post<ProgramDto>(`/workouts/${workoutId}/duplicate`),
    {
      ...opts,
      success: 'Тренировка скопирована',
      onSuccess: (p) => {
        setProgram(p);
        router.replace(`/programs/${programId}/workouts/${p.workouts.at(-1)!.id}`);
      },
    },
  );
  const del = useApiMutation(() => http.del<ProgramDto>(`/workouts/${workoutId}`), {
    ...opts,
    onSuccess: (p) => {
      setProgram(p);
      router.replace(`/programs/${programId}`);
    },
  });

  if (isLoading) return <PageLoader />;
  if (error || !program)
    return <ErrorState message={errorMessage(error)} onRetry={() => refetch()} />;
  const workout = program.workouts.find((w) => w.id === workoutId);
  if (!workout) return <ErrorState message="Тренировка не найдена" />;
  const items = workout.exercises;

  return (
    <>
      <PageHeader
        title={workout.name}
        subtitle={program.name}
        right={
          <Button variant="ghost" size="sm" onClick={() => setRenaming(true)}>
            Переименовать
          </Button>
        }
      />

      {items.length > 0 && (
        <Button block size="lg" loading={starting} onClick={() => start(workout.id)}>
          Начать эту тренировку
        </Button>
      )}

      <Section title="Упражнения">
        {items.length === 0 ? (
          <EmptyState
            icon="💪"
            title="Пока пусто"
            text="Добавьте упражнения из своей библиотеки."
          />
        ) : (
          <ul className="space-y-2">
            {items.map((we, i) => (
              <li
                key={we.id}
                className="flex items-center gap-1 rounded-3xl bg-surface py-2 pr-2 pl-4"
              >
                <button
                  type="button"
                  className="min-w-0 flex-1 py-1 text-left"
                  onClick={() => setEditing(we)}
                >
                  <span className="block truncate font-semibold">
                    {we.exercise.name}
                    {we.exercise.archivedAt && (
                      <span className="ml-2 text-xs font-normal text-muted">(в архиве)</span>
                    )}
                  </span>
                  <span className="block truncate text-sm text-muted">
                    {targetLabel(we.plannedSets, we.targetRepsMin, we.targetRepsMax) ??
                      'План не задан'}
                    {we.notes ? ` · ${we.notes}` : ''}
                  </span>
                </button>
                <ReorderButtons
                  index={i}
                  count={items.length}
                  label={we.exercise.name}
                  onMove={(f, t) => reorder.mutate(moveItem(items, f, t).map((x) => x.id))}
                />
              </li>
            ))}
          </ul>
        )}
        <Button block variant="secondary" onClick={() => setPicking(true)} loading={add.isPending}>
          + Добавить упражнение
        </Button>
      </Section>

      <Section title="Действия">
        <div className="divide-y divide-border overflow-hidden rounded-3xl bg-surface">
          <button
            type="button"
            className="block h-14 w-full px-4 text-left font-medium"
            onClick={() => duplicate.mutate(undefined)}
          >
            Дублировать тренировку
          </button>
          <button
            type="button"
            className="block h-14 w-full px-4 text-left font-medium text-danger"
            onClick={() => setDeleting(true)}
          >
            Удалить тренировку
          </button>
        </div>
      </Section>

      <ExercisePicker
        open={picking}
        onClose={() => setPicking(false)}
        excludeIds={items.map((i) => i.exerciseId)}
        onPick={(e) => {
          setPicking(false);
          add.mutate(e.id);
        }}
      />
      <PlanSheet
        item={editing}
        onClose={() => setEditing(null)}
        onSaved={setProgram}
        onRemove={(id) => {
          remove.mutate(id);
          setEditing(null);
        }}
      />
      <RenameSheet
        open={renaming}
        onClose={() => setRenaming(false)}
        workoutId={workoutId}
        name={workout.name}
        onSaved={setProgram}
      />
      <ConfirmSheet
        open={deleting}
        onClose={() => setDeleting(false)}
        title="Удалить тренировку?"
        text="Завершённые тренировки останутся в истории. Если это была последняя выполненная тренировка, цикл начнётся с первой."
        confirmLabel="Удалить"
        danger
        loading={del.isPending}
        onConfirm={() => del.mutate(undefined)}
      />
    </>
  );
}

function PlanSheet({
  item,
  onClose,
  onSaved,
  onRemove,
}: {
  item: WorkoutExerciseDto | null;
  onClose: () => void;
  onSaved: (p: ProgramDto) => void;
  onRemove: (id: string) => void;
}) {
  const [sets, setSets] = useState('');
  const [min, setMin] = useState('');
  const [max, setMax] = useState('');
  const [notes, setNotes] = useState('');
  useEffect(() => {
    if (!item) return;
    setSets(item.plannedSets?.toString() ?? '');
    setMin(item.targetRepsMin?.toString() ?? '');
    setMax(item.targetRepsMax?.toString() ?? '');
    setNotes(item.notes ?? '');
  }, [item]);
  const minN = toInt(min);
  const maxN = toInt(max);
  const rangeError =
    minN !== null && maxN !== null && minN > maxN ? 'Минимум больше максимума' : null;
  const save = useApiMutation(
    () =>
      http.patch<ProgramDto>(`/workout-exercises/${item!.id}`, {
        plannedSets: toInt(sets),
        targetRepsMin: minN,
        targetRepsMax: maxN,
        notes: notes || null,
      }),
    {
      invalidate: [['home']],
      onSuccess: (p) => {
        onSaved(p);
        onClose();
      },
    },
  );
  return (
    <Sheet open={!!item} onClose={onClose} title={item?.exercise.name ?? ''}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (!rangeError) save.mutate(undefined);
        }}
      >
        <p className="text-center text-sm text-muted">
          План — это рекомендация. Фактически можно сделать любое число подходов.
        </p>
        <Field
          label="Подходов"
          inputMode="numeric"
          type="number"
          min={1}
          max={50}
          value={sets}
          onChange={(e) => setSets(e.target.value)}
          placeholder="—"
        />
        <div className="grid grid-cols-2 gap-3">
          <Field
            label="Повторы от"
            inputMode="numeric"
            type="number"
            min={1}
            value={min}
            onChange={(e) => setMin(e.target.value)}
            placeholder="—"
          />
          <Field
            label="до"
            inputMode="numeric"
            type="number"
            min={1}
            value={max}
            onChange={(e) => setMax(e.target.value)}
            placeholder="—"
            error={rangeError}
          />
        </div>
        <TextArea
          label="Заметка"
          value={notes}
          onChange={setNotes}
          placeholder="Например: пауза 2 с внизу"
        />
        <Button type="submit" block size="lg" loading={save.isPending} disabled={!!rangeError}>
          Сохранить
        </Button>
        <Button block variant="danger" onClick={() => item && onRemove(item.id)}>
          Убрать из тренировки
        </Button>
      </form>
    </Sheet>
  );
}

function RenameSheet({
  open,
  onClose,
  workoutId,
  name,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  workoutId: string;
  name: string;
  onSaved: (p: ProgramDto) => void;
}) {
  const [value, setValue] = useState(name);
  useEffect(() => setValue(name), [name, open]);
  const save = useApiMutation(
    () => http.patch<ProgramDto>(`/workouts/${workoutId}`, { name: value }),
    {
      invalidate: [['home']],
      onSuccess: (p) => {
        onSaved(p);
        onClose();
      },
    },
  );
  return (
    <Sheet open={open} onClose={onClose} title="Название тренировки">
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (value.trim()) save.mutate(undefined);
        }}
      >
        <Field
          label="Название"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          maxLength={100}
          autoFocus
        />
        <Button type="submit" block size="lg" loading={save.isPending} disabled={!value.trim()}>
          Сохранить
        </Button>
      </form>
    </Sheet>
  );
}
