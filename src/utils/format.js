// Event times and birth dates are stored as wall-clock strings ("YYYY-MM-DDTHH:MM").
// They are parsed as UTC and formatted in UTC so the server time zone never shifts them.
// Technical timestamps (created_at) are real UTC instants, shown in Paris time.
const WALL = 'UTC';
const PARIS = 'Europe/Paris';

const dateFmt = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: WALL });
const shortDateFmt = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', timeZone: WALL });
const weekdayFmt = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: WALL });
const timeFmt = new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: WALL });
const monthFmt = new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric', timeZone: WALL });
const stampFmt = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: PARIS });

export function toDate(value) {
  if (!value) return null;
  if (value instanceof Date) return value;
  const text = String(value).trim().replace(' ', 'T');
  const iso = /^\d{4}-\d{2}-\d{2}$/.test(text) ? `${text}T00:00:00Z` : /[zZ]|[+-]\d{2}:\d{2}$/.test(text) ? text : `${text}Z`;
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Current Paris wall-clock time as "YYYY-MM-DDTHH:MM". */
export function nowWallClock(now = new Date()) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', { timeZone: PARIS, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
      .formatToParts(now)
      .map((part) => [part.type, part.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

export function formatStamp(value) {
  const date = toDate(value);
  return date ? stampFmt.format(date) : '';
}

export function formatDate(value) {
  const date = toDate(value);
  return date ? dateFmt.format(date) : '';
}

export function formatShortDate(value) {
  const date = toDate(value);
  return date ? shortDateFmt.format(date) : '';
}

export function formatWeekday(value) {
  const date = toDate(value);
  return date ? weekdayFmt.format(date) : '';
}

export function formatTime(value) {
  const date = toDate(value);
  return date ? timeFmt.format(date).replace(':', 'h') : '';
}

export function formatMonth(year, month) {
  const label = monthFmt.format(new Date(Date.UTC(year, month - 1, 1)));
  return label.charAt(0).toUpperCase() + label.slice(1);
}

/** Human age from a birth date, e.g. "3 ans", "5 mois". */
export function ageFromBirthDate(birthDate, now = new Date()) {
  const birth = toDate(birthDate);
  if (!birth) return '';
  let months = (now.getUTCFullYear() - birth.getUTCFullYear()) * 12 + (now.getUTCMonth() - birth.getUTCMonth());
  if (now.getUTCDate() < birth.getUTCDate()) months -= 1;
  if (months < 0) return '';
  if (months < 1) return 'Quelques semaines';
  if (months < 24) return `${months} mois`;
  const years = Math.floor(months / 12);
  return years === 1 ? '1 an' : `${years} ans`;
}

export function ageInYears(birthDate, now = new Date()) {
  const birth = toDate(birthDate);
  if (!birth) return null;
  return (now - birth) / (365.25 * 24 * 3600 * 1000);
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Converts plain text typed by volunteers into safe HTML:
 * blank lines make paragraphs, "- " lines make lists, **text** is bold, URLs become links.
 */
export function textToHtml(text) {
  if (!text) return '';
  const inline = (line) =>
    escapeHtml(line)
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/(https?:\/\/[^\s<]+[^\s<.,;:!?)])/g, '<a href="$1" rel="noopener" target="_blank">$1</a>');
  return String(text)
    .replace(/\r\n/g, '\n')
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => {
      const lines = block.split('\n');
      if (lines.every((line) => /^\s*[-•]\s+/.test(line))) {
        return `<ul>${lines.map((line) => `<li>${inline(line.replace(/^\s*[-•]\s+/, ''))}</li>`).join('')}</ul>`;
      }
      return `<p>${lines.map(inline).join('<br>')}</p>`;
    })
    .join('\n');
}

export function excerpt(text, length = 180) {
  const plain = String(text || '').replace(/\*\*/g, '').replace(/\s+/g, ' ').trim();
  if (plain.length <= length) return plain;
  return `${plain.slice(0, length).replace(/\s+\S*$/, '')}…`;
}
