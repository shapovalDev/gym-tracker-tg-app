import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: {
    // The on-disk module cache lives at the repo root and is shared by all
    // packages; stale entries from another package's vitest instance break runs.
    fsModuleCache: false,
    include: ['test/**/*.test.ts'],
  },
});
