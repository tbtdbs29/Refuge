import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..', '..');

// Minimal .env loader so the app runs without an extra dependency.
function loadDotEnv() {
  const file = path.join(ROOT, '.env');
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!match || process.env[match[1]] !== undefined) continue;
    process.env[match[1]] = match[2].replace(/^["']|["']$/g, '');
  }
}

loadDotEnv();

// Vercel storage integrations may prefix variable names (e.g. STORAGE_TURSO_DATABASE_URL).
function envBySuffix(suffix) {
  if (process.env[suffix]) return { name: suffix, value: process.env[suffix] };
  const name = Object.keys(process.env).find((key) => key.endsWith(`_${suffix}`) && process.env[key]);
  return name ? { name, value: process.env[name] } : { name: '', value: '' };
}

const turso = envBySuffix('TURSO_DATABASE_URL');
const tursoToken = turso.name ? process.env[turso.name.replace(/TURSO_DATABASE_URL$/, 'TURSO_AUTH_TOKEN')] || '' : '';

const env = process.env.NODE_ENV || 'development';
const isProduction = env === 'production';

const sessionSecret = process.env.SESSION_SECRET || (isProduction ? '' : 'dev-only-insecure-secret');
if (!sessionSecret) {
  throw new Error('SESSION_SECRET must be set in production');
}

// On Vercel the file system is read-only: without Turso nothing could be saved.
if (process.env.VERCEL && !turso.value) {
  throw new Error('TURSO_DATABASE_URL is not set for this Vercel environment: connect the Turso database to it and redeploy');
}

export const config = {
  root: ROOT,
  env,
  isProduction,
  isTest: env === 'test',
  port: Number(process.env.PORT) || 3000,
  // Number of reverse proxies in front of the app. The client IP (used by rate limits) is read
  // from X-Forwarded-For only through that many hops; use 0 when the app is exposed directly.
  trustProxy: process.env.TRUST_PROXY === undefined ? 1 : Number(process.env.TRUST_PROXY) || 0,
  // On Vercel the production domain is known even when BASE_URL is not set.
  baseUrl: (
    process.env.BASE_URL ||
    (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : 'http://localhost:3000')
  ).replace(/\/$/, ''),
  sessionSecret,
  // Turso in production (TURSO_DATABASE_URL + TURSO_AUTH_TOKEN), a local SQLite file otherwise.
  databaseUrl: turso.value || `file:${path.resolve(ROOT, process.env.DATABASE_PATH || './data/refuge.sqlite')}`,
  databaseAuthToken: tursoToken,
  uploadDir: path.resolve(ROOT, process.env.UPLOAD_DIR || './data/uploads'),
  // Vercel Blob stores photos in production; without a token they are written to uploadDir.
  blobToken: envBySuffix('BLOB_READ_WRITE_TOKEN').value,
  maxUploadBytes: 12 * 1024 * 1024,
  smtp: {
    host: process.env.SMTP_HOST || '',
    port: Number(process.env.SMTP_PORT) || 587,
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    from: process.env.SMTP_FROM || '',
    notify: process.env.NOTIFY_EMAIL || '',
  },
};
