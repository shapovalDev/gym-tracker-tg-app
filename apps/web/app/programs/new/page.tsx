'use client';

import type { ProgramDto } from '@gym/shared';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button, Field, PageHeader, TextArea } from '@/components/ui';
import { http } from '@/lib/api';
import { useApiMutation } from '@/lib/mutations';

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

export default function NewProgramPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [workouts, setWorkouts] = useState<string[]>(['Тренировка A', 'Тренировка B']);

  const create = useApiMutation(
    () =>
      http.post<ProgramDto>('/programs', {
        name,
        description: description || null,
        workouts: workouts.map((w) => w.trim()).filter(Boolean),
      }),
    { invalidate: [['programs'], ['home']], onSuccess: (p) => router.replace(`/programs/${p.id}`) },
  );

  return (
    <>
      <PageHeader title="Новая программа" />
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim()) create.mutate(undefined);
        }}
      >
        <Field
          label="Название"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Сплит на 4 дня"
          maxLength={100}
          required
        />
        <TextArea
          label="Описание"
          value={description}
          onChange={setDescription}
          placeholder="Необязательно"
        />
        <div className="space-y-2">
          <p className="px-1 text-[13px] font-medium text-muted">Тренировки цикла (по порядку)</p>
          {workouts.map((w, i) => (
            <div key={i} className="flex items-end gap-2">
              <Field
                className="flex-1"
                label={`Тренировка ${i + 1}`}
                value={w}
                maxLength={100}
                onChange={(e) =>
                  setWorkouts(workouts.map((x, j) => (j === i ? e.target.value : x)))
                }
              />
              <Button
                variant="danger"
                aria-label={`Удалить тренировку ${i + 1}`}
                onClick={() => setWorkouts(workouts.filter((_, j) => j !== i))}
              >
                ✕
              </Button>
            </div>
          ))}
          <Button
            variant="secondary"
            block
            onClick={() =>
              setWorkouts([
                ...workouts,
                `Тренировка ${LETTERS[workouts.length] ?? workouts.length + 1}`,
              ])
            }
          >
            + Добавить тренировку
          </Button>
          <p className="px-1 text-xs text-muted">
            Количество тренировок любое. После последней цикл начинается снова с первой. Упражнения
            добавите на следующем шаге.
          </p>
        </div>
        <Button type="submit" block size="lg" loading={create.isPending} disabled={!name.trim()}>
          Создать
        </Button>
      </form>
    </>
  );
}
