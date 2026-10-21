'use client';

import { MUSCLE_GROUP_LABELS, type ExerciseDto, type MuscleGroup } from '@gym/shared';
import { useDeferredValue, useState } from 'react';
import {
  Button,
  EmptyState,
  ErrorState,
  Field,
  PageHeader,
  PageLoader,
  Segmented,
} from '@/components/ui';
import { ExerciseFormSheet, MuscleSelect } from '@/features/exercises/exercise-form';
import { errorMessage, http } from '@/lib/api';
import { useApiMutation } from '@/lib/mutations';
import { useExercises } from '@/lib/queries';

export default function ExercisesPage() {
  const [search, setSearch] = useState('');
  const [muscle, setMuscle] = useState<MuscleGroup | ''>('');
  const [tab, setTab] = useState<'active' | 'archived'>('active');
  const deferred = useDeferredValue(search);
  const { data, isLoading, error, refetch } = useExercises({
    search: deferred,
    muscleGroup: muscle,
    archived: tab === 'archived',
  });
  const [form, setForm] = useState<{ open: boolean; exercise: ExerciseDto | null }>({
    open: false,
    exercise: null,
  });
  const toggleArchive = useApiMutation(
    (e: ExerciseDto) => http.post(`/exercises/${e.id}/${e.archivedAt ? 'unarchive' : 'archive'}`),
    {
      invalidate: [['exercises']],
    },
  );
  const items = (data ?? []).filter((e) => (tab === 'archived' ? e.archivedAt : !e.archivedAt));

  return (
    <>
      <PageHeader
        title="Упражнения"
        right={
          <Button size="sm" onClick={() => setForm({ open: true, exercise: null })}>
            + Новое
          </Button>
        }
      />
      <Field
        label="Поиск"
        type="search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Название упражнения"
      />
      <MuscleSelect value={muscle} onChange={setMuscle} allowAll />
      <Segmented
        label="Фильтр"
        value={tab}
        onChange={setTab}
        options={[
          { value: 'active', label: 'Активные' },
          { value: 'archived', label: 'Архив' },
        ]}
      />
      {isLoading ? (
        <PageLoader />
      ) : error ? (
        <ErrorState message={errorMessage(error)} onRetry={() => refetch()} />
      ) : items.length === 0 ? (
        <EmptyState
          icon="📚"
          title={
            search || muscle
              ? 'Ничего не найдено'
              : tab === 'archived'
                ? 'Архив пуст'
                : 'Библиотека пуста'
          }
          text={
            tab === 'active' && !search
              ? 'Создайте упражнения, чтобы добавлять их в тренировки.'
              : undefined
          }
        />
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-3xl bg-surface">
          {items.map((e) => (
            <li key={e.id} className="flex items-center gap-2 pr-2">
              <button
                type="button"
                className="min-h-14 min-w-0 flex-1 px-4 py-2 text-left"
                onClick={() => setForm({ open: true, exercise: e })}
              >
                <span className="block truncate font-medium">{e.name}</span>
                <span className="block truncate text-xs text-muted">
                  {e.muscleGroup ? MUSCLE_GROUP_LABELS[e.muscleGroup] : 'Группа не указана'}
                  {e.description ? ` · ${e.description}` : ''}
                </span>
              </button>
              <Button size="sm" variant="secondary" onClick={() => toggleArchive.mutate(e)}>
                {e.archivedAt ? 'Вернуть' : 'В архив'}
              </Button>
            </li>
          ))}
        </ul>
      )}
      <p className="px-1 text-xs text-muted">
        Архивное упражнение не удаляется: история и статистика по нему сохраняются.
      </p>
      <ExerciseFormSheet
        open={form.open}
        exercise={form.exercise}
        onClose={() => setForm({ open: false, exercise: null })}
      />
    </>
  );
}
