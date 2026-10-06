import { config } from '../../config/index.js';
import { db } from '../../db/index.js';

/**
 * Deployment diagnostics without secrets: which database and photo storage this instance uses,
 * which configuration variables exist (names only) and how much content it sees.
 */
export async function health(req, res) {
  const remote = !config.databaseUrl.startsWith('file:');
  const report = {
    ok: true,
    commit: (process.env.VERCEL_GIT_COMMIT_SHA || '').slice(0, 7) || null,
    environment: process.env.VERCEL_ENV || config.env,
    database: remote ? { kind: 'turso', host: new URL(config.databaseUrl).hostname.split('.')[0].slice(0, 28) } : { kind: 'fichier local' },
    photos: config.blobToken ? 'vercel-blob' : 'disque local',
    variables: Object.keys(process.env)
      .filter((name) => /TURSO|BLOB|SESSION_SECRET|BASE_URL/.test(name))
      .sort(),
  };
  try {
    const [animals, users] = await Promise.all([db.get('SELECT COUNT(*) AS n FROM animals'), db.get('SELECT COUNT(*) AS n FROM users')]);
    report.counts = { animals: animals.n, accounts: users.n };
  } catch (error) {
    report.ok = false;
    report.error = error.message;
  }
  res.set('Cache-Control', 'no-store').status(report.ok ? 200 : 503).json(report);
}
