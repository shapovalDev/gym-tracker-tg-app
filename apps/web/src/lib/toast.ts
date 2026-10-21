'use client';

import { useSyncExternalStore } from 'react';

export interface Toast {
  id: number;
  text: string;
  tone: 'error' | 'success' | 'info';
}
const NO_TOASTS: Toast[] = [];
let toasts: Toast[] = NO_TOASTS;
let seq = 0;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function toast(text: string, tone: Toast['tone'] = 'info') {
  const t = { id: ++seq, text, tone };
  toasts = [...toasts.slice(-2), t];
  emit();
  setTimeout(() => {
    toasts = toasts.filter((x) => x.id !== t.id);
    emit();
  }, 3500);
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
