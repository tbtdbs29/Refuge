import { userService } from '../services/userService.js';
import { ForbiddenError } from '../utils/errors.js';

export function loadUser(req, res, next) {
  const id = req.session?.userId;
  req.user = id ? userService.findById(id) : null;
  if (id && !req.user) req.session.userId = null;
  res.locals.currentUser = req.user;
  next();
}

export function requireAuth(req, res, next) {
  if (req.user) return next();
  const target = req.method === 'GET' ? req.originalUrl : '/admin';
  res.redirect(`/admin/connexion?suite=${encodeURIComponent(target)}`);
}

export function requireAdmin(req, res, next) {
  if (req.user?.role === 'admin') return next();
  next(new ForbiddenError('Cette page est réservée aux administrateurs.'));
}
