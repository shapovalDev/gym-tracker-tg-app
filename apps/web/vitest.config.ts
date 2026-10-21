import path from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@': path.join(import.meta.dirname, 'src') } },
  test: {
    // The on-disk module cache lives at the repo root and is shared by all
    // packages; stale entries from another package's vitest instance break runs.
    fsModuleCache: false,
    environment: 'jsdom',
    include: ['test/**/*.test.{ts,tsx}'],
  },
});
