import { config } from '../config/index.js';
import { EVENT_CATEGORIES } from '../config/labels.js';
import { eventRepository } from '../repositories/eventRepository.js';
import { NotFoundError } from '../utils/errors.js';
import { formatMonth, formatTime, formatWeekday, nowWallClock, textToHtml } from '../utils/format.js';
import { logger } from '../utils/logger.js';

const pad = (value) => String(value).padStart(2, '0');
const dayKey = (year, month, day) => `${year}-${pad(month)}-${pad(day)}`;

function decorate(event) {
  const startDay = event.starts_at.slice(0, 10);
  const endDay = (event.ends_at || event.starts_at).slice(0, 10);
  return {
    ...event,
    categoryLabel: EVENT_CATEGORIES[event.category],
    startDay,
    endDay,
    multiDay: endDay !== startDay,
    dateLabel: formatWeekday(event.starts_at),
    endDateLabel: endDay !== startDay ? formatWeekday(event.ends_at) : '',
    timeLabel: event.all_day ? 'Toute la journée' : [formatTime(event.starts_at), event.ends_at ? formatTime(event.ends_at) : ''].filter(Boolean).join(' – '),
    descriptionHtml: textToHtml(event.description),
    day: Number(startDay.slice(8, 10)),
    monthShort: new Intl.DateTimeFormat('fr-FR', { month: 'short', timeZone: 'UTC' }).format(new Date(`${startDay}T00:00:00Z`)).replace('.', ''),
  };
}

function clampMonth(year, month) {
  const now = nowWallClock();
  const y = Number.isInteger(year) && year > 2000 && year < 2200 ? year : Number(now.slice(0, 4));
  const m = Number.isInteger(month) && month >= 1 && month <= 12 ? month : Number(now.slice(5, 7));
  return { year: y, month: m };
}

function shiftMonth(year, month, delta) {
  const index = year * 12 + (month - 1) + delta;
  return { year: Math.floor(index / 12), month: (index % 12) + 1 };
}

function icsEscape(text) {
  return String(text || '').replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/[,;]/g, (match) => `\\${match}`);
}

function icsDate(value) {
  return value.replace(/[-:]/g, '').slice(0, 13) + '00';
}

export const eventService = {
  /** Month view: weeks starting on Monday, each day carrying its events. */
  month(yearInput, monthInput, { publicOnly = false } = {}) {
    const { year, month } = clampMonth(yearInput, monthInput);
    const first = new Date(Date.UTC(year, month - 1, 1));
    const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const leading = (first.getUTCDay() + 6) % 7;
    const next = shiftMonth(year, month, 1);
    const events = eventRepository
      .between(`${dayKey(year, month, 1)}T00:00`, `${dayKey(next.year, next.month, 1)}T00:00`, { publicOnly })
      .map(decorate);
    const today = nowWallClock().slice(0, 10);

    const cells = [];
    for (let i = 0; i < leading; i += 1) cells.push(null);
    for (let day = 1; day <= daysInMonth; day += 1) {
      const key = dayKey(year, month, day);
      cells.push({
        day,
        key,
        isToday: key === today,
        isPast: key < today,
        events: events.filter((event) => event.startDay <= key && event.endDay >= key),
      });
    }
    while (cells.length % 7) cells.push(null);
    const weeks = [];
    for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));

    return {
      year,
      month,
      label: formatMonth(year, month),
      weeks,
      events,
      prev: shiftMonth(year, month, -1),
      next,
    };
  },

  upcoming(limit = 4, { publicOnly = true } = {}) {
    return eventRepository.upcoming(nowWallClock(), { limit, publicOnly }).map(decorate);
  },

  getById(id, { publicOnly = false } = {}) {
    const event = eventRepository.findById(id);
    if (!event || (publicOnly && event.visibility !== 'public')) throw new NotFoundError('Événement introuvable.');
    return decorate(event);
  },

  create(data) {
    const id = eventRepository.create({ example: 0, ...data });
    logger.info('event.created', { id });
    return id;
  },

  update(id, data) {
    this.getById(id);
    eventRepository.update(id, { ...data, example: 0 });
    logger.info('event.updated', { id });
  },

  delete(id) {
    this.getById(id);
    eventRepository.delete(id);
    logger.info('event.deleted', { id });
  },

  /** iCalendar export for one event or a list. Times are Paris wall-clock times. */
  toIcs(events) {
    const host = new URL(config.baseUrl).hostname;
    const stamp = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z';
    const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Refuge de Landerneau//Agenda//FR', 'CALSCALE:GREGORIAN', 'X-WR-CALNAME:Refuge de Landerneau'];
    for (const event of events) {
      lines.push('BEGIN:VEVENT', `UID:event-${event.id}@${host}`, `DTSTAMP:${stamp}`);
      if (event.all_day) {
        const end = new Date(`${event.endDay}T00:00:00Z`);
        end.setUTCDate(end.getUTCDate() + 1);
        lines.push(`DTSTART;VALUE=DATE:${event.startDay.replace(/-/g, '')}`, `DTEND;VALUE=DATE:${end.toISOString().slice(0, 10).replace(/-/g, '')}`);
      } else {
        lines.push(`DTSTART;TZID=Europe/Paris:${icsDate(event.starts_at)}`);
        if (event.ends_at) lines.push(`DTEND;TZID=Europe/Paris:${icsDate(event.ends_at)}`);
      }
      lines.push(`SUMMARY:${icsEscape(event.title)}`);
      if (event.location) lines.push(`LOCATION:${icsEscape(event.location)}`);
      if (event.description) lines.push(`DESCRIPTION:${icsEscape(event.description)}`);
      lines.push('END:VEVENT');
    }
    lines.push('END:VCALENDAR');
    return `${lines.join('\r\n')}\r\n`;
  },
};
