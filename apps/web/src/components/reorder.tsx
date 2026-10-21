'use client';

import { ArrowDown, ArrowUp } from './icons';
import { IconButton } from './ui';

/** Up/down controls, shown only in "change order" mode. */
export function ReorderButtons({
  index,
  count,
  onMove,
  label,
}: {
  index: number;
  count: number;
  onMove: (from: number, to: number) => void;
  label: string;
}) {
  return (
    <div className="flex shrink-0">
      <IconButton
        label={`Переместить «${label}» выше`}
        disabled={index === 0}
        onClick={() => onMove(index, index - 1)}
      >
        <ArrowUp />
      </IconButton>
      <IconButton
        label={`Переместить «${label}» ниже`}
        disabled={index === count - 1}
        onClick={() => onMove(index, index + 1)}
      >
        <ArrowDown />
      </IconButton>
    </div>
  );
}

export function moveItem<T>(items: readonly T[], from: number, to: number): T[] {
  const copy = [...items];
  const [item] = copy.splice(from, 1);
  copy.splice(to, 0, item!);
  return copy;
}
