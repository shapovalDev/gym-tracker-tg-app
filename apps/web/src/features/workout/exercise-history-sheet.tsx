'use client';

import { formatWeight, setLabels } from '@gym/shared';
import { EmptyState, ErrorState, PageLoader, Sheet, cx } from '@/components/ui';
import { errorMessage } from '@/lib/api';
import { formatDate } from '@/lib/format';
import { useExerciseHistory } from '@/lib/queries';
import { t } from '@/i18n';

/** Every set (weights, reps, warm-ups, comments) of the last workouts with this exercise. */
export function ExerciseHistorySheet({
  exerciseId,
  name,
  open,
  onClose,
}: {
  exerciseId: string;
  name: string;
  open: boolean;
  onClose: () => void;
}) {
  const { data, isLoading, error, refetch } = useExerciseHistory(exerciseId, open);
  return (
    <Sheet open={open} onClose={onClose} title={name}>
      {isLoading ? (
        <PageLoader />
      ) : error ? (
        <ErrorState message={errorMessage(error)} onRetry={() => refetch()} />
      ) : !data || data.length === 0 ? (
        <EmptyState
          title={t('No history yet')}
          text={t('Sets from finished workouts with this exercise will appear here.')}
        />
      ) : (
        <ol className="space-y-3">
          {data.map((s) => {
            const labels = setLabels(s.sets, t('W'));
            return (
              <li key={s.sessionId} className="rounded-[20px] border border-line bg-card p-4">
                <div className="mb-2 flex items-baseline justify-between gap-3">
                  <span className="font-semibold">{formatDate(s.date)}</span>
                  {s.workoutName && (
                    <span className="truncate text-[13px] text-muted">{s.workoutName}</span>
                  )}
                </div>
                <table className="w-full text-[15px]">
                  <tbody>
                    {s.sets.map((x) => {
                      const warmup = x.setType === 'warmup';
                      return (
                        <tr key={x.setNumber} className={cx('align-top', warmup && 'text-muted')}>
                          <td
                            className={cx(
                              'num w-10 py-1 pr-2 font-semibold',
                              warmup ? 'text-skip' : 'text-muted',
                            )}
                          >
                            {labels.get(x)}
                          </td>
                          <td className="py-1">
                            {x.status === 'skipped' ? (
                              <span className="text-muted">{t('skipped')}</span>
                            ) : (
                              <span className={cx('num', !warmup && 'font-semibold')}>
                                {formatWeight(x.weightKg)} {t('kg')} × {x.reps}
                              </span>
                            )}
                            {x.note && (
                              <span className="block text-[13px] text-muted">{x.note}</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </li>
            );
          })}
        </ol>
      )}
      <p className="mt-3 px-1 text-[13px] text-muted">
        {t('“{w}” marks warm-up sets: they are not counted in statistics.', { w: t('W') })}
      </p>
    </Sheet>
  );
}
