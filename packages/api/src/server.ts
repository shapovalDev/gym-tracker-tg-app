import { serve } from '@hono/node-server';
import { createApp } from './app';

// Standalone API server (optional). In the default deployment the API runs
// inside the Next.js app; use this when the backend is split out to scale.
const app = createApp();
const port = Number(process.env.API_PORT ?? 4000);
serve({ fetch: app.fetch, port }, (info) =>
  console.info(`API listening on http://localhost:${info.port}/api/v1`),
);
