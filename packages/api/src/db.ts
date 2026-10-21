import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from './generated/prisma/client';

export type Db = PrismaClient;

const globalForPrisma = globalThis as unknown as { __gymPrisma?: PrismaClient };

/** One client per process (survives Next.js dev hot reloads). */
export function getDb(databaseUrl: string): PrismaClient {
  if (!globalForPrisma.__gymPrisma) {
    // Small pool: serverless instances are short-lived and Supabase's pooler multiplexes.
    const adapter = new PrismaPg({ connectionString: databaseUrl, max: 5 });
    globalForPrisma.__gymPrisma = new PrismaClient({ adapter });
  }
  return globalForPrisma.__gymPrisma;
}

export function createDb(databaseUrl: string): PrismaClient {
  return new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl, max: 5 }) });
}
