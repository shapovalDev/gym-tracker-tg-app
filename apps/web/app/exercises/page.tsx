'use client';

import type { ExerciseDto, MuscleGroup } from '@gym/shared';
import { useState } from 'react';
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
import { t } from '@/i18n';
import { muscleLabel } from '@/lib/format';
import { useDebounced } from '@/lib/use-debounced';

export default function ExercisesPage() {
  const [search, setSearch] = useState('');
  const [muscle, setMuscle] = useState<MuscleGroup | ''>('');
  const [tab, setTab] = useState<'active' | 'archived'>('active');
  // one request per pause in typing, not per keystroke
  const deferred = useDebounced(search.trim());
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
      <PageHeader title={t('Exercises')} subtitle={t('Your library')} />
      <div className="space-y-3">
        <Field
          label={t('Search')}
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('Exercise name')}
        />
        <MuscleSelect value={muscle} onChange={setMuscle} allowAll />
        <Segmented
          label={t('Which exercises to show')}
          value={tab}
          onChange={setTab}
          options={[
            { value: 'active', label: t('Active') },
            { value: 'archived', label: t('Archive') },
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
              ? t('Nothing found')
              : tab === 'archived'
                ? t('The archive is empty')
                : t('The library is empty')
          }
          text={
            tab === 'active' && !search && !muscle
              ? t('Create exercises to add them to workouts.')
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
                  {e.muscleGroup ? muscleLabel(e.muscleGroup) : t('No muscle group')}
                </span>
                {e.description && (
                  <span className="mt-1 line-clamp-2 block text-[14px]">{e.description}</span>
                )}
              </button>
              <Button size="sm" variant="secondary" onClick={() => toggleArchive.mutate(e)}>
                {e.archivedAt ? t('Restore') : t('Archive')}
              </Button>
            </li>
          ))}
        </ul>
      )}
      <p className="px-1 text-[13px] text-muted">
        {t('Archiving keeps the exercise: its history and statistics stay.')}
      </p>
      <BottomBar>
        <Button className="flex-1" onClick={() => setForm({ open: true, exercise: null })}>
          <PlusIcon /> {t('New exercise')}
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
