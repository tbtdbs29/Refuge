import { getDb } from '../db/index.js';

const COLUMNS = ['title', 'description', 'location', 'category', 'starts_at', 'ends_at', 'all_day', 'visibility', 'example'];

export const eventRepository = {
  findById(id) {
    return getDb().prepare('SELECT * FROM events WHERE id = ?').get(id);
  },

  /** Events overlapping [from, to). Dates are wall-clock strings, compared lexically. */
  between(from, to, { publicOnly = false } = {}) {
    return getDb()
      .prepare(
        `SELECT * FROM events
         WHERE starts_at < ? AND COALESCE(ends_at, starts_at) >= ?
         ${publicOnly ? "AND visibility = 'public'" : ''}
         ORDER BY starts_at`,
      )
      .all(to, from);
  },

  upcoming(from, { limit = 5, publicOnly = false } = {}) {
    return getDb()
      .prepare(
        `SELECT * FROM events
         WHERE COALESCE(ends_at, starts_at) >= ?
         ${publicOnly ? "AND visibility = 'public'" : ''}
         ORDER BY starts_at LIMIT ?`,
      )
      .all(from, limit);
  },

  create(data) {
    const result = getDb()
      .prepare(`INSERT INTO events (${COLUMNS.join(', ')}) VALUES (${COLUMNS.map(() => '?').join(', ')})`)
      .run(...COLUMNS.map((column) => data[column] ?? null));
    return Number(result.lastInsertRowid);
  },

  update(id, data) {
    getDb()
      .prepare(`UPDATE events SET ${COLUMNS.map((column) => `${column} = ?`).join(', ')}, updated_at = datetime('now') WHERE id = ?`)
      .run(...COLUMNS.map((column) => data[column] ?? null), id);
  },

  delete(id) {
    getDb().prepare('DELETE FROM events WHERE id = ?').run(id);
  },
};
