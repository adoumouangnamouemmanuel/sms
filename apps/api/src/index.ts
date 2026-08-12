import { buildServer, getListenOptions } from './server.js';

async function start() {
  const server = buildServer();

  try {
    await server.listen(getListenOptions());
  } catch (error) {
    server.log.error({ err: error }, 'Failed to start EduTrack API sidecar');
    process.exit(1);
  }
}

void start();
