import { createApp } from './app.js';
import { config } from './config/index.js';
import { closeDb, getDb } from './db/index.js';
import { logger } from './utils/logger.js';

getDb();
const server = createApp().listen(config.port, () => {
  logger.info('server.started', { port: config.port, env: config.env });
});

function shutdown(signal) {
  logger.info('server.stopping', { signal });
  server.close(() => {
    closeDb();
    process.exit(0);
  });
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
