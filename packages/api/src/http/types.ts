import type { Db } from '../db';
import type { Env } from '../env';

export interface AppVariables {
  db: Db;
  env: Env;
  userId: string;
  telegramId: bigint;
}

export type AppEnv = { Variables: AppVariables };
