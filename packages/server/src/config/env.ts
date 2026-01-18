import { z } from 'zod';
import {
  getJwtSecret,
  getJwtRefreshSecret,
  getVapidPublicKey,
  getVapidPrivateKey,
  getVapidSubject,
} from './secrets.js';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().transform(Number).default('3000'),
  DATABASE_URL: z.string().default('file:./dev.db'),
  JWT_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),
  CLIENT_URL: z.string().default('http://localhost:5173'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment variables:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

// Combine parsed env with auto-generated secrets
export const env = {
  ...parsed.data,
  JWT_SECRET: getJwtSecret(),
  JWT_REFRESH_SECRET: getJwtRefreshSecret(),
  VAPID_PUBLIC_KEY: getVapidPublicKey(),
  VAPID_PRIVATE_KEY: getVapidPrivateKey(),
  VAPID_SUBJECT: getVapidSubject(),
};

export type Env = typeof env;
