import { db } from '../db/index.js';

export const messageRepository = {
  findById(id) {
    return db.get(
      'SELECT m.*, a.name AS animal_name, a.slug AS animal_slug FROM messages m LEFT JOIN animals a ON a.id = m.animal_id WHERE m.id = ?',
      [id],
    );
  },

  list({ status, limit = 100 } = {}) {
    const params = [];
    let where = '';
    if (status) {
      where = 'WHERE m.status = ?';
      params.push(status);
    }
    return db.all(
      `SELECT m.*, a.name AS animal_name FROM messages m LEFT JOIN animals a ON a.id = m.animal_id ${where} ORDER BY m.created_at DESC, m.id DESC LIMIT ?`,
      [...params, limit],
    );
  },

  async countByStatus() {
    const rows = await db.all('SELECT status, COUNT(*) AS total FROM messages GROUP BY status');
    return Object.fromEntries(rows.map((row) => [row.status, row.total]));
  },

  async create({ topic, name, email, phone, animal_id, home, body }) {
    const result = await db.run('INSERT INTO messages (topic, name, email, phone, animal_id, home, body) VALUES (?, ?, ?, ?, ?, ?, ?)', [
      topic,
      name,
      email,
      phone ?? '',
      animal_id ?? null,
      home ?? '',
      body,
    ]);
    return result.lastInsertRowid;
  },

  async setStatus(id, status) {
    await db.run('UPDATE messages SET status = ? WHERE id = ?', [status, id]);
  },

  async delete(id) {
    await db.run('DELETE FROM messages WHERE id = ?', [id]);
  },
};
