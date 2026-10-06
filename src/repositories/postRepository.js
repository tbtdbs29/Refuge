import { db } from '../db/index.js';

const COLUMNS = ['slug', 'title', 'category', 'excerpt', 'body', 'cover', 'published', 'published_at', 'example'];

function filters({ publishedBefore, category }) {
  const where = [];
  const params = [];
  if (publishedBefore) {
    where.push('published = 1 AND published_at <= ?');
    params.push(publishedBefore);
  }
  if (category) {
    where.push('category = ?');
    params.push(category);
  }
  return { clause: where.length ? `WHERE ${where.join(' AND ')}` : '', params };
}

export const postRepository = {
  findById(id) {
    return db.get('SELECT * FROM posts WHERE id = ?', [id]);
  },

  findBySlug(slug) {
    return db.get('SELECT * FROM posts WHERE slug = ?', [slug]);
  },

  async slugExists(slug, exceptId = 0) {
    return Boolean(await db.get('SELECT 1 AS found FROM posts WHERE slug = ? AND id != ?', [slug, exceptId]));
  },

  /** publishedBefore: wall-clock string; only published posts dated before it are returned. */
  list({ publishedBefore, category, limit = 50, offset = 0 } = {}) {
    const { clause, params } = filters({ publishedBefore, category });
    return db.all(`SELECT * FROM posts ${clause} ORDER BY published_at DESC, id DESC LIMIT ? OFFSET ?`, [...params, limit, offset]);
  },

  async count({ publishedBefore, category } = {}) {
    const { clause, params } = filters({ publishedBefore, category });
    return (await db.get(`SELECT COUNT(*) AS total FROM posts ${clause}`, params)).total;
  },

  async create(data) {
    const columns = COLUMNS.filter((column) => data[column] !== undefined);
    const result = await db.run(
      `INSERT INTO posts (${columns.join(', ')}) VALUES (${columns.map(() => '?').join(', ')})`,
      columns.map((column) => data[column]),
    );
    return result.lastInsertRowid;
  },

  async update(id, data) {
    const columns = COLUMNS.filter((column) => data[column] !== undefined);
    await db.run(
      `UPDATE posts SET ${columns.map((column) => `${column} = ?`).join(', ')}, updated_at = datetime('now') WHERE id = ?`,
      [...columns.map((column) => data[column]), id],
    );
  },

  async delete(id) {
    await db.run('DELETE FROM posts WHERE id = ?', [id]);
  },
};
