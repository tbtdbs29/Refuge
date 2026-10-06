import { getDb } from '../db/index.js';

export const settingRepository = {
  all() {
    const rows = getDb().prepare('SELECT key, value FROM settings').all();
    return Object.fromEntries(rows.map((row) => [row.key, JSON.parse(row.value)]));
  },

  set(key, value) {
    getDb()
      .prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
      .run(key, JSON.stringify(value));
  },
};
