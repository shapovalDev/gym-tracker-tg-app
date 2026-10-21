'use client';

import type {
  ExerciseAnalyticsDto,
  ExerciseDto,
  HomeDto,
  MuscleGroup,
  Paginated,
  Period,
  ProgramDto,
  ProgramSummaryDto,
  SessionDto,
  SessionListItemDto,
  StatsSummaryDto,
} from '@gym/shared';
import { keepPreviousData, useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { http } from './api';

export const queryKeys = {
  home: ['home'] as const,
  programs: (archived: boolean) => ['programs', { archived }] as const,
  program: (id: string) => ['program', id] as const,
  exercises: (f: object) => ['exercises', f] as const,
  activeSession: ['session', 'active'] as const,
  session: (id: string) => ['session', id] as const,
  history: (f: object) => ['history', f] as const,
  analytics: (id: string, period: Period, weight: number | null) =>
    ['analytics', id, period, weight] as const,
  summary: (period: Period) => ['summary', period] as const,
};

const qs = (params: Record<string, string | number | undefined | null>) => {
  const s = new URLSearchParams();
  for (const [k, v] of Object.entries(params))
    if (v !== undefined && v !== null && v !== '') s.set(k, String(v));
  const str = s.toString();
  return str ? `?${str}` : '';
};

export const useHome = () =>
  useQuery({ queryKey: queryKeys.home, queryFn: () => http.get<HomeDto>('/me/home') });

export const usePrograms = (archived = false) =>
  useQuery({
    queryKey: queryKeys.programs(archived),
    queryFn: () =>
      http.get<{ items: ProgramSummaryDto[] }>(
        `/programs${qs({ archived: archived ? 'true' : undefined })}`,
      ),
    select: (d) => d.items,
  });

export const useProgram = (id: string) =>
  useQuery({
    queryKey: queryKeys.program(id),
    queryFn: () => http.get<ProgramDto>(`/programs/${id}`),
  });

export const useExercises = (
  f: { search?: string; muscleGroup?: MuscleGroup | ''; archived?: boolean } = {},
) =>
  useQuery({
    queryKey: queryKeys.exercises(f),
    queryFn: () =>
      http.get<{ items: ExerciseDto[] }>(
        `/exercises${qs({ search: f.search, muscleGroup: f.muscleGroup, archived: f.archived ? 'true' : undefined })}`,
      ),
    select: (d) => d.items,
    placeholderData: keepPreviousData,
  });

export const useActiveSession = () =>
  useQuery({
    queryKey: queryKeys.activeSession,
    queryFn: async () =>
      (await http.get<{ session: SessionDto | null }>('/sessions/active')).session,
  });

export const useSession = (id: string) =>
  useQuery({
    queryKey: queryKeys.session(id),
    queryFn: () => http.get<SessionDto>(`/sessions/${id}`),
  });

export const useHistory = (f: { from?: string; to?: string }) =>
  useInfiniteQuery({
    queryKey: queryKeys.history(f),
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      http.get<Paginated<SessionListItemDto>>(
        `/sessions${qs({ from: f.from, to: f.to, cursor: pageParam, limit: 20 })}`,
      ),
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });

export const useExerciseAnalytics = (id: string | null, period: Period, weight: number | null) =>
  useQuery({
    queryKey: queryKeys.analytics(id ?? '', period, weight),
    queryFn: () =>
      http.get<ExerciseAnalyticsDto>(
        `/analytics/exercises/${id}${qs({ period, weightKg: weight })}`,
      ),
    enabled: !!id,
    placeholderData: keepPreviousData,
  });

export const useSummary = (period: Period) =>
  useQuery({
    queryKey: queryKeys.summary(period),
    queryFn: () => http.get<StatsSummaryDto>(`/analytics/summary?period=${period}`),
  });
