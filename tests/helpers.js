// Shared test setup: each test file gets its own temporary database and upload directory.
// Environment variables must be set BEFORE the app/config modules are imported.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

let ipCounter = 0;

/** A distinct client IP per agent so in-memory rate limiters do not bleed between tests. */
export function uniqueIp() {
  ipCounter += 1;
  return `10.${(ipCounter >> 16) & 255}.${(ipCounter >> 8) & 255}.${ipCounter & 255}`;
}

export async function setupTestEnv(label) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `refuge-test-${label}-`));
  process.env.NODE_ENV = 'test';
  process.env.DATABASE_PATH = path.join(dir, 'test.sqlite');
  process.env.UPLOAD_DIR = path.join(dir, 'uploads');
  process.env.BASE_URL = 'http://refuge.test';
  process.env.SMTP_HOST = '';
  process.env.NOTIFY_EMAIL = '';
  process.env.SESSION_SECRET = 'test-secret-for-automated-tests';
  // Never reach remote services from tests: local SQLite file and local upload directory only.
  process.env.TURSO_DATABASE_URL = '';
  process.env.TURSO_AUTH_TOKEN = '';
  process.env.BLOB_READ_WRITE_TOKEN = '';
  // Tests give each agent its own X-Forwarded-For so rate limiters stay per test.
  process.env.TRUST_PROXY = '1';

  const { default: supertest } = await import('supertest');
  const { createApp } = await import('../src/app.js');
  const db = await import('../src/db/index.js');
  const { userService } = await import('../src/services/userService.js');
  const { animalService } = await import('../src/services/animalService.js');
  const { eventService } = await import('../src/services/eventService.js');
  const { postService } = await import('../src/services/postService.js');
  const { messageService } = await import('../src/services/messageService.js');
  const { settingsService } = await import('../src/services/settingsService.js');
  const { config } = await import('../src/config/index.js');
  const format = await import('../src/utils/format.js');

  await db.ensureDb();
  const app = createApp();

  const newAgent = () => {
    const agent = supertest.agent(app);
    agent.set('X-Forwarded-For', uniqueIp());
    return agent;
  };

  function cleanup() {
    db.closeDb();
    fs.rmSync(dir, { recursive: true, force: true });
  }

  return {
    dir,
    app,
    config,
    db,
    request: () => supertest(app),
    newAgent,
    services: { userService, animalService, eventService, postService, messageService, settingsService },
    format,
    cleanup,
  };
}

/** Extracts the CSRF token from an HTML page. */
export function extractCsrf(html) {
  const match = /name="_csrf" value="([^"]+)"/.exec(html) || /\?_csrf=([A-Za-z0-9_-]+)/.exec(html);
  if (!match) throw new Error('No CSRF token found in page');
  return match[1];
}

/** GETs a page with the agent and returns its CSRF token. */
export async function csrfFrom(agent, url = '/contact') {
  const res = await agent.get(url);
  return extractCsrf(res.text);
}

/** Logs an agent in and returns a fresh CSRF token valid for the authenticated session. */
export async function login(agent, email, password) {
  const token = await csrfFrom(agent, '/admin/connexion');
  const res = await agent.post('/admin/connexion').type('form').send({ _csrf: token, email, password });
  if (res.status !== 303) throw new Error(`Login failed for ${email}: ${res.status}`);
  return csrfFrom(agent, '/admin/mon-compte');
}

/** Decodes the HTML entities nunjucks autoescape produces, for readable assertions. */
export function decode(html) {
  return html
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

export async function jpegBuffer(width = 50, height = 50) {
  const { default: sharp } = await import('sharp');
  return sharp({ create: { width, height, channels: 3, background: '#888' } }).jpeg().toBuffer();
}

/** Wall-clock "YYYY-MM-DDTHH:MM" shifted by a number of days from now (Paris time). */
export function wallClockInDays(format, days) {
  return format.nowWallClock(new Date(Date.now() + days * 24 * 3600 * 1000));
}

export const ADMIN = { name: 'Alice Admin', email: 'admin@refuge.test', password: 'motdepasse-admin-123', role: 'admin' };
export const EDITOR = { name: 'Eric Editeur', email: 'editor@refuge.test', password: 'motdepasse-editor-123', role: 'editor' };
