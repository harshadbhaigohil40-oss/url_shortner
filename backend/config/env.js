const { z } = require('zod');

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(5000),
  MONGODB_URI: z.string().min(1),
  JWT_SECRET: z.string().min(32),
  CSRF_SECRET: z.string().min(32),
  CORS_ORIGIN: z.string().min(1),
  PUBLIC_API_URL: z.string().url().optional(),
  PRIVATE_FILE_BASE_URL: z.string().min(1).default('/api/bio/files'),
  TRUST_PROXY_HOPS: z.coerce.number().int().nonnegative().default(1),
  REDIS_URL: z.string().optional(),
  AWS_SECRET_ID: z.string().optional(),
  AWS_REGION: z.string().optional(),
  REQUIRE_UPLOAD_SCAN: z.enum(['true', 'false']).default('false'),
  UPLOAD_DIR: z.string().optional(),
  CLAMAV_SCANNER_URL: z.string().url().optional()
}).superRefine((config, context) => {
  const origins = config.CORS_ORIGIN.split(',').map((origin) => origin.trim()).filter(Boolean);
  if (origins.length === 0) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['CORS_ORIGIN'], message: 'At least one origin is required' });
  }
  if (config.NODE_ENV === 'production' && origins.includes('*')) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['CORS_ORIGIN'], message: 'Wildcard CORS is not allowed in production' });
  }
});

const loadEnv = (input = process.env) => {
  const parsed = envSchema.safeParse(input);
  if (!parsed.success) {
    const fields = parsed.error.issues.map((issue) => issue.path.join('.')).join(', ');
    throw new Error(`Invalid server configuration: ${fields}`);
  }
  return parsed.data;
};

module.exports = { loadEnv };
