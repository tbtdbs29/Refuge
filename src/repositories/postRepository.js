import { getDb } from '../db/index.js';

const COLUMNS = ['slug', 'title', 'category', 'excerpt', 'body', 'cover', 'published', 'published_at', 'example'];

export const postRepository = {
  findById(id) {
    return getDb().prepare('SELECT * FROM posts WHERE id = ?').get(id);
  },

  findBySlug(slug) {
    return getDb().prepare('SELECT * FROM posts WHERE slug = ?').get(slug);
  },

  slugExists(slug, exceptId = 0) {
    return Boolean(getDb().prepare('SELECT 1 FROM posts WHERE slug = ? AND id != ?').get(slug, exceptId));
  },

  /** publishedBefore: wall-clock string; only published posts dated before it are returned. */
  list({ publishedBefore, category, limit = 50, offset = 0 } = {}) {
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
    return getDb()
      .prepare(`SELECT * FROM posts ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY published_at DESC, id DESC LIMIT ? OFFSET ?`)
      .all(...params, limit, offset);
  },

  count({ publishedBefore, category } = {}) {
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
    return getDb().prepare(`SELECT COUNT(*) AS total FROM posts ${where.length ? `WHERE ${where.join(' AND ')}` : ''}`).get(...params).total;
  },

  create(data) {
    const columns = COLUMNS.filter((column) => data[column] !== undefined);
    const result = getDb()
      .prepare(`INSERT INTO posts (${columns.join(', ')}) VALUES (${columns.map(() => '?').join(', ')})`)
      .run(...columns.map((column) => data[column]));
    return Number(result.lastInsertRowid);
  },

  update(id, data) {
    const columns = COLUMNS.filter((column) => data[column] !== undefined);
    getDb()
      .prepare(`UPDATE posts SET ${columns.map((column) => `${column} = ?`).join(', ')}, updated_at = datetime('now') WHERE id = ?`)
      .run(...columns.map((column) => data[column]), id);
  },

  delete(id) {
    getDb().prepare('DELETE FROM posts WHERE id = ?').run(id);
  },
};
