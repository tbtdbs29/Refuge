import { eventSchema, validate } from '../../schemas/index.js';
import { eventService } from '../../services/eventService.js';
import { formAction, idParam } from './helpers.js';
import { nowWallClock } from '../../utils/format.js';

function toFormValues(event) {
  return {
    ...event,
    start_date: event.starts_at.slice(0, 10),
    start_time: event.all_day ? '' : event.starts_at.slice(11, 16),
    end_date: event.ends_at && event.ends_at.slice(0, 10) !== event.starts_at.slice(0, 10) ? event.ends_at.slice(0, 10) : '',
    end_time: event.ends_at && !event.all_day ? event.ends_at.slice(11, 16) : '',
  };
}

export function calendar(req, res) {
  const match = /^(\d{4})-(\d{2})$/.exec(String(req.query.mois || ''));
  res.render('admin/events/calendar.njk', {
    month: eventService.month(match ? Number(match[1]) : undefined, match ? Number(match[2]) : undefined),
    upcoming: eventService.upcoming(10, { publicOnly: false }),
  });
}

function renderForm(req, res, { values, errors = {}, event = null }) {
  res.render('admin/events/form.njk', { values, errors, event });
}

export function newForm(req, res) {
  const date = /^\d{4}-\d{2}-\d{2}$/.test(String(req.query.date || '')) ? req.query.date : nowWallClock().slice(0, 10);
  renderForm(req, res, { values: { start_date: date, start_time: '10:00', end_time: '17:00', category: 'adoption', visibility: 'public' } });
}

export const create = formAction(
  (req, res) => {
    const data = validate(eventSchema, req.body);
    eventService.create(data);
    req.flash('success', 'Événement ajouté à l’agenda.');
    res.redirect(303, `/admin/agenda?mois=${data.starts_at.slice(0, 7)}`);
  },
  (req, res, state) => renderForm(req, res, state),
);

export function editForm(req, res) {
  const event = eventService.getById(idParam(req));
  renderForm(req, res, { values: toFormValues(event), event });
}

export const update = formAction(
  (req, res) => {
    const data = validate(eventSchema, req.body);
    eventService.update(idParam(req), data);
    req.flash('success', 'Événement mis à jour.');
    res.redirect(303, `/admin/agenda?mois=${data.starts_at.slice(0, 7)}`);
  },
  (req, res, state) => renderForm(req, res, { ...state, event: eventService.getById(idParam(req)) }),
);

export function remove(req, res) {
  const event = eventService.getById(idParam(req));
  eventService.delete(event.id);
  req.flash('success', 'Événement supprimé.');
  res.redirect(303, `/admin/agenda?mois=${event.starts_at.slice(0, 7)}`);
}
