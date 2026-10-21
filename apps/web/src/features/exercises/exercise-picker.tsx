'use client';

import { MUSCLE_GROUP_LABELS, type ExerciseDto, type MuscleGroup } from '@gym/shared';
import { useDeferredValue, useState } from 'react';
import { Button, Field, PageLoader, Sheet } from '@/components/ui';
import { useExercises } from '@/lib/queries';
import { ExerciseFormSheet, MuscleSelect } from './exercise-form';

/** Search the library and pick an exercise; can create one on the fly. */
export function ExercisePicker({
  open,
  onClose,
  onPick,
  excludeIds = [],
}: {
  open: boolean;
  onClose: () => void;
  onPick: (e: ExerciseDto) => void;
  excludeIds?: string[];
}) {
  const [search, setSearch] = useState('');
  const [muscle, setMuscle] = useState<MuscleGroup | ''>('');
  const deferred = useDeferredValue(search);
  const { data, isLoading } = useExercises({ search: deferred, muscleGroup: muscle });
  const [creating, setCreating] = useState(false);
  const items = (data ?? []).filter((e) => !excludeIds.includes(e.id));

  return (
    <>
      <Sheet open={open && !creating} onClose={onClose} title="Выберите упражнение">
        <div className="space-y-3">
          <Field
            label="Поиск"
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Название"
          />
          <MuscleSelect value={muscle} onChange={setMuscle} allowAll />
          {isLoading ? (
            <PageLoader />
          ) : (
            <ul className="divide-y divide-border overflow-hidden rounded-2xl bg-surface-2">
              {items.map((e) => (
                <li key={e.id}>
                  <button
                    type="button"
                    className="flex min-h-14 w-full items-center justify-between px-4 py-2 text-left"
                    onClick={() => onPick(e)}
                  >
                    <span className="font-medium">{e.name}</span>
                    {e.muscleGroup && (
                      <span className="text-xs text-muted">
                        {MUSCLE_GROUP_LABELS[e.muscleGroup]}
                      </span>
                    )}
                  </button>
                </li>
              ))}
              {items.length === 0 && (
                <li className="px-4 py-6 text-center text-sm text-muted">Ничего не найдено</li>
              )}
            </ul>
          )}
          <Button block variant="secondary" onClick={() => setCreating(true)}>
            + Новое упражнение{search.trim() ? ` «${search.trim()}»` : ''}
          </Button>
        </div>
      </Sheet>
      <ExerciseFormSheet
        open={open && creating}
        initialName={search.trim()}
        onClose={() => setCreating(false)}
        onSaved={(e) => {
          setCreating(false);
          onPick(e);
        }}
      />
    </>
  );
}
