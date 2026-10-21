'use client';

import type { QueryClient } from '@tanstack/react-query';
import { useSyncExternalStore } from 'react';
import { ApiError, http, isRetryable } from './api';
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

async function send(op: OutboxOp) {
  if (op.kind === 'putSet') await http.put(`/sessions/${op.sessionId}/sets/${op.setId}`, op.body);
  else await http.del(`/sessions/${op.sessionId}/sets/${op.setId}`);
}

export async function flush(): Promise<void> {
  if (sending || typeof window === 'undefined') return;
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  sending = true;
  persist();
  const touched = new Set<string>();
  try {
    while (queue.length > 0) {
      const op = queue[0]!;
      try {
        await send(op);
        attempt = 0;
        lastError = null;
      } catch (e) {
        if (isRetryable(e)) {
          lastError = 'offline';
          timer = setTimeout(() => flush(), backoffMs(attempt++));
          return;
        }
        // Permanent rejection (validation, cancelled session…): drop and resync.
        lastError = e instanceof ApiError ? e.message : 'Ошибка сохранения';
      }
      touched.add(op.sessionId);
      queue = queue.slice(1);
      persist();
    }
  } finally {
    sending = false;
    persist();
    for (const id of touched)
      void queryClient?.invalidateQueries({ queryKey: queryKeys.session(id) });
    if (touched.size) void queryClient?.invalidateQueries({ queryKey: queryKeys.activeSession });
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
