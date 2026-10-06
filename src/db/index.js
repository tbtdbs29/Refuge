import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { config } from '../config/index.js';

let db;

export function getDb() {
  if (!db) {
    db = openDatabase(config.databasePath);
  }
  return db;
}

export function openDatabase(file) {
  if (file !== ':memory:') {
    fs.mkdirSync(path.dirname(file), { recursive: true });
  }
  const instance = new DatabaseSync(file);
  instance.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');
  instance.exec(fs.readFileSync(path.join(import.meta.dirname, 'schema.sql'), 'utf8'));
  migrate(instance);
  return instance;
}

// Additive migrations for databases created by an earlier version of the schema.
const COLUMN_MIGRATIONS = [
  ['animals', 'example', 'INTEGER NOT NULL DEFAULT 0'],
  ['events', 'example', 'INTEGER NOT NULL DEFAULT 0'],
  ['posts', 'example', 'INTEGER NOT NULL DEFAULT 0'],
];

function migrate(instance) {
  for (const [table, column, definition] of COLUMN_MIGRATIONS) {
    const exists = instance.prepare(`PRAGMA table_info(${table})`).all().some((info) => info.name === column);
    if (!exists) instance.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

export function closeDb() {
  if (db) {
    db.close();
    db = undefined;
  }
}

/** Runs fn inside a transaction, rolling back on error. */
export function transaction(fn) {
  const database = getDb();
  database.exec('BEGIN');
  try {
    const result = fn(database);
    database.exec('COMMIT');
    return result;
  } catch (error) {
    database.exec('ROLLBACK');
    throw error;
  }
}
