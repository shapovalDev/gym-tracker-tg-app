import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from './generated/prisma/client';

export type Db = PrismaClient;

const globalForPrisma = globalThis as unknown as {
  __gymPrisma?: PrismaClient;
  __gymPrismaClass?: typeof PrismaClient;
};

/** One client per process (survives Next.js dev hot reloads). */
export function getDb(databaseUrl: string): PrismaClient {
  // The client is cached on globalThis to survive dev hot reloads. After
  // `prisma generate` (e.g. a new migration) the class changes — drop the stale
  // client, otherwise queries on new columns fail until the server restarts.
  if (globalForPrisma.__gymPrisma && globalForPrisma.__gymPrismaClass !== PrismaClient) {
    void globalForPrisma.__gymPrisma.$disconnect().catch(() => undefined);
    globalForPrisma.__gymPrisma = undefined;
  }
  if (!globalForPrisma.__gymPrisma) {
    globalForPrisma.__gymPrismaClass = PrismaClient;
    // Small pool: serverless instances are short-lived and Supabase's pooler multiplexes.
    const adapter = new PrismaPg({ connectionString: databaseUrl, max: 5 });
    globalForPrisma.__gymPrisma = new PrismaClient({ adapter });
  }
  return globalForPrisma.__gymPrisma;
}

export function createDb(databaseUrl: string): PrismaClient {
  return new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl, max: 5 }) });
}
