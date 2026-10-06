import { getDb } from '../db/index.js';

const COLUMNS = [
  'slug', 'name', 'species', 'sex', 'breed', 'birth_date', 'age_label', 'tagline', 'description',
  'ok_dogs', 'ok_cats', 'ok_kids', 'housing', 'identification', 'vaccinated', 'sterilized', 'dewormed',
  'foster_note', 'status', 'urgent', 'featured', 'published', 'backdrop', 'fee_label', 'adopted_at', 'example',
];

function pick(data) {
  return COLUMNS.filter((column) => data[column] !== undefined);
}

export const animalRepository = {
  findById(id) {
    return getDb().prepare('SELECT * FROM animals WHERE id = ?').get(id);
  },

  findBySlug(slug) {
    return getDb().prepare('SELECT * FROM animals WHERE slug = ?').get(slug);
  },

  slugExists(slug, exceptId = 0) {
    return Boolean(getDb().prepare('SELECT 1 FROM animals WHERE slug = ? AND id != ?').get(slug, exceptId));
  },

  /**
   * Lists animals matching simple filters. Every filter value is bound as a parameter.
   */
  list({ species, statuses, publishedOnly = false, urgent, featured, search, sex, okKids, okCats, okDogs, order = 'recent', limit, offset = 0 } = {}) {
    const where = [];
    const params = [];
    if (publishedOnly) where.push('published = 1');
    if (species) {
      where.push('species = ?');
      params.push(species);
    }
    if (statuses?.length) {
      where.push(`status IN (${statuses.map(() => '?').join(', ')})`);
      params.push(...statuses);
    }
    if (urgent !== undefined) {
      where.push('urgent = ?');
      params.push(urgent ? 1 : 0);
    }
    if (featured !== undefined) {
      where.push('featured = ?');
      params.push(featured ? 1 : 0);
    }
    if (sex) {
      where.push('sex = ?');
      params.push(sex);
    }
    if (okKids) where.push("ok_kids IN ('oui', 'grands')");
    if (okCats) where.push("ok_cats = 'oui'");
    if (okDogs) where.push("ok_dogs = 'oui'");
    if (search) {
      where.push('(name LIKE ? OR breed LIKE ? OR identification LIKE ?)');
      const term = `%${search}%`;
      params.push(term, term, term);
    }
    const orderBy = {
      recent: 'created_at DESC, id DESC',
      adopted: 'adopted_at DESC, id DESC',
      name: 'name COLLATE NOCASE ASC',
      urgent: 'urgent DESC, featured DESC, created_at DESC',
      updated: 'updated_at DESC',
    }[order] || 'created_at DESC';
    let sql = `SELECT * FROM animals ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY ${orderBy}`;
    if (limit) {
      sql += ' LIMIT ? OFFSET ?';
      params.push(limit, offset);
    }
    return getDb().prepare(sql).all(...params);
  },

  count({ publishedOnly = false, statuses, species } = {}) {
    const where = [];
    const params = [];
    if (publishedOnly) where.push('published = 1');
    if (species) {
      where.push('species = ?');
      params.push(species);
    }
    if (statuses?.length) {
      where.push(`status IN (${statuses.map(() => '?').join(', ')})`);
      params.push(...statuses);
    }
    return getDb().prepare(`SELECT COUNT(*) AS total FROM animals ${where.length ? `WHERE ${where.join(' AND ')}` : ''}`).get(...params).total;
  },

  countBySpecies(statuses) {
    return getDb()
      .prepare(`SELECT species, COUNT(*) AS total FROM animals WHERE published = 1 AND status IN (${statuses.map(() => '?').join(', ')}) GROUP BY species`)
      .all(...statuses);
  },

  create(data) {
    const columns = pick(data);
    const result = getDb()
      .prepare(`INSERT INTO animals (${columns.join(', ')}) VALUES (${columns.map(() => '?').join(', ')})`)
      .run(...columns.map((column) => data[column]));
    return Number(result.lastInsertRowid);
  },

  update(id, data) {
    const columns = pick(data);
    if (!columns.length) return;
    getDb()
      .prepare(`UPDATE animals SET ${columns.map((column) => `${column} = ?`).join(', ')}, updated_at = datetime('now') WHERE id = ?`)
      .run(...columns.map((column) => data[column]), id);
  },

  delete(id) {
    getDb().prepare('DELETE FROM animals WHERE id = ?').run(id);
  },

  photos(animalId) {
    return getDb().prepare('SELECT * FROM animal_photos WHERE animal_id = ? ORDER BY position, id').all(animalId);
  },

  photosFor(animalIds) {
    if (!animalIds.length) return [];
    return getDb()
      .prepare(`SELECT * FROM animal_photos WHERE animal_id IN (${animalIds.map(() => '?').join(', ')}) ORDER BY position, id`)
      .all(...animalIds);
  },

  findPhoto(photoId) {
    return getDb().prepare('SELECT * FROM animal_photos WHERE id = ?').get(photoId);
  },

  addPhoto(animalId, { filename, width, height }) {
    const { next } = getDb().prepare('SELECT COALESCE(MAX(position), -1) + 1 AS next FROM animal_photos WHERE animal_id = ?').get(animalId);
    getDb()
      .prepare('INSERT INTO animal_photos (animal_id, filename, width, height, position) VALUES (?, ?, ?, ?, ?)')
      .run(animalId, filename, width ?? null, height ?? null, next);
  },

  deletePhoto(photoId) {
    getDb().prepare('DELETE FROM animal_photos WHERE id = ?').run(photoId);
  },

  setPhotoPosition(photoId, position) {
    getDb().prepare('UPDATE animal_photos SET position = ? WHERE id = ?').run(position, photoId);
  },
};
