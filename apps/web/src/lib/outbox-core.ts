import type { SessionDto, SetDto, SetStatus, SetType } from '@gym/shared';

/**
 * Pure logic of the offline outbox for set mutations.
 * Each op targets one set by its client-generated id, so the server side is
 * idempotent (PUT = create-or-replace, DELETE = ok if already gone).
 */
export interface SetBody {
  sessionExerciseId: string;
  setNumber: number;
  weightKg: number;
  reps: number;
  status: SetStatus;
  setType: SetType;
  note: string | null;
}

export type OutboxOp =
  | { kind: 'putSet'; sessionId: string; setId: string; body: SetBody; queuedAt: number }
  | { kind: 'deleteSet'; sessionId: string; setId: string; queuedAt: number };

/**
 * Adds an op, collapsing older pending ops for the same set: only the latest
 * intent matters. The op currently in flight (index 0 while sending) is kept
 * so ordering with the server stays correct.
 */
export function enqueue(queue: readonly OutboxOp[], op: OutboxOp, inFlight = false): OutboxOp[] {
  const keepHead = inFlight && queue.length > 0 ? [queue[0]!] : [];
  const rest = (inFlight ? queue.slice(1) : queue).filter((q) => q.setId !== op.setId);
  return [...keepHead, ...rest, op];
}

/** Server state + pending local intent = what the user sees. */
export function applyPending(session: SessionDto, queue: readonly OutboxOp[]): SessionDto {
  const ops = queue.filter((q) => q.sessionId === session.id);
  if (ops.length === 0) return session;
  const exercises = session.exercises.map((e) => ({ ...e, sets: [...e.sets] }));
  for (const op of ops) {
    for (const e of exercises) {
      const i = e.sets.findIndex((s) => s.id === op.setId);
      if (op.kind === 'deleteSet') {
        if (i !== -1) {
          e.sets.splice(i, 1);
          e.sets = e.sets.map((s, n) => ({ ...s, setNumber: n + 1 }));
        }
        continue;
      }
      if (i !== -1 && e.id !== op.body.sessionExerciseId) e.sets.splice(i, 1);
      if (e.id !== op.body.sessionExerciseId) continue;
      const next: SetDto & { pending?: boolean } = {
        id: op.setId,
        sessionExerciseId: e.id,
        setNumber: op.body.setNumber,
        weightKg: op.body.weightKg,
        reps: op.body.reps,
        status: op.body.status,
        setType: op.body.setType,
        note: op.body.note,
        updatedAt: new Date(op.queuedAt).toISOString(),
        pending: true,
      };
      const j = e.sets.findIndex((s) => s.id === op.setId);
      if (j === -1) e.sets.push(next);
      else e.sets[j] = next;
      e.sets.sort((a, b) => a.setNumber - b.setNumber);
    }
  }
  return { ...session, exercises };
}

export const isPendingSet = (s: SetDto) => (s as SetDto & { pending?: boolean }).pending === true;

export function backoffMs(attempt: number): number {
  return Math.min(30_000, 1000 * 2 ** Math.min(attempt, 5));
}
