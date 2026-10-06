import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@libsql/client';
import { config } from '../config/index.js';

// libSQL client: a local SQLite file in development and tests, a Turso database in production.
let client;
let ready;

function connect() {
  if (config.databaseUrl.startsWith('file:')) {
    fs.mkdirSync(path.dirname(config.databaseUrl.slice('file:'.length)), { recursive: true });
  }
  // timeout: busy timeout (ms) applied to every pooled connection of a local file, so
  // simultaneous writes wait for the lock instead of failing with SQLITE_BUSY.
  return createClient({ url: config.databaseUrl, authToken: config.databaseAuthToken || undefined, timeout: 10_000 });
}

// Additive migrations for databases created by an earlier version of the schema.
const COLUMN_MIGRATIONS = [
  ['animals', 'example', 'INTEGER NOT NULL DEFAULT 0'],
  ['events', 'example', 'INTEGER NOT NULL DEFAULT 0'],
  ['posts', 'example', 'INTEGER NOT NULL DEFAULT 0'],
];

async function initialise(instance) {
  if (config.databaseUrl.startsWith('file:')) {
    await instance.execute('PRAGMA journal_mode = WAL');
  }
  await instance.executeMultiple(fs.readFileSync(path.join(import.meta.dirname, 'schema.sql'), 'utf8'));
  for (const [table, column, definition] of COLUMN_MIGRATIONS) {
    const { rows } = await instance.execute(`PRAGMA table_info(${table})`);
    if (!rows.some((info) => info.name === column)) {
      await instance.execute(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
    }
  }
}

/** Resolves once the schema exists. Safe to call on every request: the work runs once per process. */
export function ensureDb() {
  if (!ready) {
    client = connect();
    ready = initialise(client).catch((error) => {
      ready = undefined;
      throw error;
    });
  }
  return ready;
}

// A local SQLite file accepts one writer at a time and the client's connection pool makes
// concurrent writers fail with SQLITE_BUSY. Writes from this process are therefore queued.
// Remote Turso databases serialise writes on the server, so no queue is needed there.
let writeQueue = Promise.resolve();

function withWriteLock(fn) {
  if (!config.databaseUrl.startsWith('file:')) return fn();
  const result = writeQueue.then(fn, fn);
  writeQueue = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
}

function executor(target) {
  const execute = (sql, args = []) => target.execute({ sql, args });
  return {
    async all(sql, args) {
      return (await execute(sql, args)).rows.map((row) => ({ ...row }));
    },
    async get(sql, args) {
      const { rows } = await execute(sql, args);
      return rows[0] ? { ...rows[0] } : undefined;
    },
    async run(sql, args) {
      const result = await execute(sql, args);
      return { changes: result.rowsAffected, lastInsertRowid: result.lastInsertRowid === undefined ? undefined : Number(result.lastInsertRowid) };
    },
  };
}

/** Query helpers bound to the shared client: db.all / db.get / db.run. */
export const db = {
  async all(sql, args) {
    await ensureDb();
    return executor(client).all(sql, args);
  },
  async get(sql, args) {
    await ensureDb();
    return executor(client).get(sql, args);
  },
  async run(sql, args) {
    await ensureDb();
    return withWriteLock(() => executor(client).run(sql, args));
  },
  async exec(sql) {
    await ensureDb();
    await withWriteLock(() => client.executeMultiple(sql));
  },
};

/** Runs fn(tx) inside a write transaction, rolling back on error. tx exposes all/get/run. */
export async function transaction(fn) {
  await ensureDb();
  return withWriteLock(async () => {
    const tx = await client.transaction('write');
    try {
      const result = await fn(executor(tx));
      await tx.commit();
      return result;
    } catch (error) {
      await tx.rollback();
      throw error;
    } finally {
      tx.close();
    }
  });
}

export function closeDb() {
  if (client) client.close();
  client = undefined;
  ready = undefined;
}
