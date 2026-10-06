import { messageStatusSchema, validate } from '../../schemas/index.js';
import { messageService } from '../../services/messageService.js';
import { idParam } from './helpers.js';

export function list(req, res) {
  const status = ['nouveau', 'traite', 'archive'].includes(req.query.statut) ? req.query.statut : 'nouveau';
  res.render('admin/messages/list.njk', { messages: messageService.list(status), status, counts: messageService.counts() });
}

export function show(req, res) {
  res.render('admin/messages/show.njk', { message: messageService.getById(idParam(req)) });
}

export function setStatus(req, res) {
  const id = idParam(req);
  const { status } = validate(messageStatusSchema, req.body);
  messageService.setStatus(id, status);
  req.flash('success', status === 'traite' ? 'Message marqué comme traité.' : status === 'archive' ? 'Message archivé.' : 'Message remis dans les nouveaux.');
  res.redirect(303, status === 'nouveau' ? `/admin/messages/${id}` : '/admin/messages');
}

export function remove(req, res) {
  messageService.delete(idParam(req));
  req.flash('success', 'Message supprimé.');
  res.redirect(303, '/admin/messages');
}
