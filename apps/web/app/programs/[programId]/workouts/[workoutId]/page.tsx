'use client';

import { MUSCLE_GROUP_LABELS, type ProgramDto, type WorkoutExerciseDto } from '@gym/shared';
import { useQueryClient } from '@tanstack/react-query';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { DotsIcon, PlayIcon, PlusIcon, TrashIcon } from '@/components/icons';
import { moveItem, ReorderButtons } from '@/components/reorder';
import {
  ActionSheet,
  BottomBar,
  Button,
  Card,
  ConfirmSheet,
  EmptyState,
  ErrorState,
  Field,
  IconButton,
  PageHeader,
  PageLoader,
  PlateBadge,
  Section,
  Sheet,
  TextArea,
  cx,
} from '@/components/ui';
import { ExerciseFormSheet } from '@/features/exercises/exercise-form';
import { ExerciseNotes } from '@/features/exercises/notes';
import { ExercisePicker } from '@/features/exercises/exercise-picker';
import { useStartWorkout } from '@/features/workout/use-start-workout';
import { errorMessage, http } from '@/lib/api';
import { targetLabel } from '@/lib/format';
import { useApiMutation } from '@/lib/mutations';
import { queryKeys, useProgram } from '@/lib/queries';
import { toast } from '@/lib/toast';

const toInt = (v: string) => (v.trim() === '' ? null : Number.parseInt(v, 10));

