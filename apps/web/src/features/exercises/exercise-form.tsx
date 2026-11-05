'use client';

import {
  MUSCLE_GROUPS,
  TRACKING_TYPES,
  type ExerciseDto,
  type MuscleGroup,
  type TrackingType,
} from '@gym/shared';
import { useEffect, useState } from 'react';
import { Button, Field, Select, Sheet, TextArea } from '@/components/ui';
import { http } from '@/lib/api';
import { useApiMutation } from '@/lib/mutations';
import { t } from '@/i18n';
import { muscleLabel, TRACKING_LABELS } from '@/lib/format';

// English keys, translated at render time.
const TRACKING_HINTS = {
  weight_reps: 'Weight and reps, e.g. bench press.',
  bodyweight: 'Reps with your own body weight, optionally with extra weight. E.g. pull-ups.',
  assisted: 'The machine helps with a counterweight: the less, the better. E.g. gravitron.',
  duration: 'Time with a stopwatch, optionally with extra weight. E.g. plank.',
} as const satisfies Record<TrackingType, string>;

export function MuscleSelect({
  value,
  onChange,
  allowAll,
}: {
  value: MuscleGroup | '';
  onChange: (v: MuscleGroup | '') => void;
  allowAll?: boolean;
}) {
  return (
    <Select
      label={t('Muscle group')}
      value={value}
      onChange={(v) => onChange(v as MuscleGroup | '')}
    >
      <option value="">{allowAll ? t('All groups') : t('Not set')}</option>
      {MUSCLE_GROUPS.map((g) => (
        <option key={g} value={g}>
          {muscleLabel(g)}
        </option>
      ))}
    </Select>
  );
}

/** Create or edit an exercise in the personal library. */
export function ExerciseFormSheet({
  open,
  onClose,
  exercise,
  initialName = '',
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  exercise?: Pick<
    ExerciseDto,
    'id' | 'name' | 'muscleGroup' | 'description' | 'trackingType'
  > | null;
  initialName?: string;
  onSaved?: (e: ExerciseDto) => void;
}) {
  const [name, setName] = useState('');
  const [muscle, setMuscle] = useState<MuscleGroup | ''>('');
  const [description, setDescription] = useState('');
  const [trackingType, setTrackingType] = useState<TrackingType>('weight_reps');
  useEffect(() => {
    if (!open) return;
    setName(exercise?.name ?? initialName);
    setMuscle(exercise?.muscleGroup ?? '');
    setDescription(exercise?.description ?? '');
    setTrackingType(exercise?.trackingType ?? 'weight_reps');
  }, [open, exercise, initialName]);

  const save = useApiMutation(
    () => {
      const body = {
        name,
        muscleGroup: muscle || null,
        description: description || null,
        trackingType,
      };
      return exercise
        ? http.patch<ExerciseDto>(`/exercises/${exercise.id}`, body)
        : http.post<ExerciseDto>('/exercises', body);
    },
    {
      // The type changes how history and statistics read, so refresh them too.
      invalidate: [
        ['exercises'],
        ['program'],
        ['session'],
        ['exercise-history'],
        ['analytics'],
        ['summary'],
        ['history'],
        ['home'],
      ],
      success: exercise ? t('Exercise saved') : t('Exercise created'),
      onSuccess: (e) => {
        onSaved?.(e);
        onClose();
      },
    },
  );

  return (
    <Sheet open={open} onClose={onClose} title={exercise ? t('Exercise') : t('New exercise')}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim()) save.mutate(undefined);
        }}
      >
        <Field
          label={t('Name')}
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={100}
          required
          autoFocus
          placeholder={t('Barbell bench press')}
        />
        <MuscleSelect value={muscle} onChange={setMuscle} />
        <div className="space-y-1.5">
          <Select
            label={t('How to track')}
            value={trackingType}
            onChange={(v) => setTrackingType(v as TrackingType)}
          >
            {TRACKING_TYPES.map((type) => (
              <option key={type} value={type}>
                {t(TRACKING_LABELS[type])}
              </option>
            ))}
          </Select>
          <p className="px-1 text-[13px] text-muted">{t(TRACKING_HINTS[trackingType])}</p>
        </div>
        <TextArea
          label={t('Technique and notes')}
          value={description}
          onChange={setDescription}
          placeholder={t('E.g. shoulder blades back, pause at the bottom')}
          hint={t('Shown in every workout with this exercise.')}
        />
        <Button type="submit" block size="lg" loading={save.isPending} disabled={!name.trim()}>
          {t('Save')}
        </Button>
      </form>
    </Sheet>
  );
}
