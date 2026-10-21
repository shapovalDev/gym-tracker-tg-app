'use client';

import {
  MUSCLE_GROUPS,
  MUSCLE_GROUP_LABELS,
  type ExerciseDto,
  type MuscleGroup,
} from '@gym/shared';
import { useEffect, useId, useState } from 'react';
import { Button, Field, Sheet, TextArea } from '@/components/ui';
import { http } from '@/lib/api';
import { useApiMutation } from '@/lib/mutations';

export function MuscleSelect({
  value,
  onChange,
  allowAll,
}: {
  value: MuscleGroup | '';
  onChange: (v: MuscleGroup | '') => void;
  allowAll?: boolean;
}) {
  const id = useId();
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="block px-1 text-[13px] font-medium text-muted">
        Группа мышц
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value as MuscleGroup | '')}
        className="h-12 w-full rounded-2xl border border-border bg-surface-2 px-4 text-[16px] text-text"
      >
        <option value="">{allowAll ? 'Все группы' : 'Не указана'}</option>
        {MUSCLE_GROUPS.map((g) => (
          <option key={g} value={g}>
            {MUSCLE_GROUP_LABELS[g]}
          </option>
        ))}
      </select>
    </div>
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
  exercise?: ExerciseDto | null;
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
      success: exercise ? 'Сохранено' : 'Упражнение создано',
      onSuccess: (e) => {
        onSaved?.(e);
        onClose();
      },
    },
  );

  return (
    <Sheet open={open} onClose={onClose} title={exercise ? 'Упражнение' : 'Новое упражнение'}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim()) save.mutate(undefined);
        }}
      >
        <Field
          label="Название"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={100}
          required
          autoFocus
          placeholder="Жим штанги лёжа"
        />
        <MuscleSelect value={muscle} onChange={setMuscle} />
        <TextArea
          label="Техника и заметки"
          value={description}
          onChange={setDescription}
          placeholder="Необязательно"
        />
        <Button type="submit" block size="lg" loading={save.isPending} disabled={!name.trim()}>
          Сохранить
        </Button>
      </form>
    </Sheet>
  );
}
