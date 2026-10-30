'use client';

import { formatWeight, parseWeightInput, REPS_MAX, SET_NOTE_MAX, type SetType } from '@gym/shared';
import { useId, useState } from 'react';
import { CheckIcon } from '@/components/icons';
import { Button, cx } from '@/components/ui';
import { haptic } from '@/lib/telegram';
import { t } from '@/i18n';

export interface SetEntryValue {
  weightKg: number;
  reps: number;
  status: 'completed' | 'skipped';
  setType: SetType;
  note: string | null;
}

export interface LastTimeSet {
  weightKg: number;
  reps: number;
  status: string;
  note?: string | null;
}

// Translated at render time: the saved comment is plain text in the user's language.
const QUICK_NOTES = ['Hard', 'Easy', 'Form broke down', 'With a spotter', 'With a pause'] as const;

function Stepper({
  label,
  value,
  onChange,
  step,
  inputMode,
  unit,
  invalid,
  big,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  step: number;
  inputMode: 'decimal' | 'numeric';
  unit: string;
  invalid?: boolean;
  /** The weight: the largest number on the screen. */
  big?: boolean;
}) {
  const id = useId();
  const bump = (dir: 1 | -1) => {
    const current = Number(value.replace(',', '.')) || 0;
    const next = Math.max(0, Math.round((current + dir * step) * 100) / 100);
    haptic.select();
    onChange(inputMode === 'numeric' ? String(Math.round(next)) : formatWeight(next));
  };
  const button = cx(
    'press grid shrink-0 place-items-center rounded-full bg-inset font-semibold text-ink',
    big ? 'size-[58px] text-[28px]' : 'size-[50px] text-[24px]',
  );
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        aria-label={t('{name}: decrease by {step}', { name: label, step })}
        onClick={() => bump(-1)}
        className={button}
      >
        −
      </button>
      <div
        className={cx(
          'flex min-w-0 flex-1 flex-col items-center rounded-xl py-0.5',
          invalid && 'ring-2 ring-danger',
        )}
      >
        <input
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value.replace(/[^\d.,]/g, ''))}
          onFocus={(e) => e.target.select()}
          inputMode={inputMode}
          enterKeyHint="done"
          autoComplete="off"
          placeholder="0"
          className={cx(
            'num w-full min-w-0 bg-transparent text-center leading-none font-bold outline-none',
            // long values ("142.5") shrink instead of being clipped on narrow phones
            big
              ? value.length >= 5
                ? 'h-[60px] text-[46px]'
                : 'h-[60px] text-[60px]'
              : 'h-[44px] text-[42px]',
          )}
        />
        <label
          htmlFor={id}
          className="mt-1 text-[11px] font-semibold tracking-[0.12em] text-muted uppercase"
        >
          {label}
        </label>
        <span className="sr-only">{unit}</span>
      </div>
      <button
        type="button"
        aria-label={t('{name}: increase by {step}', { name: label, step })}
        onClick={() => bump(1)}
        className={button}
      >
        +
      </button>
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
  counts,
  title,
  suggestion,
  initial,
  lastTime,
  onSubmit,
  onCancel,
  submitLabel,
}: {
  /** Sets of each type already recorded (titles the next one). */
  counts?: { working: number; warmup: number };
  /** Fixed title when editing an existing set. */
  title?: string;
  suggestion?: { weightKg: number; reps: number } | null;
  initial?: { weightKg: number; reps: number; setType?: SetType; note?: string | null } | null;
  /** The matching set from last time for the selected type, if any. */
  lastTime?: (type: SetType) => LastTimeSet | null;
  onSubmit: (v: SetEntryValue) => void;
  onCancel?: () => void;
  submitLabel?: string;
}) {
  const seed = initial ?? suggestion ?? null;
  const [weight, setWeight] = useState(seed ? formatWeight(seed.weightKg) : '');
  const [reps, setReps] = useState(seed ? String(seed.reps) : '');
  const [setType, setSetType] = useState<SetType>(initial?.setType ?? 'working');
  const [note, setNote] = useState(initial?.note ?? '');
  const [noteOpen, setNoteOpen] = useState(!!initial?.note);
  const [touched, setTouched] = useState(false);
  const noteId = useId();

  const weightKg = weight === '' ? 0 : parseWeightInput(weight);
  const repsN = /^\d+$/.test(reps) ? Number(reps) : null;
  const weightError = weightKg === null ? t('Weight: a number from 0 to 1000, e.g. 22.5') : null;
  const repsError =
    repsN === null || repsN < 1 || repsN > REPS_MAX ? t('Reps: a whole number from 1') : null;
  const heading =
    title ??
    (setType === 'warmup'
      ? t('Warm-up {n}', { n: (counts?.warmup ?? 0) + 1 })
      : t('Set {n}', { n: (counts?.working ?? 0) + 1 }));
  const last = lastTime?.(setType) ?? null;

  const submit = (status: 'completed' | 'skipped') => {
    setTouched(true);
    if (status === 'completed' && (weightError || repsError)) {
      haptic.error();
      return;
    }
    if (status === 'completed') haptic.success();
    onSubmit({
      weightKg: weightKg ?? 0,
      reps: status === 'skipped' ? (repsN ?? 0) : repsN!,
      status,
      setType,
      note: note.trim() || null,
    });
    // weight/reps/type stay as the suggestion for the next set; the comment is per set
    setNote('');
    setNoteOpen(false);
    setTouched(false);
  };

  return (
    <div
      className={cx(
        'space-y-3.5 rounded-[22px] border-2 bg-card p-4',
        setType === 'warmup' ? 'border-dashed border-skip' : 'border-primary',
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <p className="display text-[22px] leading-none font-semibold">{heading}</p>
        <div
          role="radiogroup"
          aria-label={t('Set type')}
          className="flex rounded-[11px] bg-inset p-[3px]"
        >
          {(
            [
              ['working', t('Working')],
              ['warmup', t('Warm-up')],
            ] as const
          ).map(([v, l]) => (
            <button
              key={v}
              type="button"
              role="radio"
              aria-checked={setType === v}
              onClick={() => setSetType(v)}
              className={cx(
                'h-8 rounded-lg px-2.5 text-[13px]',
                setType === v
                  ? v === 'warmup'
                    ? 'bg-skip-soft font-bold text-skip'
                    : 'bg-seg-on font-bold text-on-seg-on'
                  : 'font-semibold text-muted',
              )}
            >
              {l}
            </button>
          ))}
        </div>
      </div>

      {lastTime && (
        <p className="rounded-xl bg-inset px-3 py-2 text-[13px]" aria-live="polite">
          {last ? (
            <>
              <span className="text-muted">{t('Last time:')} </span>
              {last.status === 'skipped' ? (
                <span className="font-semibold">{t('skipped')}</span>
              ) : (
                <span className="num font-semibold">
                  {formatWeight(last.weightKg)} {t('kg')} × {last.reps}
                </span>
              )}
              {last.note && <span className="text-muted">, «{last.note}»</span>}
            </>
          ) : (
            <span className="text-muted">{t('No such set last time')}</span>
          )}
        </p>
      )}

      <div className="space-y-3">
        <Stepper
          big
          label={t('Weight, kg')}
          value={weight}
          onChange={setWeight}
          step={1}
          inputMode="decimal"
          unit={t('kilograms')}
          invalid={touched && !!weightError}
        />
        <div className="h-px bg-line" aria-hidden />
        <Stepper
          label={t('Reps')}
          value={reps}
          onChange={setReps}
          step={1}
          inputMode="numeric"
          unit={t('repetitions')}
          invalid={touched && !!repsError}
        />
      </div>
      {touched && (weightError || repsError) && (
        <p role="alert" className="text-center text-[14px] text-danger">
          {weightError ?? repsError}
        </p>
      )}

      {noteOpen ? (
        <div className="space-y-2">
          <label htmlFor={noteId} className="block px-1 text-[14px] font-medium">
            {t('Set comment')}
          </label>
          <textarea
            id={noteId}
            value={note}
            rows={3}
            maxLength={SET_NOTE_MAX}
            onChange={(e) => setNote(e.target.value)}
            placeholder={t('E.g. last rep with some cheating')}
            className="w-full resize-none rounded-xl border border-line bg-inset px-3 py-2.5 text-[16px] leading-snug outline-none focus:border-primary focus:ring-4 focus:ring-primary/20"
          />
          <div
            className="scroll-row -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5"
            role="group"
            aria-label={t('Quick comment')}
          >
            {QUICK_NOTES.map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => setNote(t(q))}
                className={cx(
                  'h-8 shrink-0 rounded-full border px-3 text-[13px] font-medium',
                  note === t(q) ? 'border-primary bg-primary text-on-primary' : 'border-line',
                )}
              >
                {t(q)}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <button
          type="button"
          className="py-1 text-[14px] font-bold underline decoration-accent decoration-[3px] underline-offset-[5px]"
          onClick={() => setNoteOpen(true)}
        >
          + {t('Comment')}
        </button>
      )}

      <Button block size="lg" variant="success" onClick={() => submit('completed')}>
        <CheckIcon /> {submitLabel ?? t('Record set')}
      </Button>
      <div className="flex gap-2">
        <Button variant="secondary" className="flex-1" onClick={() => submit('skipped')}>
          {t('Skip set')}
        </Button>
        {onCancel && (
          <Button variant="secondary" className="flex-1" onClick={onCancel}>
            {t('Cancel')}
          </Button>
        )}
      </div>
    </div>
  );
}
