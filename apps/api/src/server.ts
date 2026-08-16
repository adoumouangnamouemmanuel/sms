import {
  applyApplicationMigrations,
  ensureDeploymentDatabase,
  openEduTrackDatabase,
  type DeploymentDatabaseStatus,
  type EduTrackDatabase,
  type EduTrackDatabaseConnection,
} from '@edutrack/db';
import {
  APP_NAME,
  REDACTED_LOG_VALUE,
  SENSITIVE_LOG_FIELDS,
  SIDECAR_CAPABILITY_HEADER,
} from '@edutrack/shared';
import Fastify, { type FastifyReply, type FastifyServerOptions } from 'fastify';
import { registerAuditRoutes, AuditService } from './modules/audit/index.js';
import { AuthService, registerAuthRoutes, type AuthServiceOptions } from './modules/auth/index.js';
import {
  ClassEnrollmentsService,
  ClassroomsService,
  ClassSubjectsService,
  CurriculumService,
  registerClassesRoutes,
  SubjectsService,
} from './modules/classes/index.js';
import {
  ConfigurationService,
  registerConfigurationRoutes,
} from './modules/configuration/index.js';
import { ImportsService, registerImportsRoutes } from './modules/imports/index.js';
import {
  GuardiansService,
  registerPeopleRoutes,
  StudentsService,
  TeachersService,
} from './modules/people/index.js';
import { registerSetupRoutes, SetupService } from './modules/setup/index.js';
export { CAPABILITY_HEADER } from './sidecar-contract.js';
import { CAPABILITY_HEADER } from './sidecar-contract.js';

const DEFAULT_API_HOST = '127.0.0.1';
const DEFAULT_API_PORT = 0;
const DEFAULT_ALLOWED_ORIGINS = [
  'http://127.0.0.1:5173',
  'http://tauri.localhost',
  'tauri://localhost',
];
const CORS_ALLOWED_METHODS = 'GET,POST,PUT,DELETE,OPTIONS';
const CORS_ALLOWED_HEADERS = ['Authorization', 'Content-Type', SIDECAR_CAPABILITY_HEADER].join(',');

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
  database?: EduTrackDatabase;
  migrateApplicationDatabase?: (sqlitePath: string) => void;
  security?: SidecarSecurityOptions;
  auth?: AuthServiceOptions & {
    enabled?: boolean;
  };
}

type SecurityDowngradeWarning = (message: string) => void;

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
  env: NodeJS.ProcessEnv = process.env,
  warn?: SecurityDowngradeWarning
): SidecarSecurityOptions {
  const allowedOrigins = parseAllowedOrigins(env.EDUTRACK_ALLOWED_ORIGIN);
  const capabilityToken = env.EDUTRACK_SIDECAR_TOKEN?.trim();

  if (!capabilityToken) {
    if (env.NODE_ENV === 'production') {
      throw new Error('EDUTRACK_SIDECAR_TOKEN is required in production.');
    }

    warn?.(
      'EDUTRACK_SIDECAR_TOKEN is not set; local API capability checks are disabled outside production.'
    );

    return { allowedOrigins };
  }

  return {
    allowedOrigins,
    capabilityToken,
  };
}

