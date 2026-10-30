'use client';

import { currentWeek, type HomeDto } from '@gym/shared';
import { useMemo } from 'react';
import { CheckIcon } from '@/components/icons';
import { cx } from '@/components/ui';
import { intlLocale, t } from '@/i18n';

const letter = (position: number) => String.fromCharCode(65 + (position % 26));

/** Monday..Sunday of this week: done days filled, planned days outlined. */
export function WeekStrip({ home }: { home: HomeDto }) {
  const week = useMemo(
    () => currentWeek(new Date(), home.recentWorkouts, home.activeProgram?.schedule ?? []),
    [home],
  );
  const dayName = new Intl.DateTimeFormat(intlLocale(), { weekday: 'short' });
  return (
    <ol className="grid grid-cols-7 gap-1.5" aria-label={t('This week')}>
      {week.map((d) => {
        const done = d.donePosition !== null;
        const planned = d.plannedPosition !== null;
        const short = dayName.format(new Date(`${d.date}T12:00:00`)).replace('.', '');
        const label = short.charAt(0).toUpperCase() + short.slice(1);
        return (
          <li key={d.date} className="flex flex-col items-center gap-1.5">
            <span
              aria-label={`${label}: ${done ? t('done') : planned ? t('planned') : t('rest')}`}
              className={cx(
                'num grid h-[34px] w-full place-items-center rounded-md text-[15px] font-bold',
                done
                  ? 'bg-done text-on-done'
                  : planned && d.isToday
                    ? 'border-2 border-dashed border-ink text-ink'
                    : planned
                      ? 'border border-dashed border-muted text-muted'
                      : 'border border-line',
              )}
            >
              {done ? (
                d.donePosition! >= 0 ? (
                  letter(d.donePosition!)
                ) : (
                  <CheckIcon />
                )
              ) : planned ? (
                letter(d.plannedPosition!)
              ) : null}
            </span>
            <span
              aria-current={d.isToday ? 'date' : undefined}
              className={cx(
                'text-[11px] font-semibold',
                d.isToday
                  ? 'text-ink underline decoration-accent decoration-[3px] underline-offset-4'
                  : 'text-muted',
              )}
            >
              {label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
