'use client';

/** Up/down controls: more reliable than drag-and-drop with sweaty thumbs. */
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
    <div className="flex flex-col">
      <button
        type="button"
        aria-label={`Переместить «${label}» выше`}
        disabled={index === 0}
        onClick={() => onMove(index, index - 1)}
        className="grid size-9 place-items-center rounded-xl text-muted disabled:opacity-25"
      >
        ▲
      </button>
      <button
        type="button"
        aria-label={`Переместить «${label}» ниже`}
        disabled={index === count - 1}
        onClick={() => onMove(index, index + 1)}
        className="grid size-9 place-items-center rounded-xl text-muted disabled:opacity-25"
      >
        ▼
      </button>
    </div>
  );
}

export function moveItem<T>(items: readonly T[], from: number, to: number): T[] {
  const copy = [...items];
  const [item] = copy.splice(from, 1);
  copy.splice(to, 0, item!);
  return copy;
}
