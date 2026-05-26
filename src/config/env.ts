import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  PORT: z.coerce.number().default(8000),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  DATABASE_URL: z.string().url(),
  CLIENT_URL: z.string(),
  JWT_SECRET: z.string().min(32),
  JWT_EXPIRES_IN: z.string().default('1d'),
  BCRYPT_SALT_ROUNDS: z.coerce.number().int().min(4).max(31).default(12),
  
  BETTER_AUTH_SECRET: z.string().min(32),
  ACCESS_TOKEN_SECRET: z.string().min(32),
  ACCESS_TOKEN_EXPIRES_IN: z.string().default('15m'),
  REFRESH_TOKEN_SECRET: z.string().min(32),
  REFRESH_TOKEN_EXPIRES_IN: z.string().default('7d'),

  BETTER_AUTH_URL: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string(),
  GOOGLE_CLIENT_ID: z.string(),
  GOOGLE_REDIRECT_URI: z.string().default('http://localhost:8000/api/auth/google/callback'),
  TOTP_ENCRYPTION_KEY: z.string().min(32).default('0123456789abcdef0123456789abcdef'),
  COOKIE_DOMAIN: z.string().optional(),
  CLOUDINARY_NAME: z.string(),
  CLOUDINARY_KEY: z.string(),
  CLOUDINARY_SECRET: z.string(),

  REDIS_HOST: z.string(),
  REDIS_PORT: z.coerce.number().default(6379),
  REDIS_USERNAME: z.string().default('default'),
  REDIS_PASSWORD: z.string(),

  STRIPE_SECRET_KEY: z.string(),
  STRIPE_WEBHOOK_SECRET: z.string(),

  GMAIL_APP_PASSWORD: z.string(),
  GROQ_API_KEY: z.string(),
  GROQ_MODEL: z.string(),
  FORM_EMAIL: z.string().email(),
  JWT_EMAIL_TOKEN_SECRET: z.string(),
  TEMP_2FA_TOKEN_SECRET: z.string().min(32).default('change-me-in-production-please-32chars'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid or missing environment variables:');
  console.error(JSON.stringify(parsed.error.flatten().fieldErrors, null, 2));
  process.exit(1);
}

export const envConfig = parsed.data;