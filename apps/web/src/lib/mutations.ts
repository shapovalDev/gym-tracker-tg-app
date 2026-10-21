'use client';

import { useMutation, useQueryClient, type QueryKey } from '@tanstack/react-query';
import { errorMessage } from './api';
import { haptic } from './telegram';
import { toast } from './toast';

/**
 * Mutation that reports errors as a toast and refreshes the listed queries.
 * Server data stays the single source of truth.
 */
export function useApiMutation<TVars, TResult>(
  fn: (vars: TVars) => Promise<TResult>,
  options: {
    invalidate?: QueryKey[];
    onSuccess?: (result: TResult, vars: TVars) => void;
    success?: string;
  } = {},
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: async (result, vars) => {
      options.onSuccess?.(result, vars);
      if (options.success) toast(options.success, 'success');
      await Promise.all(
        (options.invalidate ?? []).map((queryKey) => qc.invalidateQueries({ queryKey })),
      );
    },
    onError: (e) => {
      haptic.error();
      toast(errorMessage(e), 'error');
    },
  });
}
