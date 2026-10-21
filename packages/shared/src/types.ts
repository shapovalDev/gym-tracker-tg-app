import type { MuscleGroup, Period, SessionStatus, SetStatus } from './constants';
import type { PersonalRecords, SessionPoint, SessionSummary } from './domain/metrics';

/** API response DTOs (dates are ISO strings). */

export interface ApiError {
  error: { code: string; message: string; details?: unknown };
}

export interface ExerciseDto {
  id: string;
  name: string;
  muscleGroup: MuscleGroup | null;
  description: string | null;
  archivedAt: string | null;
  createdAt: string;
}

export interface WorkoutExerciseDto {
  id: string;
  exerciseId: string;
  exercise: Pick<ExerciseDto, 'id' | 'name' | 'muscleGroup' | 'archivedAt'>;
  position: number;
  plannedSets: number | null;
  targetRepsMin: number | null;
  targetRepsMax: number | null;
  notes: string | null;
}

export interface ProgramWorkoutDto {
  id: string;
  programId: string;
  name: string;
  position: number;
  exercises: WorkoutExerciseDto[];
}

export interface ProgramSummaryDto {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  archivedAt: string | null;
  workoutCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ProgramDto extends Omit<ProgramSummaryDto, 'workoutCount'> {
  workouts: ProgramWorkoutDto[];
  nextWorkoutId: string | null;
}

export interface SetDto {
  id: string;
  sessionExerciseId: string;
  setNumber: number;
  weightKg: number;
  reps: number;
  status: SetStatus;
  updatedAt: string;
}

export interface PreviousResultDto {
  sessionId: string;
  date: string;
  sets: Pick<SetDto, 'setNumber' | 'weightKg' | 'reps' | 'status'>[];
}

export interface SessionExerciseDto {
  id: string;
  exerciseId: string;
  name: string;
  muscleGroup: MuscleGroup | null;
  position: number;
  plannedSets: number | null;
  targetRepsMin: number | null;
  targetRepsMax: number | null;
  notes: string | null;
  sets: SetDto[];
  previous: PreviousResultDto | null;
}

export interface SessionDto {
  id: string;
  status: SessionStatus;
  programId: string | null;
  workoutId: string | null;
  programName: string | null;
  workoutName: string | null;
  startedAt: string;
  completedAt: string | null;
  exercises: SessionExerciseDto[];
  summary: SessionSummary;
}

export interface SessionListItemDto {
  id: string;
  status: SessionStatus;
  programName: string | null;
  workoutName: string | null;
  startedAt: string;
  completedAt: string | null;
  exerciseNames: string[];
  summary: SessionSummary;
}

export interface Paginated<T> {
  items: T[];
  nextCursor: string | null;
}

export interface ExerciseHighlightDto {
  exerciseId: string;
  name: string;
  lastDate: string;
  lastBestE1rmKg: number | null;
  lastMaxWeightKg: number;
  changeE1rmPct: number | null;
}

export interface HomeDto {
  activeProgram: { id: string; name: string; workoutCount: number } | null;
  nextWorkout: { id: string; name: string; position: number; exerciseCount: number } | null;
  activeSession: { id: string; workoutName: string | null; startedAt: string } | null;
  lastSession: SessionListItemDto | null;
  completedLast7Days: number;
  completedLast30Days: number;
  highlights: ExerciseHighlightDto[];
}

export interface MeDto {
  id: string;
  telegramId: string;
  createdAt: string;
}

export interface ExerciseAnalyticsDto {
  exercise: Pick<ExerciseDto, 'id' | 'name' | 'muscleGroup' | 'archivedAt'>;
  period: Period;
  weightKg: number | null;
  points: SessionPoint[];
  records: PersonalRecords;
  availableWeights: number[];
  summary: {
    sessions: number;
    workingSets: number;
    volumeKg: number;
    bestE1rmKg: number | null;
    previousBestE1rmKg: number | null;
    changeE1rmPct: number | null;
    previousVolumeKg: number | null;
    changeVolumePct: number | null;
  };
}

export interface StatsSummaryDto {
  period: Period;
  completedWorkouts: number;
  totalSets: number;
  volumeKg: number;
  previous: { completedWorkouts: number; totalSets: number; volumeKg: number } | null;
  changeVolumePct: number | null;
  changeWorkoutsPct: number | null;
}
