'use client';

import {
  formatWeight,
  setLabels,
  setsOfType,
  type PreviousResultDto,
  type SetDto,
} from '@gym/shared';
import { ChevronRight, TrashIcon } from '@/components/icons';
import { IconButton, cx } from '@/components/ui';
import { isPendingSet } from '@/lib/outbox-core';
import { t } from '@/i18n';

export function SetRow({
  set,
  label,
  onEdit,
  onDelete,
}: {
  set: SetDto;
  /** "1", "2"… for working sets, "W1"… for warm-ups (see setLabels). */
  label: string;
  onEdit?: () => void;
  onDelete?: () => void;
}) {
  const warmup = set.setType === 'warmup';
  const done = set.status === 'completed';
  const pending = isPendingSet(set);
  const name = warmup
    ? t('Warm-up {n}', { n: label.replace(/^\D+/, '') })
    : t('Set {n}', { n: label });
  return (
    <li
      className={cx(
        'flex items-center gap-3 rounded-2xl border py-1.5 pr-1 pl-3',
        warmup
          ? 'border-dashed border-line bg-card'
          : done
            ? 'border-done/30 bg-done-soft'
            : 'border-line bg-inset',
      )}
    >
      <span
        className={cx(
          'num grid size-9 shrink-0 place-items-center rounded-full text-[14px] font-semibold',
          warmup ? 'bg-skip-soft text-skip' : done ? 'bg-done text-white' : 'bg-card text-muted',
        )}
        aria-label={`${name} ${done ? t('done') : t('skipped')}`}
      >
        {label}
      </span>
      <button
        type="button"
        onClick={onEdit}
        disabled={!onEdit}
        className="min-w-0 flex-1 py-1.5 text-left"
        aria-label={t('Edit: {name}', { name })}
      >
        {done ? (
          <span
            className={cx('num font-semibold', warmup ? 'text-[18px] text-muted' : 'text-[22px]')}
          >
            {formatWeight(set.weightKg)}
            <span className="font-sans text-[15px] font-medium text-muted"> {t('kg')} × </span>
            {set.reps}
          </span>
        ) : (
          <span className="text-[16px] font-medium text-muted">{t('Skipped')}</span>
        )}
        {warmup && <span className="ml-2 text-[13px] text-skip">{t('warm-up')}</span>}
        {set.note && <span className="block text-[14px] text-muted">{set.note}</span>}
        {pending && <span className="block text-[12px] text-skip">{t('saving…')}</span>}
      </button>
      {onDelete && (
        <IconButton label={t('Delete: {name}', { name })} onClick={onDelete}>
          <TrashIcon />
        </IconButton>
      )}
    </li>
  );
}

/** Compact "last time" line; opens the full exercise history. */
export function LastTimeButton({
  previous,
  date,
  onOpen,
}: {
  previous: PreviousResultDto | null;
  date: string | null;
  onOpen: () => void;
}) {
  const working = previous ? setsOfType(previous.sets, 'working') : [];
  const warmups = previous ? setsOfType(previous.sets, 'warmup').length : 0;
  return (
    <button
      type="button"
      onClick={onOpen}
      className="press flex w-full items-center gap-3 rounded-2xl border border-line bg-card px-4 py-3 text-left"
    >
      <span className="min-w-0 flex-1">
        <span className="block text-[13px] text-muted">
          {previous && date ? t('Last time, {date}', { date }) : t('Exercise history')}
        </span>
        {previous ? (
          <span className="num mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[16px] font-semibold">
            {working.map((s) => (
              <span
                key={s.setNumber}
                className={s.status === 'skipped' ? 'text-muted line-through' : ''}
              >
                {formatWeight(s.weightKg)}×{s.reps}
              </span>
            ))}
            {warmups > 0 && (
              <span className="font-sans text-[14px] font-medium text-muted">
                {t('+ {n} warm-up', { n: warmups })}
              </span>
            )}
          </span>
        ) : (
          <span className="block text-[15px]">{t('First time: no previous results')}</span>
        )}
      </span>
      <span className="flex shrink-0 items-center gap-0.5 text-[14px] font-semibold text-primary">
        {t('All')}
        <ChevronRight />
      </span>
    </button>
  );
}

/** ●●○○ — recorded vs planned working sets. */
export function SetDots({ done, planned }: { done: number; planned: number }) {
  const total = Math.max(planned, done);
  if (total === 0) return null;
  return (
    <span
      className="flex gap-1"
      aria-label={t('{done} of {total} sets', { done, total: planned || done })}
    >
      {Array.from({ length: Math.min(total, 10) }, (_, i) => (
        <span key={i} className={cx('size-2 rounded-full', i < done ? 'bg-done' : 'bg-line')} />
      ))}
    </span>
  );
}

export { setLabels };
