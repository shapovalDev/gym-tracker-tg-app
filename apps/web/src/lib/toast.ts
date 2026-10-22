'use client';

import { useSyncExternalStore } from 'react';

export interface Toast {
  id: number;
  text: string;
  tone: 'error' | 'success' | 'info';
  action?: { label: string; onClick: () => void };
}
const NO_TOASTS: Toast[] = [];
let toasts: Toast[] = NO_TOASTS;
let seq = 0;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function dismissToast(id: number) {
  toasts = toasts.filter((x) => x.id !== id);
  emit();
}

/** Short notice; with an `action` (e.g. "Undo") it stays a bit longer. */
export function toast(text: string, tone: Toast['tone'] = 'info', action?: Toast['action']) {
  const t = { id: ++seq, text, tone, action };
  toasts = [...toasts.slice(-1), t];
  emit();
  setTimeout(() => dismissToast(t.id), action ? 6000 : 3000);
}

export function useToasts() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => toasts,
    () => NO_TOASTS,
  );
}
