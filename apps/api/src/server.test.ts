import { describe, expect, it } from 'vitest';
import { buildServer, createLoggerOptions, getListenOptions } from './server.js';

describe('api sidecar foundation', () => {
  it('returns the health response envelope', async () => {
    const server = buildServer({ logger: false });

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
    expect(loggerOptions.redact.paths).toContain('body.password');
  });

  it('binds to loopback by default', () => {
    expect(getListenOptions()).toEqual({
      host: '127.0.0.1',
      port: 0,
    });
  });
});
