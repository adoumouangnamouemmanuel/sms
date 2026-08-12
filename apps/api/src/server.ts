import { APP_NAME, REDACTED_LOG_VALUE, SENSITIVE_LOG_FIELDS } from '@edutrack/shared';
import Fastify, { type FastifyServerOptions } from 'fastify';

const DEFAULT_API_HOST = '127.0.0.1';
const DEFAULT_API_PORT = 0;

export interface SafeLoggerOptions {
  level: string;
  redact: {
    paths: string[];
    censor: string;
  };
}

export function createLoggerOptions(): SafeLoggerOptions {
  return {
    level: process.env.LOG_LEVEL ?? 'info',
    redact: {
      paths: [...SENSITIVE_LOG_FIELDS],
      censor: REDACTED_LOG_VALUE,
    },
  };
}

export function buildServer(options: Pick<FastifyServerOptions, 'logger'> = {}) {
  const server = Fastify({
    logger: options.logger ?? createLoggerOptions(),
  });

  server.get('/health', () => ({
    success: true,
    data: {
      service: APP_NAME,
      status: 'ok',
    },
    message: 'OK',
  }));

  return server;
}

export function getListenOptions() {
  const host = process.env.EDUTRACK_API_HOST ?? DEFAULT_API_HOST;

  if (host !== DEFAULT_API_HOST && host !== 'localhost') {
    throw new Error('EduTrack API sidecar must bind to loopback during Version 1.');
  }

  return {
    host,
    port: parsePort(process.env.EDUTRACK_API_PORT),
  };
}

function parsePort(rawPort: string | undefined) {
  if (!rawPort) {
    return DEFAULT_API_PORT;
  }

  const port = Number(rawPort);

  if (!Number.isInteger(port) || port < 0 || port > 65_535) {
    throw new Error('EDUTRACK_API_PORT must be an integer from 0 through 65535.');
  }

  return port;
}
