import { parseEnv } from '@gym/api';

// Misconfiguration (e.g. ALLOW_DEV_AUTH in production) stops the server
// immediately instead of failing every request. Next.js only logs errors thrown
// from register(), so exit explicitly to make a broken deploy visible.
try {
  parseEnv();
} catch (err) {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
}
