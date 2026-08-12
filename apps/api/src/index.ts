import { buildServer, createSidecarReadyPayload, getListenOptions } from './server.js';

async function start() {
  const server = buildServer();
  const listenOptions = getListenOptions();

  try {
    await server.listen(listenOptions);
    const address = server.server.address();
    const port =
      typeof address === 'object' && address !== null ? address.port : listenOptions.port;

    process.stdout.write(
      `${JSON.stringify(createSidecarReadyPayload(listenOptions.host, port))}\n`
    );
  } catch (error) {
    server.log.error({ err: error }, 'Failed to start EduTrack API sidecar');
    process.exit(1);
  }
}

void start();
