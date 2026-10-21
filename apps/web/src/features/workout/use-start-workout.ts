'use client';

import type { SessionDto } from '@gym/shared';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ApiError, errorMessage, http } from '@/lib/api';
import { queryKeys } from '@/lib/queries';
import { haptic } from '@/lib/telegram';
import { toast } from '@/lib/toast';

/** Starts a session (idempotent client id) and opens the workout screen. */
export function useStartWorkout() {
  const router = useRouter();
  const qc = useQueryClient();
  const [pending, setPending] = useState(false);
  const start = async (workoutId: string | null) => {
    if (pending) return;
    setPending(true);
    const id = crypto.randomUUID();
    try {
      const session = await http.post<SessionDto>('/sessions', { id, workoutId });
      qc.setQueryData(queryKeys.activeSession, session);
      haptic.tap();
      router.push('/workout');
      void qc.invalidateQueries({ queryKey: queryKeys.home });
    } catch (e) {
      if (e instanceof ApiError && e.code === 'SESSION_IN_PROGRESS') {
        toast('У вас уже есть незавершённая тренировка', 'info');
        router.push('/workout');
      } else {
        toast(errorMessage(e), 'error');
      }
    } finally {
      setPending(false);
    }
  };
  return { start, pending };
}
