import { createApp } from './app.js';
import { createDatabase } from './adapters/db.js';
import config from './config.js';

const db = createDatabase(config.dbPath);
const server = createApp({ db, config });

server.listen(config.port, config.host, () => {
  console.log(`Samabox server running on http://${config.host}:${config.port} (env: ${config.nodeEnv})`);
});

function shutdown() {
  console.log('Shutting down Samabox server gracefully...');
  server.close(() => {
    try {
      db.close();
    } catch {
      // ignore
    }
    process.exit(0);
  });
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

export { server, db };
