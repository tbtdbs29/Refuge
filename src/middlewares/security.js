import crypto from 'node:crypto';
import { AppError } from '../utils/errors.js';

/** Ensures the session carries a CSRF token and exposes it to views. */
export function csrfToken(req, res, next) {
  if (!req.session.csrf) req.session.csrf = crypto.randomBytes(24).toString('base64url');
  res.locals.csrfToken = req.session.csrf;
  next();
}

/**
 * Rejects state-changing requests whose token does not match the session.
 * Multipart forms pass the token in the query string so it is checked before files are parsed.
 */
export function verifyCsrf(req, res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  const sent = req.body?._csrf || req.query._csrf || req.get('x-csrf-token') || '';
  const expected = req.session?.csrf || '';
  const valid = sent.length === expected.length && expected.length > 0 && crypto.timingSafeEqual(Buffer.from(sent), Buffer.from(expected));
  if (!valid) return next(new AppError('Le formulaire a expiré. Rechargez la page et réessayez.', { status: 403, code: 'CSRF' }));
  next();
}

/** Small in-memory fixed-window limiter, enough for a single-process deployment. */
export function rateLimit({ windowMs, max, message }) {
  const hits = new Map();
  return (req, res, next) => {
    if (req.method !== 'POST') return next();
    const now = Date.now();
    const key = req.ip;
    const entry = hits.get(key);
    if (!entry || entry.reset < now) {
      hits.set(key, { count: 1, reset: now + windowMs });
    } else {
      entry.count += 1;
      if (entry.count > max) return next(new AppError(message, { status: 429, code: 'RATE_LIMITED' }));
    }
    if (hits.size > 5000) {
      for (const [ip, value] of hits) if (value.reset < now) hits.delete(ip);
    }
    next();
  };
}
