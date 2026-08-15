import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  buildServer,
  CAPABILITY_HEADER,
  createLoggerOptions,
  createSidecarReadyPayload,
  createSidecarSecurityOptions,
  getListenOptions,
} from '../server.js';

const databaseStatus = {
  sqlitePath: 'C:\\Users\\Test\\AppData\\Roaming\\EduTrack\\edutrack.sqlite',
  migrated: true,
  migrationId: 'deployment-probe-0001',
};

interface HealthResponseBody {
  data: {
    database: {
      sqlitePath: string;
      migrated: boolean;
    };
  };
}

describe('api sidecar foundation', () => {
  let tempDir: string | undefined;

  afterEach(() => {
    if (tempDir) {
      rmSync(tempDir, { recursive: true, force: true });
      tempDir = undefined;
    }
  });

  it('returns the health response envelope', async () => {
    const server = buildServer({ databaseStatus, logger: false });

    const response = await server.inject({
      method: 'GET',
      url: '/health',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      success: true,
      data: {
        service: 'EduTrack Africa',
        status: 'ok',
        database: databaseStatus,
      },
      message: 'OK',
    });
  });

  it('applies application migrations before reporting database readiness', async () => {
    const migratedPaths: string[] = [];
    const previousSqlitePath = process.env.EDUTRACK_SQLITE_PATH;
    tempDir = mkdtempSync(join(tmpdir(), 'edutrack-api-test-'));
    process.env.EDUTRACK_SQLITE_PATH = join(tempDir, 'edutrack.sqlite');

    try {
      const server = buildServer({
        logger: false,
        security: {
          allowedOrigins: ['tauri://localhost'],
        },
        migrateApplicationDatabase: (sqlitePath) => {
          migratedPaths.push(sqlitePath);
        },
      });

      const response = await server.inject({
        method: 'GET',
        url: '/health',
      });
      const body = response.json<HealthResponseBody>();

      expect(response.statusCode).toBe(200);
      expect(migratedPaths).toEqual([body.data.database.sqlitePath]);
      expect(body.data.database.migrated).toBe(true);
    } finally {
      if (previousSqlitePath === undefined) {
        delete process.env.EDUTRACK_SQLITE_PATH;
      } else {
        process.env.EDUTRACK_SQLITE_PATH = previousSqlitePath;
      }
    }
  });

  it('redacts sensitive fields from logs by default', () => {
    const loggerOptions = createLoggerOptions();

    expect(loggerOptions).toMatchObject({
      redact: {
        censor: '[redacted]',
      },
    });
    expect(loggerOptions.redact.paths).toContain('req.headers.authorization');
    expect(loggerOptions.redact.paths).toContain('req.headers.cookie');
    expect(loggerOptions.redact.paths).toContain(`req.headers['${CAPABILITY_HEADER}']`);
    expect(loggerOptions.redact.paths).toContain('body.password');
  });

  it('rejects unexpected origins', async () => {
    const server = buildServer({
      databaseStatus,
      logger: false,
      security: {
        allowedOrigins: ['tauri://localhost'],
      },
    });

    const response = await server.inject({
      method: 'GET',
      url: '/health',
      headers: {
        origin: 'https://example.com',
      },
    });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toMatchObject({
      success: false,
      error: {
        code: 'UNEXPECTED_ORIGIN',
      },
    });
  });

  it('rejects missing or invalid sidecar capability tokens', async () => {
    const server = buildServer({
      databaseStatus,
      logger: false,
      security: {
        allowedOrigins: ['tauri://localhost'],
        capabilityToken: 'expected-token',
      },
    });

    const missingTokenResponse = await server.inject({
      method: 'GET',
      url: '/health',
      headers: {
        origin: 'tauri://localhost',
      },
    });

    expect(missingTokenResponse.statusCode).toBe(403);
    expect(missingTokenResponse.json()).toMatchObject({
      success: false,
      error: {
        code: 'INVALID_CAPABILITY',
      },
    });

    const invalidTokenResponse = await server.inject({
      method: 'GET',
      url: '/health',
      headers: {
        origin: 'tauri://localhost',
        [CAPABILITY_HEADER]: 'wrong-token',
      },
    });

    expect(invalidTokenResponse.statusCode).toBe(403);
    expect(invalidTokenResponse.json()).toMatchObject({
      success: false,
      error: {
        code: 'INVALID_CAPABILITY',
      },
    });
  });

  it('accepts expected origins and capability tokens', async () => {
    const server = buildServer({
      databaseStatus,
      logger: false,
      security: {
        allowedOrigins: ['tauri://localhost'],
        capabilityToken: 'expected-token',
      },
    });

    const response = await server.inject({
      method: 'GET',
      url: '/health',
      headers: {
        origin: 'tauri://localhost',
        [CAPABILITY_HEADER]: 'expected-token',
      },
    });

    expect(response.statusCode).toBe(200);
  });

  it('answers allowed browser preflight requests before capability enforcement', async () => {
    const server = buildServer({
      databaseStatus,
      logger: false,
      security: {
        allowedOrigins: ['http://127.0.0.1:5173'],
        capabilityToken: 'expected-token',
      },
    });

    const response = await server.inject({
      method: 'OPTIONS',
      url: '/auth/login',
      headers: {
        origin: 'http://127.0.0.1:5173',
        'access-control-request-method': 'POST',
        'access-control-request-headers': `content-type,${CAPABILITY_HEADER}`,
      },
    });

    expect(response.statusCode).toBe(204);
    expect(response.headers['access-control-allow-origin']).toBe('http://127.0.0.1:5173');
    expect(response.headers['access-control-allow-credentials']).toBe('true');
    expect(response.headers['access-control-allow-methods']).toContain('POST');
    expect(response.headers['access-control-allow-headers']).toContain(CAPABILITY_HEADER);
  });

  it('adds CORS headers to allowed browser requests', async () => {
    const server = buildServer({
      databaseStatus,
      logger: false,
      security: {
        allowedOrigins: ['http://127.0.0.1:5173'],
      },
    });

    const response = await server.inject({
      method: 'GET',
      url: '/health',
      headers: {
        origin: 'http://127.0.0.1:5173',
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers['access-control-allow-origin']).toBe('http://127.0.0.1:5173');
    expect(response.headers['access-control-allow-credentials']).toBe('true');
  });

  it('binds to loopback by default', () => {
    expect(getListenOptions()).toEqual({
      host: '127.0.0.1',
      port: 0,
    });
  });

  it('parses allowed origins and capability token from environment', () => {
    expect(
      createSidecarSecurityOptions({
        EDUTRACK_ALLOWED_ORIGIN: 'tauri://localhost;http://127.0.0.1:5173',
        EDUTRACK_SIDECAR_TOKEN: 'local-token',
      })
    ).toEqual({
      allowedOrigins: ['tauri://localhost', 'http://127.0.0.1:5173'],
      capabilityToken: 'local-token',
    });
  });

  it('fails production startup when the sidecar capability token is missing', () => {
    expect(() =>
      createSidecarSecurityOptions({
        NODE_ENV: 'production',
      })
    ).toThrow('EDUTRACK_SIDECAR_TOKEN is required in production.');
  });

  it('warns when sidecar capability checks are disabled outside production', () => {
    const warnings: string[] = [];

    expect(createSidecarSecurityOptions({}, (message) => warnings.push(message))).toEqual({
      allowedOrigins: ['http://127.0.0.1:5173', 'http://tauri.localhost', 'tauri://localhost'],
    });
    expect(warnings).toEqual([
      'EDUTRACK_SIDECAR_TOKEN is not set; local API capability checks are disabled outside production.',
    ]);
  });

  it('creates a sidecar ready payload for Tauri supervision', () => {
    expect(createSidecarReadyPayload('127.0.0.1', 49152)).toEqual({
      type: 'edutrack-sidecar-ready',
      host: '127.0.0.1',
      port: 49152,
      healthPath: '/health',
    });
  });
});