export function buildServer(options: BuildServerOptions = {}) {
  const server = Fastify({
    logger: options.logger ?? createLoggerOptions(),
  });
  const security =
    options.security ??
    createSidecarSecurityOptions(process.env, (message) => {
      server.log.warn({ code: 'SIDECAR_CAPABILITY_DISABLED' }, message);
    });
  const databaseStatus =
    options.databaseStatus ??
    (() => {
      const deploymentStatus = ensureDeploymentDatabase();
      const migrateApplicationDatabase =
        options.migrateApplicationDatabase ?? applyApplicationMigrations;
      migrateApplicationDatabase(deploymentStatus.sqlitePath);
      return deploymentStatus;
    })();
  const databaseConnection = createServerDatabaseConnection(options, databaseStatus);
  const database = options.database ?? databaseConnection?.db;
  const authEnabled =
    options.auth?.enabled ?? (Boolean(options.database) || process.env.NODE_ENV !== 'test');

  server.setNotFoundHandler((_request, reply) => {
    return reply.code(404).send({
      success: false,
      error: {
        code: 'ROUTE_NOT_FOUND',
        message: 'La route demandee est introuvable.',
      },
    });
  });

  server.setErrorHandler((error, request, reply) => {
    // Requests that already sent a response must not be answered twice.
    if (reply.sent) {
      request.log.error({ err: error }, 'Unhandled error after response started');
      return;
    }

    request.log.error(
      { err: error, method: request.method, url: request.url },
      'Unhandled error during request handling'
    );

    return reply.code(500).send({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Une erreur interne est survenue. Réessayez.',
      },
    });
  });

  server.addHook('onRequest', async (request, reply) => {
    const origin = readSingleHeader(request.headers.origin);

    if (origin && !security.allowedOrigins.includes(origin)) {
      return reply.code(403).send({
        success: false,
        error: {
          code: 'UNEXPECTED_ORIGIN',
          message: "L'origine de la requête locale est refusée.",
        },
      });
    }

    if (origin) {
      applyCorsHeaders(reply, origin);
    }

    if (request.method === 'OPTIONS') {
      // Browser preflight requests do not carry the sidecar capability token.
      return reply.code(204).send();
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

  if (authEnabled && database) {
    const authService = new AuthService(database, resolveAuthOptions(options.auth, process.env));

    registerAuditRoutes(server, {
      authService,
      auditService: new AuditService(database),
    });
    registerAuthRoutes(server, {
      authService,
    });
    registerSetupRoutes(server, {
      authService,
      setupService: new SetupService(database, {
        ...(options.auth?.now ? { now: options.auth.now } : {}),
      }),
    });
    registerConfigurationRoutes(server, {
      authService,
      configurationService: new ConfigurationService(database),
    });
    registerPeopleRoutes(server, {
      authService,
      studentsService: new StudentsService(database, {
        ...(options.auth?.now ? { now: options.auth.now } : {}),
      }),
      guardiansService: new GuardiansService(database, {
        ...(options.auth?.now ? { now: options.auth.now } : {}),
      }),
      teachersService: new TeachersService(database, {
        ...(options.auth?.now ? { now: options.auth.now } : {}),
      }),
    });
    registerImportsRoutes(server, {
      authService,
      importsService: new ImportsService(database, {
        ...(options.auth?.now ? { now: options.auth.now } : {}),
      }),
    });
    registerClassesRoutes(server, {
      authService,
      subjectsService: new SubjectsService(database, {
        ...(options.auth?.now ? { now: options.auth.now } : {}),
      }),
      classroomsService: new ClassroomsService(database, {
        ...(options.auth?.now ? { now: options.auth.now } : {}),
      }),
      classSubjectsService: new ClassSubjectsService(database, {
        ...(options.auth?.now ? { now: options.auth.now } : {}),
      }),
      classEnrollmentsService: new ClassEnrollmentsService(database, {
        ...(options.auth?.now ? { now: options.auth.now } : {}),
      }),
      curriculumService: new CurriculumService(database),
    });
  }

  if (databaseConnection) {
    server.addHook('onClose', () => {
      databaseConnection.close();
    });
  }

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

function resolveAuthOptions(
  auth: BuildServerOptions['auth'],
  env: NodeJS.ProcessEnv
): AuthServiceOptions | undefined {
  // Explicit options win; the desktop shell injects the installation secret via environment.
  const accessTokenSecret = auth?.accessTokenSecret ?? env.AUTH_ACCESS_TOKEN_SECRET;

  if (auth) {
    return {
      ...auth,
      ...(accessTokenSecret !== undefined ? { accessTokenSecret } : {}),
    };
  }

  return accessTokenSecret !== undefined ? { accessTokenSecret } : undefined;
}

function applyCorsHeaders(reply: FastifyReply, origin: string) {
  reply
    .header('Access-Control-Allow-Origin', origin)
    .header('Access-Control-Allow-Credentials', 'true')
    .header('Access-Control-Allow-Methods', CORS_ALLOWED_METHODS)
    .header('Access-Control-Allow-Headers', CORS_ALLOWED_HEADERS)
    .header('Vary', 'Origin');
}

function readSingleHeader(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function createServerDatabaseConnection(
  options: BuildServerOptions,
  databaseStatus: DeploymentDatabaseStatus
): EduTrackDatabaseConnection | undefined {
  const authEnabled =
    options.auth?.enabled ?? (Boolean(options.database) || process.env.NODE_ENV !== 'test');

  if (options.database || !authEnabled) {
    return undefined;
  }

  if (options.databaseStatus && options.auth?.enabled !== true) {
    return undefined;
  }

  return openEduTrackDatabase(databaseStatus.sqlitePath);
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
