'use client';

import { MUSCLE_GROUPS, type ExerciseDto, type MuscleGroup } from '@gym/shared';
import { useEffect, useState } from 'react';
import { Button, Field, Select, Sheet, TextArea } from '@/components/ui';
import { http } from '@/lib/api';
import { useApiMutation } from '@/lib/mutations';
import { t } from '@/i18n';
import { muscleLabel } from '@/lib/format';

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
  exercise?: Pick<ExerciseDto, 'id' | 'name' | 'muscleGroup' | 'description'> | null;
  initialName?: string;
  onSaved?: (e: ExerciseDto) => void;
}) {
  const [name, setName] = useState('');
  const [muscle, setMuscle] = useState<MuscleGroup | ''>('');
  const [description, setDescription] = useState('');
  useEffect(() => {
    if (!open) return;
    setName(exercise?.name ?? initialName);
    setMuscle(exercise?.muscleGroup ?? '');
    setDescription(exercise?.description ?? '');
  }, [open, exercise, initialName]);

  const save = useApiMutation(
    () => {
      const body = { name, muscleGroup: muscle || null, description: description || null };
      return exercise
        ? http.patch<ExerciseDto>(`/exercises/${exercise.id}`, body)
        : http.post<ExerciseDto>('/exercises', body);
    },
    {
      invalidate: [['exercises'], ['program'], ['session']],
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
