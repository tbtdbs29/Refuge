import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';

export function notFound(req, res) {
  res.status(404).render(req.path.startsWith('/admin') && req.user ? 'admin/error.njk' : 'public/error.njk', {
    status: 404,
    title: 'Page introuvable',
    message: 'Cette page a filé comme un chat par la fenêtre.',
  });
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(error, req, res, next) {
  const status = error.status || 500;
  if (status >= 500) {
    logger.error('request.failed', { method: req.method, path: req.path, error: error.message, stack: config.isProduction ? undefined : error.stack });
  }
  const message = status >= 500 ? 'Une erreur est survenue de notre côté. Réessayez dans un instant.' : error.message;
  if (req.accepts(['html', 'json']) === 'json') {
    return res.status(status).json({ error: { code: error.code || 'INTERNAL_ERROR', message, details: error.details } });
  }
  const view = req.path.startsWith('/admin') && req.user ? 'admin/error.njk' : 'public/error.njk';
  const title = status === 404 ? 'Page introuvable' : status === 403 ? 'Accès refusé' : 'Oups';
  res.status(status).render(view, { status, title, message }, (renderError, html) => {
    if (renderError) {
      logger.error('error_page.render_failed', { error: renderError.message });
      return res.type('text/plain').send(message);
    }
    res.send(html);
  });
}
