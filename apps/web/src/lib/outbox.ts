'use client';

import type { QueryClient } from '@tanstack/react-query';
import { useSyncExternalStore } from 'react';
import type { SessionDto, SetDto } from '@gym/shared';
import { t } from '@/i18n';
import { ApiError, errorMessage, http, isRetryable } from './api';
import { backoffMs, enqueue, type OutboxOp } from './outbox-core';
import { queryKeys } from './queries';

/**
 * Durable queue of set mutations. Every change is written to localStorage
 * *before* it is sent, so a reload, a crash or a dropped connection never
 * loses an entered set. Ops are sent one by one in order and retried with
 * backoff; the server is idempotent, so retries cannot create duplicates.
 */
const KEY = 'gym.outbox.v1';
type Listener = () => void;

let queue: OutboxOp[] = load();
let sending = false;
let attempt = 0;
let timer: ReturnType<typeof setTimeout> | null = null;
let lastError: string | null = null;
let queryClient: QueryClient | null = null;
const listeners = new Set<Listener>();

function load(): OutboxOp[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as OutboxOp[]) : [];
  } catch {
    return [];
  }
}

function persist() {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(queue));
  } catch {
    /* storage unavailable: still kept in memory and sent */
  }
  snapshot = { queue, lastError, sending };
  listeners.forEach((l) => l());
}

let snapshot: { queue: OutboxOp[]; lastError: string | null; sending: boolean } = {
  queue,
  lastError,
  sending,
};

export function initOutbox(client: QueryClient) {
  queryClient = client;
  window.addEventListener('online', () => flush());
  document.addEventListener(
    'visibilitychange',
    () => document.visibilityState === 'visible' && flush(),
  );
  flush();
}

type NewOp = OutboxOp extends infer T ? (T extends OutboxOp ? Omit<T, 'queuedAt'> : never) : never;

export function push(op: NewOp) {
  queue = enqueue(queue, { ...op, queuedAt: Date.now() } as OutboxOp, sending);
  persist();
  flush();
}

async function send(op: OutboxOp): Promise<SetDto | null> {
  if (op.kind === 'putSet')
    return http.put<SetDto>(`/sessions/${op.sessionId}/sets/${op.setId}`, op.body);
  await http.del(`/sessions/${op.sessionId}/sets/${op.setId}`);
  return null;
}

/**
 * Put the confirmed set into cached sessions instead of refetching the whole
 * session after every set (a refetch also recomputes "last time" server-side).
 */
function mergeSet(sessionId: string, set: SetDto) {
  const merge = (s: SessionDto | null | undefined) => {
    if (!s || s.id !== sessionId) return s;
    return {
      ...s,
      exercises: s.exercises.map((e) => {
        const others = e.sets.filter((x) => x.id !== set.id);
        if (e.id !== set.sessionExerciseId)
          return others.length === e.sets.length ? e : { ...e, sets: others };
        return { ...e, sets: [...others, set].sort((a, b) => a.setNumber - b.setNumber) };
      }),
    };
  };
  queryClient?.setQueryData<SessionDto | null>(queryKeys.activeSession, merge);
  queryClient?.setQueryData<SessionDto>(queryKeys.session(sessionId), (s) => merge(s) ?? undefined);
}

export async function flush(): Promise<void> {
  if (sending || typeof window === 'undefined') return;
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  sending = true;
  persist();
  // Sessions that need a full refetch: deletions renumber sets server-side,
  // rejected ops must be replaced by the server's truth.
  const resync = new Set<string>();
  try {
    while (queue.length > 0) {
      const op = queue[0]!;
      try {
        const saved = await send(op);
        attempt = 0;
        lastError = null;
        if (saved) mergeSet(op.sessionId, saved);
        else resync.add(op.sessionId);
      } catch (e) {
        if (isRetryable(e)) {
          lastError = 'offline';
          timer = setTimeout(() => flush(), backoffMs(attempt++));
          return;
        }
        // Permanent rejection (validation, cancelled session…): drop and resync.
        lastError = e instanceof ApiError ? errorMessage(e) : t('Could not save');
        resync.add(op.sessionId);
      }
      queue = queue.slice(1);
      persist();
    }
  } finally {
    sending = false;
    persist();
    for (const id of resync)
      void queryClient?.invalidateQueries({ queryKey: queryKeys.session(id) });
    if (resync.size) void queryClient?.invalidateQueries({ queryKey: queryKeys.activeSession });
  }
}

/** Resolves when everything queued so far has reached the server (or rejects if offline). */
export async function drain(timeoutMs = 10000): Promise<boolean> {
  const started = Date.now();
  while (queue.length > 0) {
    if (Date.now() - started > timeoutMs) return false;
    await flush();
    if (queue.length > 0) await new Promise((r) => setTimeout(r, 300));
  }
  return true;
}

export function discardSession(sessionId: string) {
  queue = queue.filter((q) => q.sessionId !== sessionId);
  persist();
}

export function useOutbox() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => snapshot,
    () => emptySnapshot,
  );
}
const emptySnapshot = { queue: [] as OutboxOp[], lastError: null as string | null, sending: false };
