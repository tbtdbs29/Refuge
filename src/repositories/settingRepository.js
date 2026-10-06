import { db } from '../db/index.js';

export const settingRepository = {
  async all() {
    const rows = await db.all('SELECT key, value FROM settings');
    return Object.fromEntries(rows.map((row) => [row.key, JSON.parse(row.value)]));
  },

  async set(key, value) {
    await db.run('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', [key, JSON.stringify(value)]);
  },
};
