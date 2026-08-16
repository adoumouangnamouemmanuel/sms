import type Database from 'better-sqlite3';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  openEduTrackDatabase,
  seedFoundation,
  type EduTrackDatabase,
  type EduTrackDatabaseConnection,
} from '@edutrack/db';
import { buildServer } from '../server.js';

const migrationsDir = fileURLToPath(
  new URL('../../../../packages/db/migrations/sqlite/', import.meta.url)
);

/**
 * Guards the global Fastify error and not-found handlers (audit B1): every
 * response must use the standard envelope so the web client can always parse
 * a uniform { success, error: { code, message } } shape, and internal errors
 * must never leak stack traces or raw messages.
 */
describe('server error handling', () => {
  let sqlite: Database.Database;
  let db: EduTrackDatabase;
  let connection: EduTrackDatabaseConnection;

  beforeEach(() => {
    connection = openEduTrackDatabase(':memory:');
    sqlite = connection.sqlite;
    sqlite.pragma('foreign_keys = ON');
    applyAllMigrations(sqlite);
    db = connection.db;
    seedFoundation(db);
  });

  afterEach(() => {
    connection.close();
  });

  it('returns the standard 404 envelope for unknown routes', async () => {
    const server = buildServer({
      databaseStatus: { sqlitePath: ':memory:', migrated: true, migrationId: 'probe' },
      database: db,
      logger: false,
      auth: { enabled: true, accessTokenSecret: 'server-errors-test-secret' },
      security: { allowedOrigins: ['tauri://localhost'] },
    });

    try {
      const response = await server.inject({ method: 'GET', url: '/no-such-route' });

      expect(response.statusCode).toBe(404);
      const body = readJson(response) as ApiFailure;
      expect(body).toMatchObject({
        success: false,
        error: { code: 'ROUTE_NOT_FOUND' },
      });
      expect(typeof body.error.message).toBe('string');
    } finally {
      await server.close();
    }
  });

  it('returns the standard 500 envelope without leaking internal details', async () => {
    const server = buildServer({
      databaseStatus: { sqlitePath: ':memory:', migrated: true, migrationId: 'probe' },
      database: db,
      logger: false,
      auth: { enabled: true, accessTokenSecret: 'server-errors-test-secret' },
      security: { allowedOrigins: ['tauri://localhost'] },
    });

    // A route that throws outside any controller try/catch exercises the global handler.
    server.get('/boom', () => {
      throw new Error('super-secret-internal-detail');
    });

    try {
      const response = await server.inject({ method: 'GET', url: '/boom' });

      expect(response.statusCode).toBe(500);
      const body = readJson(response) as ApiFailure;
      expect(body).toMatchObject({
        success: false,
        error: { code: 'INTERNAL_ERROR' },
      });
      expect(JSON.stringify(body)).not.toContain('super-secret-internal-detail');
      expect(JSON.stringify(body)).not.toContain('stack');
    } finally {
      await server.close();
    }
  });

  it('answers a 404 with the envelope even without a matching origin', async () => {
    const server = buildServer({
      databaseStatus: { sqlitePath: ':memory:', migrated: true, migrationId: 'probe' },
      database: db,
      logger: false,
      auth: { enabled: true, accessTokenSecret: 'server-errors-test-secret' },
      security: { allowedOrigins: ['tauri://localhost'] },
    });

    try {
      const response = await server.inject({
        method: 'GET',
        url: '/missing',
        headers: { origin: 'https://evil.example' },
      });

      expect(response.statusCode).toBe(403);
      const body = readJson(response) as ApiFailure;
      expect(body.error.code).toBe('UNEXPECTED_ORIGIN');
    } finally {
      await server.close();
    }
  });
});

function applyAllMigrations(sqlite: Database.Database) {
  const migrationFiles = readdirSync(migrationsDir)
    .filter((file) => file.endsWith('.sql'))
    .sort();

  for (const migrationFile of migrationFiles) {
    const migrationSql = readFileSync(join(migrationsDir, migrationFile), 'utf8');
    sqlite.exec(migrationSql.replaceAll('--> statement-breakpoint', '\n'));
  }
}

function readJson(response: { payload: string }) {
  return JSON.parse(response.payload) as unknown;
}

interface ApiFailure {
  success: false;
  error: {
    code: string;
    message: string;
  };
}
