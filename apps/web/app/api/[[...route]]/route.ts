import { getApp } from '@gym/api';

// The whole REST API (packages/api, Hono) is served from this one catch-all
// route, so UI and API deploy together on a single free-tier host.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const handler = (req: Request) => getApp().fetch(req);
export { handler as GET, handler as POST, handler as PUT, handler as PATCH, handler as DELETE };
