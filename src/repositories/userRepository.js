import { db } from '../db/index.js';

const PUBLIC_COLUMNS = 'id, name, email, role, last_login_at, created_at';

export const userRepository = {
  findById(id) {
    return db.get(`SELECT ${PUBLIC_COLUMNS} FROM users WHERE id = ?`, [id]);
  },

  findWithHashByEmail(email) {
    return db.get('SELECT * FROM users WHERE email = ?', [email]);
  },

  async findHashById(id) {
    return (await db.get('SELECT password_hash FROM users WHERE id = ?', [id]))?.password_hash;
  },

  async emailExists(email, exceptId = 0) {
    return Boolean(await db.get('SELECT 1 AS found FROM users WHERE email = ? AND id != ?', [email, exceptId]));
  },

  list() {
    return db.all(`SELECT ${PUBLIC_COLUMNS} FROM users ORDER BY name COLLATE NOCASE`);
  },

  async countAdmins() {
    return (await db.get("SELECT COUNT(*) AS total FROM users WHERE role = 'admin'")).total;
  },

  async count() {
    return (await db.get('SELECT COUNT(*) AS total FROM users')).total;
  },

  async create({ name, email, passwordHash, role }) {
    const result = await db.run('INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)', [name, email, passwordHash, role]);
    return result.lastInsertRowid;
  },

  async update(id, { name, email, role }) {
    await db.run('UPDATE users SET name = ?, email = ?, role = ? WHERE id = ?', [name, email, role, id]);
  },

  async setPassword(id, passwordHash) {
    await db.run('UPDATE users SET password_hash = ? WHERE id = ?', [passwordHash, id]);
  },

  async touchLogin(id) {
    await db.run("UPDATE users SET last_login_at = datetime('now') WHERE id = ?", [id]);
  },

  async delete(id) {
    await db.run('DELETE FROM users WHERE id = ?', [id]);
  },
};
