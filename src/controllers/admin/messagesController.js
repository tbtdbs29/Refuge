import { messageStatusSchema, validate } from '../../schemas/index.js';
import { messageService } from '../../services/messageService.js';
import { idParam } from './helpers.js';

export async function list(req, res) {
  const status = ['nouveau', 'traite', 'archive'].includes(req.query.statut) ? req.query.statut : 'nouveau';
  const [messages, counts] = await Promise.all([messageService.list(status), messageService.counts()]);
  res.render('admin/messages/list.njk', { messages, status, counts });
}

export async function show(req, res) {
  res.render('admin/messages/show.njk', { message: await messageService.getById(idParam(req)) });
}

export async function setStatus(req, res) {
  const id = idParam(req);
  const { status } = validate(messageStatusSchema, req.body);
  await messageService.setStatus(id, status);
  req.flash('success', status === 'traite' ? 'Message marqué comme traité.' : status === 'archive' ? 'Message archivé.' : 'Message remis dans les nouveaux.');
  res.redirect(303, status === 'nouveau' ? `/admin/messages/${id}` : '/admin/messages');
}

export async function remove(req, res) {
  await messageService.delete(idParam(req));
  req.flash('success', 'Message supprimé.');
  res.redirect(303, '/admin/messages');
}
