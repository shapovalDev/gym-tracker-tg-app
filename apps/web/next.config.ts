import path from 'node:path';
import { config as loadEnv } from 'dotenv';
import type { NextConfig } from 'next';

// Local dev: one .env at the monorepo root. Hosted envs set variables directly.
loadEnv({ path: path.join(import.meta.dirname, '../../.env'), quiet: true });

const nextConfig: NextConfig = {
  // Self-contained server bundle for Docker; Vercel ignores this.
  output: 'standalone',
  // Lets E2E run its own dev server next to a regular one.
  distDir: process.env.NEXT_DIST_DIR ?? '.next',
  outputFileTracingRoot: path.join(import.meta.dirname, '../..'),
  turbopack: { root: path.join(import.meta.dirname, '../..') },
  transpilePackages: ['@gym/api', '@gym/shared'],
  serverExternalPackages: ['pg'],
  poweredByHeader: false,
  reactStrictMode: true,
};

export default nextConfig;
