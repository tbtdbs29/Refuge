import path from 'node:path';
import express from 'express';
import cookieSession from 'cookie-session';
import helmet from 'helmet';
import nunjucks from 'nunjucks';
import { config } from './config/index.js';
import * as labels from './config/labels.js';
import { loadUser } from './middlewares/auth.js';
import { errorHandler, notFound } from './middlewares/errorHandler.js';
import { flash } from './middlewares/flash.js';
import { csrfToken, verifyCsrf } from './middlewares/security.js';
import { health } from './controllers/public/healthController.js';
import { ensureDb } from './db/index.js';
import { adminRouter } from './routes/admin.js';
import { publicRouter } from './routes/public.js';
import { settingsService } from './services/settingsService.js';
import { formatDate, formatShortDate, formatStamp } from './utils/format.js';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', config.trustProxy);

  const env = nunjucks.configure(path.join(config.root, 'src', 'views'), {
    autoescape: true,
    express: app,
    noCache: !config.isProduction,
  });
  env.addFilter('date', formatDate);
  env.addFilter('shortdate', formatShortDate);
  env.addFilter('stamp', formatStamp);
  env.addFilter('pad', (value) => String(value).padStart(2, '0'));
  // Keeps "17 h 30", "230 €" or "11 ans" on one line.
  env.addFilter('nbsp', (value) =>
    String(value ?? '')
      .replace(/(\d)\s+(h|€|ans|mois)\b/g, '$1\u00a0$2')
      .replace(/(\d)\s+€/g, '$1\u00a0€')
      .replace(/\bh\s+(\d)/g, 'h\u00a0$1'));
  env.addFilter('tel', (value) => String(value || '').replace(/[^0-9+]/g, ''));
  env.addGlobal('labels', labels);
  env.addGlobal('year', new Date().getFullYear());
  app.set('view engine', 'njk');

  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          imgSrc: ["'self'", 'data:', 'blob:', 'https://*.public.blob.vercel-storage.com'],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          formAction: ["'self'"],
          frameAncestors: ["'none'"],
          upgradeInsecureRequests: config.isProduction ? [] : null,
        },
      },
      crossOriginEmbedderPolicy: false,
    }),
  );

  // In production the CDN may cache static assets (s-maxage); fonts are versioned by filename.
  const staticOptions = {
    maxAge: config.isProduction ? '7d' : 0,
    setHeaders: config.isProduction ? (res) => res.setHeader('Cache-Control', 'public, max-age=604800, s-maxage=604800') : undefined,
  };
  app.use(express.static(path.join(config.root, 'public'), staticOptions));
  app.use('/uploads', express.static(config.uploadDir, { maxAge: '30d', immutable: true }));

  // Diagnostics stay reachable even when the database cannot be opened.
  app.get('/sante', health);

  // The schema is created on first use (cold start); every dynamic request waits for it.
  app.use(async (req, res, next) => {
    await ensureDb();
    next();
  });

  app.use(express.urlencoded({ extended: false, limit: '200kb' }));
  app.use(
    cookieSession({
      name: 'refuge_session',
      keys: [config.sessionSecret],
      httpOnly: true,
      sameSite: 'lax',
      secure: config.isProduction,
      maxAge: 1000 * 60 * 60 * 24 * 14,
    }),
  );
  app.use(csrfToken);
  app.use(loadUser);
  app.use(flash);
  app.use(async (req, res, next) => {
    res.locals.settings = await settingsService.get();
    res.locals.path = req.path;
    res.locals.baseUrl = config.baseUrl;
    next();
  });
  app.use(verifyCsrf);

  app.use('/admin', adminRouter);
  app.use('/', publicRouter);

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
