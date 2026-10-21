'use client';

import { formatWeight, parseWeightInput, REPS_MAX } from '@gym/shared';
import { useId, useState } from 'react';
import { Button, cx } from '@/components/ui';

export interface SetEntryValue {
  weightKg: number;
  reps: number;
  status: 'completed' | 'skipped';
}

function Stepper({
  label,
  value,
  onChange,
  step,
  inputMode,
  unit,
  invalid,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  step: number;
  inputMode: 'decimal' | 'numeric';
  unit: string;
  invalid?: boolean;
}) {
  const id = useId();
  const bump = (dir: 1 | -1) => {
    const current = Number(value.replace(',', '.')) || 0;
    const next = Math.max(0, Math.round((current + dir * step) * 100) / 100);
    onChange(inputMode === 'numeric' ? String(Math.round(next)) : formatWeight(next));
  };
  return (
    <div className="min-w-0 flex-1">
      <label htmlFor={id} className="mb-1.5 block text-center text-[14px] font-medium text-muted">
        {label}
      </label>
      <div
        className={cx(
          'flex items-center rounded-2xl border border-line bg-inset',
          invalid && 'ring-2 ring-danger',
        )}
      >
        <button
          type="button"
          aria-label={`${label}: уменьшить на ${step}`}
          onClick={() => bump(-1)}
          className="press grid h-14 w-12 shrink-0 place-items-center text-2xl font-semibold text-muted"
        >
          −
        </button>
        <div className="flex min-w-0 flex-1 items-baseline justify-center">
          <input
            id={id}
            value={value}
            onChange={(e) => onChange(e.target.value.replace(/[^\d.,]/g, ''))}
            onFocus={(e) => e.target.select()}
            inputMode={inputMode}
            enterKeyHint="done"
            autoComplete="off"
            placeholder="0"
            className="num w-full min-w-0 bg-transparent text-center text-[28px] font-semibold outline-none"
          />
        </div>
        <span className="sr-only">{unit}</span>
        <button
          type="button"
          aria-label={`${label}: увеличить на ${step}`}
          onClick={() => bump(1)}
          className="press grid h-14 w-12 shrink-0 place-items-center text-2xl font-semibold text-muted"
        >
          +
        </button>
      </div>
    </div>
  );
}

/**
 * Input for one set. Values may be pre-filled as a *suggestion*, but nothing
 * is recorded until the user explicitly taps "Записать" or "Пропустить".
 * Values are seeded once on mount and kept after submitting, so the next set
 * starts from the previous one. Parents remount it (via `key`) to reseed.
 */
export function SetEntry({
  setNumber,
  suggestion,
  initial,
  onSubmit,
  onCancel,
  submitLabel = 'Записать подход',
}: {
  setNumber: number;
  suggestion?: { weightKg: number; reps: number } | null;
  initial?: { weightKg: number; reps: number } | null;
  onSubmit: (v: SetEntryValue) => void;
  onCancel?: () => void;
  submitLabel?: string;
}) {
  const seed = initial ?? suggestion ?? null;
  const [weight, setWeight] = useState(seed ? formatWeight(seed.weightKg) : '');
  const [reps, setReps] = useState(seed ? String(seed.reps) : '');
  const [touched, setTouched] = useState(false);

  const weightKg = weight === '' ? 0 : parseWeightInput(weight);
  const repsN = /^\d+$/.test(reps) ? Number(reps) : null;
  const weightError = weightKg === null ? 'Вес: число от 0 до 1000, например 22.5' : null;
  const repsError =
    repsN === null || repsN < 1 || repsN > REPS_MAX ? 'Повторы: целое число от 1' : null;

  const submit = (status: 'completed' | 'skipped') => {
    setTouched(true);
    if (status === 'completed' && (weightError || repsError)) return;
    onSubmit({
      weightKg: weightKg ?? 0,
      reps: status === 'skipped' ? (repsN ?? 0) : repsN!,
      status,
    });
    setTouched(false);
  };

  return (
    <div className="space-y-3 rounded-[22px] border border-line bg-card p-4">
      <p className="text-center text-[15px] font-semibold">Подход {setNumber}</p>
      <div className="flex gap-3">
        <Stepper
          label="Вес, кг"
          value={weight}
          onChange={setWeight}
          step={2.5}
          inputMode="decimal"
          unit="килограммов"
          invalid={touched && !!weightError}
        />
        <Stepper
          label="Повторы"
          value={reps}
          onChange={setReps}
          step={1}
          inputMode="numeric"
          unit="повторений"
          invalid={touched && !!repsError}
        />
      </div>
      {touched && (weightError || repsError) && (
        <p role="alert" className="text-center text-[14px] text-danger">
          {weightError ?? repsError}
        </p>
      )}
      <Button block size="lg" variant="success" onClick={() => submit('completed')}>
        ✓ {submitLabel}
      </Button>
      <div className="flex gap-2">
        <Button variant="secondary" className="flex-1" onClick={() => submit('skipped')}>
          Пропустить подход
        </Button>
        {onCancel && (
          <Button variant="secondary" className="flex-1" onClick={onCancel}>
            Отмена
          </Button>
        )}
      </div>
    </div>
  );
}
