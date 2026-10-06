import { db } from '../db/index.js';

const COLUMNS = [
  'slug', 'name', 'species', 'sex', 'breed', 'birth_date', 'age_label', 'tagline', 'description',
  'ok_dogs', 'ok_cats', 'ok_kids', 'housing', 'identification', 'vaccinated', 'sterilized', 'dewormed',
  'foster_note', 'status', 'urgent', 'featured', 'published', 'backdrop', 'fee_label', 'adopted_at', 'example',
];

function pick(data) {
  return COLUMNS.filter((column) => data[column] !== undefined);
}

function statusFilter(statuses, where, params) {
  if (statuses?.length) {
    where.push(`status IN (${statuses.map(() => '?').join(', ')})`);
    params.push(...statuses);
  }
}

export const animalRepository = {
  findById(id) {
    return db.get('SELECT * FROM animals WHERE id = ?', [id]);
  },

  findBySlug(slug) {
    return db.get('SELECT * FROM animals WHERE slug = ?', [slug]);
  },

  async slugExists(slug, exceptId = 0) {
    return Boolean(await db.get('SELECT 1 AS found FROM animals WHERE slug = ? AND id != ?', [slug, exceptId]));
  },

  /** Lists animals matching simple filters. Every filter value is bound as a parameter. */
  list({ species, statuses, publishedOnly = false, urgent, featured, search, sex, okKids, okCats, okDogs, order = 'recent', limit, offset = 0 } = {}) {
    const where = [];
    const params = [];
    if (publishedOnly) where.push('published = 1');
    if (species) {
      where.push('species = ?');
      params.push(species);
    }
    statusFilter(statuses, where, params);
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
      urgent: 'urgent DESC, featured DESC, created_at DESC, id DESC',
      updated: 'updated_at DESC, id DESC',
    }[order] || 'created_at DESC';
    let sql = `SELECT * FROM animals ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY ${orderBy}`;
    if (limit) {
      sql += ' LIMIT ? OFFSET ?';
      params.push(limit, offset);
    }
    return db.all(sql, params);
  },

  async count({ publishedOnly = false, statuses, species } = {}) {
    const where = [];
    const params = [];
    if (publishedOnly) where.push('published = 1');
    if (species) {
      where.push('species = ?');
      params.push(species);
    }
    statusFilter(statuses, where, params);
    const row = await db.get(`SELECT COUNT(*) AS total FROM animals ${where.length ? `WHERE ${where.join(' AND ')}` : ''}`, params);
    return row.total;
  },

  countBySpecies(statuses) {
    return db.all(
      `SELECT species, COUNT(*) AS total FROM animals WHERE published = 1 AND status IN (${statuses.map(() => '?').join(', ')}) GROUP BY species`,
      statuses,
    );
  },

  async create(data, executor = db) {
    const columns = pick(data);
    const result = await executor.run(
      `INSERT INTO animals (${columns.join(', ')}) VALUES (${columns.map(() => '?').join(', ')})`,
      columns.map((column) => data[column]),
    );
    return result.lastInsertRowid;
  },

  async update(id, data) {
    const columns = pick(data);
    if (!columns.length) return;
    await db.run(
      `UPDATE animals SET ${columns.map((column) => `${column} = ?`).join(', ')}, updated_at = datetime('now') WHERE id = ?`,
      [...columns.map((column) => data[column]), id],
    );
  },

  /** Removes the animal, its photo rows and detaches its messages (no reliance on foreign key pragmas). */
  async delete(id, executor) {
    await executor.run('DELETE FROM animal_photos WHERE animal_id = ?', [id]);
    await executor.run('UPDATE messages SET animal_id = NULL WHERE animal_id = ?', [id]);
    await executor.run('DELETE FROM animals WHERE id = ?', [id]);
  },

  photos(animalId) {
    return db.all('SELECT * FROM animal_photos WHERE animal_id = ? ORDER BY position, id', [animalId]);
  },

  photosFor(animalIds) {
    if (!animalIds.length) return Promise.resolve([]);
    return db.all(
      `SELECT * FROM animal_photos WHERE animal_id IN (${animalIds.map(() => '?').join(', ')}) ORDER BY position, id`,
      animalIds,
    );
  },

  findPhoto(photoId) {
    return db.get('SELECT * FROM animal_photos WHERE id = ?', [photoId]);
  },

  async addPhoto(animalId, { filename, width, height }, executor = db) {
    const { next } = await executor.get('SELECT COALESCE(MAX(position), -1) + 1 AS next FROM animal_photos WHERE animal_id = ?', [animalId]);
    await executor.run('INSERT INTO animal_photos (animal_id, filename, width, height, position) VALUES (?, ?, ?, ?, ?)', [
      animalId,
      filename,
      width ?? null,
      height ?? null,
      next,
    ]);
  },

  async deletePhoto(photoId) {
    await db.run('DELETE FROM animal_photos WHERE id = ?', [photoId]);
  },

  async setPhotoPosition(photoId, position, executor = db) {
    await executor.run('UPDATE animal_photos SET position = ? WHERE id = ?', [position, photoId]);
  },
};
