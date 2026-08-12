import { describe, expect, it } from 'vitest';
import {
  buildServer,
  createLoggerOptions,
  createSidecarReadyPayload,
  createSidecarSecurityOptions,
  getListenOptions,
} from './server.js';

const databaseStatus = {
  sqlitePath: 'C:\\Users\\Test\\AppData\\Roaming\\EduTrack\\edutrack.sqlite',
  migrated: true,
  migrationId: 'deployment-probe-0001',
};

describe('api sidecar foundation', () => {
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

  it('redacts sensitive fields from logs by default', () => {
    const loggerOptions = createLoggerOptions();

    expect(loggerOptions).toMatchObject({
      redact: {
        censor: '[redacted]',
      },
    });
    expect(loggerOptions.redact.paths).toContain('req.headers.authorization');
    expect(loggerOptions.redact.paths).toContain('req.headers.cookie');
    expect(loggerOptions.redact.paths).toContain("req.headers['x-edutrack-capability']");
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

    const response = await server.inject({
      method: 'GET',
      url: '/health',
      headers: {
        origin: 'tauri://localhost',
      },
    });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toMatchObject({
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
        'x-edutrack-capability': 'expected-token',
      },
    });

    expect(response.statusCode).toBe(200);
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

  it('creates a sidecar ready payload for Tauri supervision', () => {
    expect(createSidecarReadyPayload('127.0.0.1', 49152)).toEqual({
      type: 'edutrack-sidecar-ready',
      host: '127.0.0.1',
      port: 49152,
      healthPath: '/health',
    });
  });
});
