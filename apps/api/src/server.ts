import { ensureDeploymentDatabase, type DeploymentDatabaseStatus } from '@edutrack/db';
import { APP_NAME, REDACTED_LOG_VALUE, SENSITIVE_LOG_FIELDS } from '@edutrack/shared';
import Fastify, { type FastifyServerOptions } from 'fastify';

const DEFAULT_API_HOST = '127.0.0.1';
const DEFAULT_API_PORT = 0;
const DEFAULT_ALLOWED_ORIGINS = ['http://127.0.0.1:5173', 'tauri://localhost'];
const CAPABILITY_HEADER = 'x-edutrack-capability';

export interface SafeLoggerOptions {
  level: string;
  redact: {
    paths: string[];
    censor: string;
  };
}

export interface SidecarSecurityOptions {
  allowedOrigins: string[];
  capabilityToken?: string;
}

export interface BuildServerOptions extends Pick<FastifyServerOptions, 'logger'> {
  databaseStatus?: DeploymentDatabaseStatus;
  security?: SidecarSecurityOptions;
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

export function createSidecarSecurityOptions(
  env: NodeJS.ProcessEnv = process.env
): SidecarSecurityOptions {
  const allowedOrigins = parseAllowedOrigins(env.EDUTRACK_ALLOWED_ORIGIN);

  if (!env.EDUTRACK_SIDECAR_TOKEN) {
    return { allowedOrigins };
  }

  return {
    allowedOrigins,
    capabilityToken: env.EDUTRACK_SIDECAR_TOKEN,
  };
}

export function buildServer(options: BuildServerOptions = {}) {
  const databaseStatus = options.databaseStatus ?? ensureDeploymentDatabase();
  const security = options.security ?? createSidecarSecurityOptions();
  const server = Fastify({
    logger: options.logger ?? createLoggerOptions(),
  });

  server.addHook('onRequest', async (request, reply) => {
    const origin = request.headers.origin;

    if (origin && !security.allowedOrigins.includes(origin)) {
      return reply.code(403).send({
        success: false,
        error: {
          code: 'UNEXPECTED_ORIGIN',
          message: "L'origine de la requête locale est refusée.",
        },
      });
    }

    if (security.capabilityToken) {
      const capability = request.headers[CAPABILITY_HEADER];

      if (capability !== security.capabilityToken) {
        return reply.code(403).send({
          success: false,
          error: {
            code: 'INVALID_CAPABILITY',
            message: "La capacité locale de l'application est invalide.",
          },
        });
      }
    }
  });

  server.get('/health', () => ({
    success: true,
    data: {
      service: APP_NAME,
      status: 'ok',
      database: databaseStatus,
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

export function createSidecarReadyPayload(host: string, port: number) {
  return {
    type: 'edutrack-sidecar-ready',
    host,
    port,
    healthPath: '/health',
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

function parseAllowedOrigins(rawOrigins: string | undefined) {
  if (!rawOrigins) {
    return [...DEFAULT_ALLOWED_ORIGINS];
  }

  return rawOrigins
    .split(/[;,]/)
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);
}
