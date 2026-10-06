import { getDb } from '../db/index.js';

export const messageRepository = {
  findById(id) {
    return getDb()
      .prepare('SELECT m.*, a.name AS animal_name, a.slug AS animal_slug FROM messages m LEFT JOIN animals a ON a.id = m.animal_id WHERE m.id = ?')
      .get(id);
  },

  list({ status, limit = 100 } = {}) {
    const params = [];
    let where = '';
    if (status) {
      where = 'WHERE m.status = ?';
      params.push(status);
    }
    return getDb()
      .prepare(`SELECT m.*, a.name AS animal_name FROM messages m LEFT JOIN animals a ON a.id = m.animal_id ${where} ORDER BY m.created_at DESC, m.id DESC LIMIT ?`)
      .all(...params, limit);
  },

  countByStatus() {
    const rows = getDb().prepare('SELECT status, COUNT(*) AS total FROM messages GROUP BY status').all();
    return Object.fromEntries(rows.map((row) => [row.status, row.total]));
  },

  create({ topic, name, email, phone, animal_id, home, body }) {
    const result = getDb()
      .prepare('INSERT INTO messages (topic, name, email, phone, animal_id, home, body) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(topic, name, email, phone ?? '', animal_id ?? null, home ?? '', body);
    return Number(result.lastInsertRowid);
  },

  setStatus(id, status) {
    getDb().prepare('UPDATE messages SET status = ? WHERE id = ?').run(status, id);
  },

  delete(id) {
    getDb().prepare('DELETE FROM messages WHERE id = ?').run(id);
  },
};
