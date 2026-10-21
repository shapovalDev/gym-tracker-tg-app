'use client';

import { MUSCLE_GROUP_LABELS, type ExerciseDto, type MuscleGroup } from '@gym/shared';
import { useDeferredValue, useState } from 'react';
import { PlusIcon } from '@/components/icons';
import {
  BottomBar,
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
      <PageHeader title="Упражнения" subtitle="Ваша библиотека" />
      <div className="space-y-3">
        <Field
          label="Поиск"
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Название упражнения"
        />
        <MuscleSelect value={muscle} onChange={setMuscle} allowAll />
        <Segmented
          label="Какие упражнения показать"
          value={tab}
          onChange={setTab}
          options={[
            { value: 'active', label: 'Активные' },
            { value: 'archived', label: 'Архив' },
          ]}
        />
      </div>
      {isLoading ? (
        <PageLoader />
      ) : error ? (
        <ErrorState message={errorMessage(error)} onRetry={() => refetch()} />
      ) : items.length === 0 ? (
        <EmptyState
          title={
            search || muscle
              ? 'Ничего не найдено'
              : tab === 'archived'
                ? 'Архив пуст'
                : 'Библиотека пуста'
          }
          text={
            tab === 'active' && !search && !muscle
              ? 'Создайте упражнения, чтобы добавлять их в тренировки.'
              : undefined
          }
        />
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-[22px] border border-line bg-card">
          {items.map((e) => (
            <li key={e.id} className="flex items-center gap-2 pr-3">
              <button
                type="button"
                className="min-h-16 min-w-0 flex-1 px-4 py-3 text-left"
                onClick={() => setForm({ open: true, exercise: e })}
              >
                <span className="block font-semibold">{e.name}</span>
                <span className="block text-[14px] text-muted">
                  {e.muscleGroup ? MUSCLE_GROUP_LABELS[e.muscleGroup] : 'Группа не указана'}
                </span>
                {e.description && (
                  <span className="mt-1 line-clamp-2 block text-[14px]">{e.description}</span>
                )}
              </button>
              <Button size="sm" variant="secondary" onClick={() => toggleArchive.mutate(e)}>
                {e.archivedAt ? 'Вернуть' : 'В архив'}
              </Button>
            </li>
          ))}
        </ul>
      )}
      <p className="px-1 text-[13px] text-muted">
        Упражнение в архиве не удаляется: история и статистика по нему сохраняются.
      </p>
      <BottomBar>
        <Button className="flex-1" onClick={() => setForm({ open: true, exercise: null })}>
          <PlusIcon /> Новое упражнение
        </Button>
      </BottomBar>
      <ExerciseFormSheet
        open={form.open}
        exercise={form.exercise}
        onClose={() => setForm({ open: false, exercise: null })}
      />
    </>
  );
}
