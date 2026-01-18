import { z } from 'zod';
import {
  getJwtSecret,
  getJwtRefreshSecret,
  getVapidPublicKey,
  getVapidPrivateKey,
  getVapidSubject,
} from './secrets.js';
import { join } from 'path';

const DB_TYPE_ENUM = z.enum(['sqlite', 'postgresql']);
type DbType = z.infer<typeof DB_TYPE_ENUM>;

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().transform(Number).default('3000'),
  DB_TYPE: DB_TYPE_ENUM.default('sqlite'),
  DATABASE_URL: z.string().optional(),
  JWT_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),
  CLIENT_URL: z.string().default('http://localhost:5173'),
  DATA_DIR: z.string().default('./data'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment variables:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

// Validate DATABASE_URL is provided when using PostgreSQL
if (parsed.data.DB_TYPE === 'postgresql' && !parsed.data.DATABASE_URL) {
  console.error('DATABASE_URL is required when DB_TYPE is postgresql');
  process.exit(1);
}

// Build the database URL based on DB_TYPE
function getDatabaseUrl(dbType: DbType, providedUrl: string | undefined, dataDir: string): string {
  if (dbType === 'postgresql') {
    return providedUrl!; // Already validated above
  }
  // SQLite - use the data directory
  const dbPath = join(dataDir, 'database', 'dreamtime.db');
  return `file:${dbPath}`;
}

const databaseUrl = getDatabaseUrl(
  parsed.data.DB_TYPE,
  parsed.data.DATABASE_URL,
  parsed.data.DATA_DIR
);

// Combine parsed env with auto-generated secrets and computed values
export const env = {
  ...parsed.data,
  DATABASE_URL: databaseUrl,
  JWT_SECRET: getJwtSecret(),
  JWT_REFRESH_SECRET: getJwtRefreshSecret(),
  VAPID_PUBLIC_KEY: getVapidPublicKey(),
  VAPID_PRIVATE_KEY: getVapidPrivateKey(),
  VAPID_SUBJECT: getVapidSubject(),
};

export type Env = typeof env;

// Log configuration on startup (hide sensitive values)
export function logConfig(): void {
  console.log('Configuration:');
  console.log(`  NODE_ENV: ${env.NODE_ENV}`);
  console.log(`  PORT: ${env.PORT}`);
  console.log(`  DB_TYPE: ${env.DB_TYPE}`);
  console.log(`  DATABASE_URL: ${env.DB_TYPE === 'sqlite' ? env.DATABASE_URL : '[hidden]'}`);
  console.log(`  DATA_DIR: ${env.DATA_DIR}`);
}
