const { z } = require('zod');

const stripMarkup = (value) => value
  .replace(/<[^>]*>/g, '')
  .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
  .trim();

const sanitize = (value) => {
  if (typeof value === 'string') return stripMarkup(value);
  if (Array.isArray(value)) return value.map(sanitize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, sanitize(item)]));
  }
  return value;
};

const formatIssues = (error) => (error.issues || []).map((issue) => ({
  field: issue.path.length ? issue.path.join('.') : 'request',
  message: issue.message,
  code: issue.code
}));

const validate = (schema, source = 'body') => (req, res, next) => {
  const parsed = schema.safeParse(sanitize(req[source] || {}));
  if (!parsed.success) {
    return res.status(400).json({ message: 'Validation failed', errors: formatIssues(parsed.error) });
  }
  req[source] = parsed.data;
  next();
};

const urlString = z.string().trim().url().refine((value) => /^https?:\/\//i.test(value), 'Only HTTP(S) URLs are allowed');
const optionalUrl = urlString.or(z.literal('')).optional().nullable();
const dateSchema = z.string().refine((val) => !val || !isNaN(Date.parse(val)), 'Invalid date format').optional().nullable();
const customAliasSchema = z.string().trim().min(3).max(30).regex(/^[a-zA-Z0-9_-]+$/, 'Alphanumeric, underscores, and dashes only').or(z.literal('')).optional().nullable();
const objectOptions = { strip: true };

const registerSchema = z.object({ email: z.string().trim().email().max(254), password: z.string().min(6).max(100) }, objectOptions);
const loginSchema = z.object({ email: z.string().trim().email().max(254), password: z.string().min(1).max(100) }, objectOptions);
const unlockSchema = z.object({ password: z.string().min(1).max(100) }, objectOptions);
const passwordResetRequestSchema = z.object({ email: z.string().trim().email().max(254) }, objectOptions);
const passwordResetSchema = z.object({ token: z.string().length(64).regex(/^[a-f0-9]+$/), password: z.string().min(6).max(100) }, objectOptions);
const aiAnalyzeSchema = z.object({ longUrl: urlString }, objectOptions);

const targetSchema = z.object({ url: urlString, weight: z.number().int().min(0).max(100) }, objectOptions);
const geoTargetSchema = z.object({ country: z.string().trim().regex(/^[A-Za-z]{2}$/), url: urlString }, objectOptions);
const urlFields = {
  longUrl: urlString,
  customAlias: customAliasSchema,
  password: z.string().min(4).max(50).or(z.literal('')).optional().nullable(),
  expiresAt: dateSchema,
  ogTitle: z.string().max(100).optional().nullable(),
  ogDescription: z.string().max(200).optional().nullable(),
  ogImage: optionalUrl,
  iphoneUrl: optionalUrl,
  androidUrl: optionalUrl,
  webhookUrl: optionalUrl,
  maxClicks: z.number().int().positive().optional().nullable(),
  fallbackUrl: optionalUrl,
  abTestTargets: z.array(targetSchema).max(10).optional().nullable(),
  splashMessage: z.string().max(200).optional().nullable(),
  splashDelay: z.number().int().min(1).max(30).optional().nullable(),
  isOneTime: z.boolean().optional().nullable(),
  geoTargets: z.array(geoTargetSchema).max(50).optional().nullable(),
  deepLinkScheme: z.string().max(250).regex(/^[a-z][a-z0-9+.-]*:\/\//i).optional().nullable(),
  aiSummary: z.string().max(1000).optional().nullable(),
  aiSafetyScore: z.number().min(0).max(100).optional().nullable(),
  aiTags: z.array(z.string().max(50)).max(20).optional().nullable()
};
const shortenSchema = z.object(urlFields, objectOptions);
const editUrlSchema = z.object({ ...urlFields, longUrl: urlString.optional(), customAlias: undefined }).partial().extend({ customAlias: z.never().optional() });
const bulkSchema = z.object({ links: z.array(z.object({ longUrl: urlString, customAlias: customAliasSchema }, objectOptions)).min(1).max(20) }, objectOptions);
const bioSchema = z.object({
  slug: z.string().trim().min(3).max(50).regex(/^[a-z0-9-]+$/i), title: z.string().trim().min(1).max(120),
  bio: z.string().max(2000).optional(), avatarUrl: optionalUrl, theme: z.string().max(40).optional(),
  socialLinks: z.record(z.string().max(500)).optional(), links: z.array(z.object({ title: z.string().max(100), url: urlString, clicks: z.number().int().min(0).optional() }, objectOptions)).max(50).optional()
}, objectOptions);
const bioUpdateSchema = bioSchema.partial();
const objectIdSchema = z.object({ id: z.string().regex(/^[a-f\d]{24}$/i, 'Invalid resource id') }, objectOptions);
const avatarUploadParamsSchema = objectIdSchema;
const codeSchema = z.object({ code: z.string().trim().min(3).max(100).regex(/^[a-zA-Z0-9_-]+$/) }, objectOptions);
const bioPublicParamsSchema = z.object({ slug: z.string().trim().min(3).max(50).regex(/^[a-z0-9-]+$/i) }, objectOptions);
const bioLinkParamsSchema = bioPublicParamsSchema.extend({ linkId: z.string().regex(/^[a-f\d]{24}$/i, 'Invalid link id') });
const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(100000).default(1), limit: z.coerce.number().int().min(1).max(100).default(10),
  search: z.string().max(200).optional().default(''), sortBy: z.enum(['createdAt', 'clicks', 'shortCode', 'longUrl']).default('createdAt'), order: z.enum(['asc', 'desc']).default('desc')
}, objectOptions);
const otpSchema = z.object({ email: z.string().email(), otp: z.string().length(6) }, objectOptions);

module.exports = {
  sanitize, validate, registerSchema, loginSchema, unlockSchema, passwordResetRequestSchema, passwordResetSchema, aiAnalyzeSchema, shortenSchema, editUrlSchema,
  bulkSchema, bioSchema, bioUpdateSchema, objectIdSchema, codeSchema, bioPublicParamsSchema,
  bioLinkParamsSchema, avatarUploadParamsSchema, listQuerySchema, otpSchema
};
