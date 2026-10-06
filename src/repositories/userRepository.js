import { getDb } from '../db/index.js';

const PUBLIC_COLUMNS = 'id, name, email, role, last_login_at, created_at';

export const userRepository = {
  findById(id) {
    return getDb().prepare(`SELECT ${PUBLIC_COLUMNS} FROM users WHERE id = ?`).get(id);
  },

  findWithHashByEmail(email) {
    return getDb().prepare('SELECT * FROM users WHERE email = ?').get(email);
  },

  findHashById(id) {
    return getDb().prepare('SELECT password_hash FROM users WHERE id = ?').get(id)?.password_hash;
  },

  emailExists(email, exceptId = 0) {
    return Boolean(getDb().prepare('SELECT 1 FROM users WHERE email = ? AND id != ?').get(email, exceptId));
  },

  list() {
    return getDb().prepare(`SELECT ${PUBLIC_COLUMNS} FROM users ORDER BY name COLLATE NOCASE`).all();
  },

  countAdmins() {
    return getDb().prepare("SELECT COUNT(*) AS total FROM users WHERE role = 'admin'").get().total;
  },

  count() {
    return getDb().prepare('SELECT COUNT(*) AS total FROM users').get().total;
  },

  create({ name, email, passwordHash, role }) {
    const result = getDb()
      .prepare('INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)')
      .run(name, email, passwordHash, role);
    return Number(result.lastInsertRowid);
  },

  update(id, { name, email, role }) {
    getDb().prepare('UPDATE users SET name = ?, email = ?, role = ? WHERE id = ?').run(name, email, role, id);
  },

  setPassword(id, passwordHash) {
    getDb().prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(passwordHash, id);
  },

  touchLogin(id) {
    getDb().prepare("UPDATE users SET last_login_at = datetime('now') WHERE id = ?").run(id);
  },

  delete(id) {
    getDb().prepare('DELETE FROM users WHERE id = ?').run(id);
  },
};
