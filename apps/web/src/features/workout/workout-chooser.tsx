'use client';

import { Button, PageLoader, PlateBadge, Sheet, cx } from '@/components/ui';
import { plural } from '@/lib/format';
import { useProgram } from '@/lib/queries';

/** Pick any workout of a program to start now (skipping is not "completing"). */
export function WorkoutChooser({
  programId,
  open,
  onClose,
  onStart,
  starting,
}: {
  programId: string;
  open: boolean;
  onClose: () => void;
  onStart: (workoutId: string) => void;
  starting: boolean;
}) {
  const { data: program, isLoading } = useProgram(programId);
  return (
    <Sheet open={open} onClose={onClose} title="Какую тренировку начать?">
      {isLoading || !program ? (
        <PageLoader />
      ) : (
        <ul className="space-y-2">
          {program.workouts.map((w, i) => {
            const empty = w.exercises.length === 0;
            const next = program.nextWorkoutId === w.id;
            return (
              <li key={w.id}>
                <button
                  type="button"
                  disabled={empty || starting}
                  onClick={() => onStart(w.id)}
                  className={cx(
                    'press flex w-full items-center gap-3 rounded-[20px] border bg-card p-3 text-left disabled:opacity-50',
                    next ? 'border-primary' : 'border-line',
                  )}
                >
                  <PlateBadge index={i} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{w.name}</span>
                    <span className="block text-[14px] text-muted">
                      {empty
                        ? 'Нет упражнений'
                        : `${w.exercises.length} ${plural(w.exercises.length, 'упражнение', 'упражнения', 'упражнений')}`}
                      {next ? ', по циклу следующая' : ''}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <p className="mt-4 px-1 text-[13px] text-muted">
        Пропущенная тренировка не засчитывается. Следующей по циклу станет та, что идёт после
        выбранной.
      </p>
      <Button block variant="secondary" className="mt-3" onClick={() => onStart('')}>
        Свободная тренировка без плана
      </Button>
    </Sheet>
  );
}
