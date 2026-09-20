import { z } from 'zod';

export const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  PORT: z.coerce.number().int().positive().default(3001),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  REDIS_URL: z.string().min(1, 'REDIS_URL is required'),
  JWT_ACCESS_SECRET: z
    .string()
    .min(32, 'JWT_ACCESS_SECRET must be at least 32 characters'),
  JWT_ACCESS_TTL: z.string().default('15m'),
  JWT_REFRESH_SECRET: z
    .string()
    .min(32, 'JWT_REFRESH_SECRET must be at least 32 characters'),
  JWT_REFRESH_TTL_DAYS: z.coerce.number().int().positive().default(30),
  CORS_ORIGIN: z.string().min(1, 'CORS_ORIGIN is required'),
  // Optional: AI features (modules/ai) fail with a clear error at request
  // time when this is absent, rather than blocking app startup.
  ANTHROPIC_API_KEY: z.string().optional(),
  // Optional: Telegram integration (modules/telegram) is disabled with a
  // clear message when absent, rather than blocking app startup.
  TELEGRAM_BOT_TOKEN: z.string().optional(),
  TELEGRAM_WEBHOOK_SECRET: z.string().optional(),
  // Base URL Telegram's setWebhook is told to call back on. Defaults to
  // localhost, which Telegram cannot actually reach — fine for local dev
  // where the webhook path is exercised directly in tests instead.
  API_PUBLIC_URL: z.string().default('http://localhost:3001'),
  // Optional: "Sign in with Google". Without both, the button is hidden and the endpoints answer 404.
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  // Optional: outgoing email (password reset, verification, invitations).
  // Without SMTP_HOST the API logs the message instead of sending it.
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_SECURE: z.enum(['true', 'false']).default('false'),
  MAIL_FROM: z.string().default('PMTool <no-reply@localhost>'),
  // Base URL of the web app, used to build the links inside emails.
  WEB_PUBLIC_URL: z.string().default('http://localhost:3000'),
  // When "true", unverified accounts cannot use the AI assistant or send
  // invitations (the abuse/cost vectors). Enable once SMTP is configured.
  EMAIL_VERIFICATION_REQUIRED: z.enum(['true', 'false']).default('false'),
  // Abuse controls for the free tier. RATE_LIMIT_ENABLED=false turns the
  // per-route limits off (integration tests register dozens of users from one IP).
  RATE_LIMIT_ENABLED: z.enum(['true', 'false']).default('true'),
  // Number of reverse proxies in front of the API, so `req.ip` is the real client.
  TRUST_PROXY: z.coerce.number().int().min(0).default(0),
  // Cost caps: AI calls per organization per (Vietnam) day, organizations one user may own.
  AI_DAILY_LIMIT_PER_ORG: z.coerce.number().int().min(0).default(100),
  MAX_ORGS_PER_USER: z.coerce.number().int().min(1).default(5),
});

export type EnvConfig = z.infer<typeof envSchema>;

export function validateEnv(config: Record<string, unknown>): EnvConfig {
  const parsed = envSchema.safeParse(config);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  return parsed.data;
}
