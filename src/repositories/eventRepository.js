import { db } from '../db/index.js';

const COLUMNS = ['title', 'description', 'location', 'category', 'starts_at', 'ends_at', 'all_day', 'visibility', 'example'];

export const eventRepository = {
  findById(id) {
    return db.get('SELECT * FROM events WHERE id = ?', [id]);
  },

  /** Events overlapping [from, to). Dates are wall-clock strings, compared lexically. */
  between(from, to, { publicOnly = false } = {}) {
    return db.all(
      `SELECT * FROM events
       WHERE starts_at < ? AND COALESCE(ends_at, starts_at) >= ?
       ${publicOnly ? "AND visibility = 'public'" : ''}
       ORDER BY starts_at`,
      [to, from],
    );
  },

  upcoming(from, { limit = 5, publicOnly = false } = {}) {
    return db.all(
      `SELECT * FROM events
       WHERE COALESCE(ends_at, starts_at) >= ?
       ${publicOnly ? "AND visibility = 'public'" : ''}
       ORDER BY starts_at LIMIT ?`,
      [from, limit],
    );
  },

  async create(data) {
    const result = await db.run(
      `INSERT INTO events (${COLUMNS.join(', ')}) VALUES (${COLUMNS.map(() => '?').join(', ')})`,
      COLUMNS.map((column) => data[column] ?? (column === 'example' ? 0 : null)),
    );
    return result.lastInsertRowid;
  },

  async update(id, data) {
    await db.run(
      `UPDATE events SET ${COLUMNS.map((column) => `${column} = ?`).join(', ')}, updated_at = datetime('now') WHERE id = ?`,
      [...COLUMNS.map((column) => data[column] ?? (column === 'example' ? 0 : null)), id],
    );
  },

  async delete(id) {
    await db.run('DELETE FROM events WHERE id = ?', [id]);
  },
};
