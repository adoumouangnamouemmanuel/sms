import { buildServer, createSidecarReadyPayload, getListenOptions } from './server.js';

async function start() {
  let server: ReturnType<typeof buildServer> | undefined;

  try {
    server = buildServer();
    const listenOptions = getListenOptions();

    await server.listen(listenOptions);
    const address = server.server.address();
    const port =
      typeof address === 'object' && address !== null ? address.port : listenOptions.port;

    process.stdout.write(
      `${JSON.stringify(createSidecarReadyPayload(listenOptions.host, port))}\n`
    );
  } catch (error) {
    if (server) {
      server.log.error({ err: error }, 'Failed to start EduTrack API sidecar');
    } else {
      const message = error instanceof Error ? error.message : String(error);
      process.stderr.write(`Failed to start EduTrack API sidecar: ${message}\n`);
    }

    process.exit(1);
  }
}

void start();