export default function WorkoutEditorPage() {
  const { programId, workoutId } = useParams<{ programId: string; workoutId: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const { data: program, isLoading, error, refetch } = useProgram(programId);
  const { start, pending: starting } = useStartWorkout();
  const [picking, setPicking] = useState(false);
  const [editing, setEditing] = useState<WorkoutExerciseDto | null>(null);
  const [menu, setMenu] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [ordering, setOrdering] = useState(false);

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

  // One-tap removal with undo: re-adding restores the plan and the position.
  const remove = useApiMutation(
    (we: WorkoutExerciseDto) => http.del<ProgramDto>(`/workout-exercises/${we.id}`),
    {
      ...opts,
      onSuccess: (p, we) => {
        setProgram(p);
        toast(`«${we.exercise.name}» убрано`, 'info', {
          label: 'Вернуть',
          onClick: () => restore(we),
        });
      },
    },
  );
  const restore = async (we: WorkoutExerciseDto) => {
    try {
      const { exerciseId, plannedSets, targetRepsMin, targetRepsMax, notes } = we;
      let p = await http.post<ProgramDto>(`/workouts/${workoutId}/exercises`, {
        exerciseId,
        plannedSets,
        targetRepsMin,
        targetRepsMax,
        notes,
      });
      const items = p.workouts.find((w) => w.id === workoutId)?.exercises ?? [];
      const ids = items.map((i) => i.id);
      const restored = ids.pop()!;
      ids.splice(Math.min(we.position, ids.length), 0, restored);
      if (ids.length > 1)
        p = await http.put<ProgramDto>(`/workouts/${workoutId}/exercises/order`, { ids });
      setProgram(p);
    } catch (e) {
      toast(errorMessage(e), 'error');
    }
  };

  if (isLoading) return <PageLoader />;
  if (error || !program)
    return <ErrorState message={errorMessage(error)} onRetry={() => refetch()} />;
  const index = program.workouts.findIndex((w) => w.id === workoutId);
  const workout = program.workouts[index];
  if (!workout) return <ErrorState message="Тренировка не найдена. Возможно, её удалили." />;
  const items = workout.exercises;

  return (
    <>
      <PageHeader
        title={workout.name}
        subtitle={
          <span className="flex items-center gap-2">
            <PlateBadge index={index} size="sm" /> {program.name}
          </span>
        }
        right={
          <IconButton label="Действия с тренировкой" onClick={() => setMenu(true)}>
            <DotsIcon />
          </IconButton>
        }
      />

      <Section
        title="Упражнения"
        hint={items.length ? 'Нажмите на упражнение, чтобы задать подходы и повторы.' : undefined}
        action={
          items.length > 1 && (
            <Button
              size="sm"
              variant={ordering ? 'primary' : 'secondary'}
              onClick={() => setOrdering(!ordering)}
            >
              {ordering ? 'Готово' : 'Порядок'}
            </Button>
          )
        }
      >
        {items.length === 0 ? (
          <EmptyState
            title="Добавьте упражнения"
            text="Выберите из своей библиотеки или создайте новое. Можно добавить несколько подряд."
            action={
              <Button onClick={() => setPicking(true)}>
                <PlusIcon /> Добавить упражнения
              </Button>
            }
          />
        ) : (
          <ol className="space-y-2.5">
            {items.map((we, i) => {
              const target = targetLabel(we.plannedSets, we.targetRepsMin, we.targetRepsMax);
              return (
                <li key={we.id}>
                  <Card className="overflow-hidden">
                    <div className="flex items-start gap-1 py-2 pr-1 pl-4">
                      <button
                        type="button"
                        disabled={ordering}
                        className="min-w-0 flex-1 py-1.5 text-left"
                        onClick={() => setEditing(we)}
                      >
                        <span className="flex items-baseline gap-2">
                          <span className="num w-4 shrink-0 text-[14px] text-muted">{i + 1}</span>
                          <span className="text-[17px] leading-snug font-semibold">
                            {we.exercise.name}
                          </span>
                        </span>
                        <span className="mt-1.5 flex flex-wrap items-center gap-1.5 pl-6">
                          <span
                            className={cx(
                              'rounded-lg px-2 py-0.5 text-[13px] font-semibold',
                              target ? 'bg-inset text-ink' : 'bg-primary-soft text-primary',
                            )}
                          >
                            {target ?? 'Задать подходы'}
                          </span>
                          {we.exercise.muscleGroup && (
                            <span className="text-[13px] text-muted">
                              {MUSCLE_GROUP_LABELS[we.exercise.muscleGroup]}
                            </span>
                          )}
                          {we.exercise.archivedAt && (
                            <span className="text-[13px] text-skip">в архиве</span>
                          )}
                        </span>
                      </button>
                      {ordering ? (
                        <ReorderButtons
                          index={i}
                          count={items.length}
                          label={we.exercise.name}
                          onMove={(f, t) => reorder.mutate(moveItem(items, f, t).map((x) => x.id))}
                        />
                      ) : (
                        <IconButton
                          label={`Убрать «${we.exercise.name}» из тренировки`}
                          tone="danger"
                          onClick={() => remove.mutate(we)}
                        >
                          <TrashIcon />
                        </IconButton>
                      )}
                    </div>
                    {!ordering && (we.notes || we.exercise.description) && (
                      <div className="px-4 pb-3 pl-10">
                        <ExerciseNotes plan={we.notes} technique={we.exercise.description} />
                      </div>
                    )}
                  </Card>
                </li>
              );
            })}
          </ol>
        )}
      </Section>

      {items.length > 0 && (
        <BottomBar>
          <Button
            variant="secondary"
            className="flex-1"
            onClick={() => setPicking(true)}
            loading={add.isPending}
          >
            <PlusIcon /> Упражнения
          </Button>
          <Button className="flex-1" loading={starting} onClick={() => start(workout.id)}>
            <PlayIcon /> Начать
          </Button>
        </BottomBar>
      )}

      <ExercisePicker
        open={picking}
        onClose={() => setPicking(false)}
        addedIds={items.map((i) => i.exerciseId)}
        onPick={(e) => add.mutate(e.id)}
      />
      <PlanSheet
        item={editing}
        onClose={() => setEditing(null)}
        onSaved={setProgram}
        onRemove={(we) => remove.mutate(we)}
      />
      <RenameSheet
        open={renaming}
        onClose={() => setRenaming(false)}
        workoutId={workoutId}
        name={workout.name}
        onSaved={setProgram}
      />
      <ActionSheet
        open={menu}
        onClose={() => setMenu(false)}
        title={workout.name}
        actions={[
          { label: 'Переименовать', onClick: () => setRenaming(true) },
          {
            label: 'Дублировать тренировку',
            hint: 'Копия добавится в конец цикла',
            onClick: () => duplicate.mutate(undefined),
          },
          { label: 'Удалить тренировку', danger: true, onClick: () => setDeleting(true) },
        ]}
      />
      <ConfirmSheet
        open={deleting}
        onClose={() => setDeleting(false)}
        title="Удалить тренировку?"
        text="Уже выполненные тренировки останутся в истории. Если это была последняя выполненная, цикл начнётся с первой."
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
  onRemove: (we: WorkoutExerciseDto) => void;
}) {
  const [sets, setSets] = useState('');
  const [min, setMin] = useState('');
  const [max, setMax] = useState('');
  const [notes, setNotes] = useState('');
  const [editingExercise, setEditingExercise] = useState(false);
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
    <>
      <Sheet open={!!item && !editingExercise} onClose={onClose} title={item?.exercise.name ?? ''}>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (!rangeError) save.mutate(undefined);
          }}
        >
          <div className="grid grid-cols-3 gap-3">
            <Field
              label="Подходы"
              inputMode="numeric"
              type="number"
              min={1}
              max={50}
              value={sets}
              onChange={(e) => setSets(e.target.value)}
              placeholder="—"
            />
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
          <p className="-mt-2 px-1 text-[13px] text-muted">
            Это ориентир. На тренировке можно сделать сколько угодно подходов.
          </p>
          <TextArea
            label="Заметка к упражнению в этой тренировке"
            value={notes}
            onChange={setNotes}
            placeholder="Например: суперсет со следующим"
          />
          {item?.exercise.description && <ExerciseNotes technique={item.exercise.description} />}
          <Button type="submit" block size="lg" loading={save.isPending} disabled={!!rangeError}>
            Сохранить
          </Button>
          <div className="flex gap-2">
            <Button variant="secondary" className="flex-1" onClick={() => setEditingExercise(true)}>
              Изменить упражнение
            </Button>
            <Button
              variant="danger"
              className="flex-1"
              onClick={() => {
                if (item) onRemove(item);
                onClose();
              }}
            >
              Убрать
            </Button>
          </div>
        </form>
      </Sheet>
      <ExerciseFormSheet
        open={!!item && editingExercise}
        onClose={() => setEditingExercise(false)}
        exercise={item?.exercise ?? null}
      />
    </>
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
