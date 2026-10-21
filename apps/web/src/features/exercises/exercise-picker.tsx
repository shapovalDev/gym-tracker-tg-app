'use client';

import { MUSCLE_GROUP_LABELS, type ExerciseDto, type MuscleGroup } from '@gym/shared';
import { useDeferredValue, useState } from 'react';
import { CheckIcon, PlusIcon } from '@/components/icons';
import { Button, Field, PageLoader, Sheet, cx } from '@/components/ui';
import { useExercises } from '@/lib/queries';
import { ExerciseFormSheet, MuscleSelect } from './exercise-form';

/**
 * Library picker. Tapping an exercise adds it right away and keeps the sheet
 * open, so a whole workout can be assembled in one go; "Готово" closes it.
 */
export function ExercisePicker({
  open,
  onClose,
  onPick,
  addedIds = [],
  title = 'Добавить упражнения',
}: {
  open: boolean;
  onClose: () => void;
  onPick: (e: ExerciseDto) => void;
  addedIds?: string[];
  title?: string;
}) {
  const [search, setSearch] = useState('');
  const [muscle, setMuscle] = useState<MuscleGroup | ''>('');
  const deferred = useDeferredValue(search);
  const { data, isLoading } = useExercises({ search: deferred, muscleGroup: muscle });
  const [creating, setCreating] = useState(false);
  const items = data ?? [];
  const added = new Set(addedIds);

  return (
    <>
      <Sheet open={open && !creating} onClose={onClose} title={title}>
        <div className="space-y-3">
          <Field
            label="Поиск"
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Название упражнения"
          />
          <MuscleSelect value={muscle} onChange={setMuscle} allowAll />
          {isLoading ? (
            <PageLoader />
          ) : (
            <ul className="divide-y divide-line overflow-hidden rounded-[20px] border border-line bg-card">
              {items.map((e) => {
                const isAdded = added.has(e.id);
                return (
                  <li key={e.id}>
                    <button
                      type="button"
                      disabled={isAdded}
                      aria-label={isAdded ? `${e.name}, уже добавлено` : `Добавить ${e.name}`}
                      className="flex min-h-14 w-full items-center gap-3 px-4 py-2.5 text-left"
                      onClick={() => onPick(e)}
                    >
                      <span className="min-w-0 flex-1">
                        <span className={cx('block font-medium', isAdded && 'text-muted')}>
                          {e.name}
                        </span>
                        {e.muscleGroup && (
                          <span className="block text-[13px] text-muted">
                            {MUSCLE_GROUP_LABELS[e.muscleGroup]}
                          </span>
                        )}
                      </span>
                      <span
                        className={cx(
                          'grid size-9 shrink-0 place-items-center rounded-full',
                          isAdded ? 'bg-done-soft text-done' : 'bg-primary-soft text-primary',
                        )}
                        aria-hidden
                      >
                        {isAdded ? <CheckIcon /> : <PlusIcon />}
                      </span>
                    </button>
                  </li>
                );
              })}
              {items.length === 0 && (
                <li className="px-4 py-6 text-center text-[15px] text-muted">Ничего не найдено</li>
              )}
            </ul>
          )}
          <Button block variant="secondary" onClick={() => setCreating(true)}>
            <PlusIcon /> Новое упражнение{search.trim() ? ` «${search.trim()}»` : ''}
          </Button>
          <Button block size="lg" onClick={onClose}>
            Готово
          </Button>
        </div>
      </Sheet>
      <ExerciseFormSheet
        open={open && creating}
        initialName={search.trim()}
        onClose={() => setCreating(false)}
        onSaved={(e) => {
          setCreating(false);
          setSearch('');
          onPick(e);
        }}
      />
    </>
  );
}
