'use client';

import { formatWeight, type SetDto } from '@gym/shared';
import { TrashIcon } from '@/components/icons';
import { IconButton, cx } from '@/components/ui';
import { isPendingSet } from '@/lib/outbox-core';

export function SetRow({
  set,
  onEdit,
  onDelete,
}: {
  set: SetDto;
  onEdit?: () => void;
  onDelete?: () => void;
}) {
  const done = set.status === 'completed';
  const pending = isPendingSet(set);
  return (
    <li
      className={cx(
        'flex items-center gap-3 rounded-2xl border py-1.5 pr-1 pl-3',
        done ? 'border-done/30 bg-done-soft' : 'border-line bg-inset',
      )}
    >
      <span
        className={cx(
          'num grid size-9 shrink-0 place-items-center rounded-full text-[15px] font-semibold',
          done ? 'bg-done text-white' : 'bg-card text-muted',
        )}
        aria-label={done ? `Подход ${set.setNumber} выполнен` : `Подход ${set.setNumber} пропущен`}
      >
        {set.setNumber}
      </span>
      <button
        type="button"
        onClick={onEdit}
        disabled={!onEdit}
        className="min-w-0 flex-1 py-1.5 text-left"
        aria-label={`Изменить подход ${set.setNumber}`}
      >
        {done ? (
          <span className="num text-[22px] font-semibold">
            {formatWeight(set.weightKg)}
            <span className="font-sans text-[15px] font-medium text-muted"> кг × </span>
            {set.reps}
          </span>
        ) : (
          <span className="text-[16px] font-medium text-muted">Пропущен</span>
        )}
        {pending && <span className="block text-[12px] text-skip">сохраняется…</span>}
      </button>
      {onDelete && (
        <IconButton label={`Удалить подход ${set.setNumber}`} onClick={onDelete}>
          <TrashIcon />
        </IconButton>
      )}
    </li>
  );
}

export function PreviousSets({
  sets,
  date,
}: {
  sets: { setNumber: number; weightKg: number; reps: number; status: string }[];
  date: string;
}) {
  return (
    <div className="rounded-2xl border border-line bg-card px-4 py-3">
      <p className="text-[13px] text-muted">В прошлый раз, {date}</p>
      <p className="num mt-1 flex flex-wrap gap-x-4 gap-y-1 text-[16px] font-semibold">
        {sets.map((s) => (
          <span
            key={s.setNumber}
            className={s.status === 'skipped' ? 'text-muted line-through' : ''}
          >
            {formatWeight(s.weightKg)}×{s.reps}
          </span>
        ))}
      </p>
    </div>
  );
}

/** ●●○○ — recorded vs planned sets. */
export function SetDots({ done, planned }: { done: number; planned: number }) {
  const total = Math.max(planned, done);
  if (total === 0) return null;
  return (
    <span className="flex gap-1" aria-label={`${done} из ${planned || done} подходов`}>
      {Array.from({ length: Math.min(total, 10) }, (_, i) => (
        <span key={i} className={cx('size-2 rounded-full', i < done ? 'bg-done' : 'bg-line')} />
      ))}
    </span>
  );
}
