'use client';

import { formatWeight, type SetDto } from '@gym/shared';
import { cx } from '@/components/ui';
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
        'flex items-center gap-3 rounded-2xl px-3 py-2',
        done ? 'bg-success/10' : 'bg-surface-2',
      )}
    >
      <span
        className={cx(
          'num grid size-8 shrink-0 place-items-center rounded-full text-sm font-bold',
          done ? 'bg-success text-white' : 'bg-border text-muted',
        )}
        aria-label={done ? `Подход ${set.setNumber} выполнен` : `Подход ${set.setNumber} пропущен`}
      >
        {set.setNumber}
      </span>
      <button
        type="button"
        onClick={onEdit}
        disabled={!onEdit}
        className="min-w-0 flex-1 text-left"
      >
        <span className="num text-[20px] font-bold">
          {formatWeight(set.weightKg)}
          <span className="text-sm font-medium text-muted"> кг × </span>
          {set.reps}
        </span>
        <span className="ml-2 text-xs text-muted">
          {done ? '' : 'пропущен'}
          {pending ? ' · сохраняется…' : ''}
        </span>
      </button>
      {onDelete && (
        <button
          type="button"
          onClick={onDelete}
          aria-label={`Удалить подход ${set.setNumber}`}
          className="grid size-10 place-items-center rounded-xl text-muted"
        >
          ✕
        </button>
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
    <div className="rounded-2xl bg-surface-2 px-3 py-2">
      <p className="text-xs font-medium text-muted">Прошлый раз · {date}</p>
      <p className="num mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[15px] font-semibold">
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
