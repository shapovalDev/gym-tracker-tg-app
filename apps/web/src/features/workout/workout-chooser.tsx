'use client';

import { Button, PageLoader, PlateBadge, Sheet, cx } from '@/components/ui';
import { weekdayShort } from '@/lib/format';
import { useProgram } from '@/lib/queries';
import { count, t } from '@/i18n';

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
    <Sheet open={open} onClose={onClose} title={t('Which workout to start?')}>
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
                    'press flex w-full items-center gap-3 rounded-[18px] bg-card p-3 text-left disabled:opacity-50',
                    next ? 'border-2 border-ink' : 'border border-line',
                  )}
                >
                  <PlateBadge index={i} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{w.name}</span>
                    <span className="block text-[14px] text-muted">
                      {w.weekday != null && `${weekdayShort(w.weekday)} · `}
                      {empty ? t('No exercises') : count(w.exercises.length, 'exercise')}
                      {next ? ` · ${t('next')}` : ''}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <p className="mt-4 px-1 text-[13px] text-muted">
        {program?.workouts.some((w) => w.weekday != null)
          ? t('A skipped workout is not counted. The next one follows your schedule.')
          : t(
              'A skipped workout is not counted. The next one in the cycle will be the one after the workout you pick.',
            )}
      </p>
      <Button block variant="secondary" className="mt-3" onClick={() => onStart('')}>
        {t('Free workout without a plan')}
      </Button>
    </Sheet>
  );
}
