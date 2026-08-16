import type Database from 'better-sqlite3';
import { randomUUID } from 'node:crypto';
import { readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  openEduTrackDatabase,
  seedFoundation,
  type EduTrackDatabase,
  type EduTrackDatabaseConnection,
} from '@edutrack/db';
import type { AuthTokenResponse, SetupStateResponse } from '@edutrack/shared';
import { buildServer } from '../server.js';
import { hashPassword } from '../modules/auth/index.js';

const migrationsDir = fileURLToPath(
  new URL('../../../../packages/db/migrations/sqlite/', import.meta.url)
);
const firstSchoolId = '00000000-0000-4000-8000-000000000101';
const schoolMasterId = '00000000-0000-4000-8000-000000000201';
const secondSchoolMasterId = '00000000-0000-4000-8000-000000000202';
const teacherId = '00000000-0000-4000-8000-000000000301';
const correctPassword = 'correct-password';
const accessTokenSecret = 'phase-2-setup-test-secret-with-local-only-scope';

let passwordHash: string;

describe('school setup routes', () => {
  let sqlite: Database.Database;
  let db: EduTrackDatabase;
  let connection: EduTrackDatabaseConnection;
  let server: ReturnType<typeof buildServer>;

  beforeAll(async () => {
    passwordHash = await hashPassword(correctPassword);
  });

  beforeEach(() => {
    connection = openEduTrackDatabase(':memory:');
    sqlite = connection.sqlite;
    sqlite.pragma('foreign_keys = ON');
    applyAllMigrations(sqlite);
    db = connection.db;
    seedFoundation(db);
    seedSetupFixture(sqlite);
    server = buildServer({
      databaseStatus: {
        sqlitePath: ':memory:',
        migrated: true,
        migrationId: 'deployment-probe-0001',
      },
      database: db,
      logger: false,
      auth: {
        accessTokenSecret,
      },
      security: {
        allowedOrigins: ['tauri://localhost'],
      },
    });
  });

  afterEach(async () => {
    await server.close();
    connection.close();
  });

  afterAll(() => {
    passwordHash = '';
  });

  it('saves each setup step and enables only implemented modules on completion, surviving application restarts', async () => {
    // Override the in-memory server and connection with a file-backed one for this test
    // to prove that setup steps survive an application restart.
    await server.close();
    connection.close();

    const dbPath = join(tmpdir(), `edutrack-setup-test-${randomUUID()}.sqlite`);
    connection = openEduTrackDatabase(dbPath);
    sqlite = connection.sqlite;
    sqlite.pragma('foreign_keys = ON');
    applyAllMigrations(sqlite);
    db = connection.db;
    seedFoundation(db);
    seedSetupFixture(sqlite);
    server = buildServer({
      databaseStatus: {
        sqlitePath: dbPath,
        migrated: true,
        migrationId: 'deployment-probe-0001',
      },
      database: db,
      logger: false,
      auth: {
        accessTokenSecret,
      },
      security: {
        allowedOrigins: ['tauri://localhost'],
      },
    });

    try {
      const accessToken = await loginAndReadAccessToken('directeur');

      const initialState = await injectSetupState(accessToken);
      expect(initialState.data.school.setupStatus).toBe('PENDING');
      expect(initialState.data.nextStep).toBe('profile');

      const profileState = await injectSetupRequest(accessToken, 'PUT', '/setup/profile', {
        name: 'Lycee Demo N Djamena',
        shortName: 'LDN',
        logoUrl: 'https://example.com/logo.png',
        address: 'Avenue Charles de Gaulle',
        city: 'N Djamena',
        phone: '+23500000001',
        email: '',
        motto: 'Travail et excellence',
        ministryCode: 'MEN-001',
      });
      expect(profileState.data.school.setupStatus).toBe('PROFILE_COMPLETED');
      expect(profileState.data.school.currency).toBe('XAF');
      expect(profileState.data.school.email).toBeNull();
      expect(profileState.data.nextStep).toBe('calendar');

      const calendarState = await injectSetupRequest(accessToken, 'PUT', '/setup/calendar', {
        academicYear: {
          label: '2026-2027',
          startDate: '2026-09-01',
          endDate: '2027-06-30',
        },
        termSystem: 'TRIMESTER',
        terms: [
          {
            label: 'Trimestre 1',
            termNumber: 1,
            startDate: '2026-09-01',
            endDate: '2026-12-20',
            isCurrent: true,
          },
          {
            label: 'Trimestre 2',
            termNumber: 2,
            startDate: '2027-01-05',
            endDate: '2027-03-31',
            isCurrent: false,
          },
          {
            label: 'Trimestre 3',
            termNumber: 3,
            startDate: '2027-04-01',
            endDate: '2027-06-30',
            isCurrent: false,
          },
        ],
      });
      expect(calendarState.data.school.setupStatus).toBe('CALENDAR_COMPLETED');
      expect(calendarState.data.terms).toHaveLength(3);
      expect(calendarState.data.terms.filter((term) => term.isCurrent)).toHaveLength(1);

      const classLevelsState = await injectSetupRequest(accessToken, 'PUT', '/setup/class-levels', {
        classLevels: [
          { code: '6e', name: 'Sixieme', displayOrder: 1, isExamYear: false },
          { code: '3e', name: 'Troisieme', displayOrder: 2, isExamYear: true },
        ],
      });
      expect(classLevelsState.data.school.setupStatus).toBe('CLASS_LEVELS_COMPLETED');
      expect(classLevelsState.data.classLevels.map((level) => level.code)).toEqual(['6E', '3E']);

      const completedState = await injectSetupRequest(accessToken, 'POST', '/setup/complete', {});
      expect(completedState.data.school.setupStatus).toBe('COMPLETED');
      expect(
        completedState.data.enabledModules.map((moduleConfig) => moduleConfig.moduleName)
      ).toEqual([
        'ACADEMIC_STRUCTURE',
        'CLASSES',
        'CONFIGURATION',
        'SCHOOL_SETUP',
        'STUDENTS',
        'TEACHERS',
      ]);

      expect(readCount('academic_year', 'is_current = 1')).toBe(1);
      expect(readCount('term', 'is_current = 1')).toBe(1);
      expect(readCount('school_module_config', 'is_enabled = 1')).toBe(6);
      expect(readLatestAuditAction()).toBe('SETUP_COMPLETE');

      // Simulate application restart
      await server.close();
      connection.close();

      connection = openEduTrackDatabase(dbPath);
      sqlite = connection.sqlite;
      db = connection.db;

      server = buildServer({
        databaseStatus: {
          sqlitePath: dbPath,
          migrated: true,
          migrationId: 'deployment-probe-0001',
        },
        database: db,
        logger: false,
        auth: {
          accessTokenSecret,
        },
        security: {
          allowedOrigins: ['tauri://localhost'],
        },
      });

      const newAccessToken = await loginAndReadAccessToken('directeur');
      const restartedState = await injectSetupState(newAccessToken);

      expect(restartedState.data.school.setupStatus).toBe('COMPLETED');
      expect(restartedState.data.school.name).toBe('Lycee Demo N Djamena');
      expect(restartedState.data.terms).toHaveLength(3);
      expect(restartedState.data.classLevels).toHaveLength(2);
    } finally {
      try {
        await server.close();
        connection.close();
        rmSync(dbPath, { force: true });
      } catch {
        // ignore cleanup errors
      }

      // Restore dummy in-memory connection so afterEach doesn't fail
      connection = openEduTrackDatabase(':memory:');
      server = buildServer({
        databaseStatus: { sqlitePath: ':memory:', migrated: true, migrationId: 'x' },
        database: connection.db,
        logger: false,
        auth: { accessTokenSecret },
        security: { allowedOrigins: [] },
      });
    }
  });

  it('denies setup access to teachers', async () => {
    const teacherAccessToken = await loginAndReadAccessToken('enseignant');
    const response = await server.inject({
      method: 'GET',
      url: '/setup/state',
      headers: {
        authorization: `Bearer ${teacherAccessToken}`,
      },
    });

    expect(response.statusCode).toBe(403);
    expect(readJson(response) as ApiError).toMatchObject({
      success: false,
      error: {
        code: 'FORBIDDEN',
      },
    });
  });

  it('isolates setup state between different schools', async () => {
    const school1Token = await loginAndReadAccessToken('directeur', 'NDS-DEMO');
    const school2Token = await loginAndReadAccessToken('directeur', 'MND-DEMO');

    // School 1 sets up profile
    await injectSetupRequest(school1Token, 'PUT', '/setup/profile', {
      name: 'School One',
      shortName: 'S1',
      city: 'City One',
    });

    // School 2 fetches state, should still be PENDING
    const school2State = await injectSetupState(school2Token);
    expect(school2State.data.school.setupStatus).toBe('PENDING');
    expect(school2State.data.school.name).not.toBe('School One');

    // School 1 fetches state, should be PROFILE_COMPLETED
    const school1State = await injectSetupState(school1Token);
    expect(school1State.data.school.setupStatus).toBe('PROFILE_COMPLETED');
    expect(school1State.data.school.name).toBe('School One');
  });

  it('rejects overlapping setup terms before persistence', async () => {
    const accessToken = await loginAndReadAccessToken('directeur');

    await injectSetupRequest(accessToken, 'PUT', '/setup/profile', {
      name: 'Lycee Demo',
      city: 'N Djamena',
    });

    const response = await server.inject({
      method: 'PUT',
      url: '/setup/calendar',
      headers: {
        authorization: `Bearer ${accessToken}`,
      },
      payload: {
        academicYear: {
          label: '2026-2027',
          startDate: '2026-09-01',
          endDate: '2027-06-30',
        },
        termSystem: 'SEMESTER',
        terms: [
          {
            label: 'Semestre 1',
            termNumber: 1,
            startDate: '2026-09-01',
            endDate: '2027-01-31',
            isCurrent: true,
          },
          {
            label: 'Semestre 2',
            termNumber: 2,
            startDate: '2027-01-15',
            endDate: '2027-06-30',
            isCurrent: false,
          },
        ],
      },
    });

    expect(response.statusCode).toBe(400);
    expect(readJson(response) as ApiError).toMatchObject({
      success: false,
      error: {
        code: 'INVALID_TERMS',
      },
    });
    expect(readCount('term')).toBe(0);
  });

  async function loginAndReadAccessToken(username: string, schoolCode = 'NDS-DEMO') {
    const response = await server.inject({
      method: 'POST',
      url: '/auth/login',
      payload: {
        schoolCode,
        username,
        password: correctPassword,
        deviceName: 'Vitest',
      },
    });

    expect(response.statusCode).toBe(200);
    return (readJson(response) as ApiSuccess<AuthTokenResponse>).data.accessToken;
  }

  async function injectSetupState(accessToken: string) {
    const response = await server.inject({
      method: 'GET',
      url: '/setup/state',
      headers: {
        authorization: `Bearer ${accessToken}`,
      },
    });

    expect(response.statusCode).toBe(200);
    return readJson(response) as ApiSuccess<SetupStateResponse>;
  }

  async function injectSetupRequest(
    accessToken: string,
    method: 'POST' | 'PUT',
    url: string,
    payload: Record<string, unknown>
  ) {
    const response = await server.inject({
      method,
      url,
      headers: {
        authorization: `Bearer ${accessToken}`,
      },
      payload,
    });

    expect(response.statusCode).toBe(200);
    return readJson(response) as ApiSuccess<SetupStateResponse>;
  }

  function readCount(
    tableName: 'academic_year' | 'school_module_config' | 'term',
    where = '1 = 1'
  ) {
    const row = sqlite
      .prepare(`SELECT COUNT(*) AS value FROM ${tableName} WHERE ${where}`)
      .get() as {
      value: number;
    };

    return row.value;
  }

  function readLatestAuditAction() {
    const row = sqlite
      .prepare(
        `
          SELECT action
          FROM audit_log
          WHERE school_id = ?
          ORDER BY rowid DESC
          LIMIT 1
        `
      )
      .get(firstSchoolId) as { action: string } | undefined;

    return row?.action;
  }
});

function seedSetupFixture(sqlite: Database.Database) {
  sqlite
    .prepare(
      `
        UPDATE user
        SET password_hash = ?, failed_login_attempts = 0, locked_until = NULL
        WHERE id = ? OR id = ?
      `
    )
    .run(passwordHash, schoolMasterId, secondSchoolMasterId);

  sqlite
    .prepare(
      `
        INSERT INTO user (id, school_id, username, password_hash, role)
        VALUES (?, ?, ?, ?, ?)
      `
    )
    .run(teacherId, firstSchoolId, 'enseignant', passwordHash, 'TEACHER');
}

function readJson(response: { body: string }) {
  const parsed: unknown = JSON.parse(response.body);

  return parsed;
}

function applyAllMigrations(sqlite: Database.Database) {
  const migrationFiles = readdirSync(migrationsDir)
    .filter((file) => file.endsWith('.sql'))
    .sort();

  for (const migrationFile of migrationFiles) {
    applyMigration(sqlite, migrationFile);
  }
}

function applyMigration(sqlite: Database.Database, fileName: string) {
  const migrationSql = readFileSync(join(migrationsDir, fileName), 'utf8');
  sqlite.exec(migrationSql.replaceAll('--> statement-breakpoint', '\n'));
}

interface ApiSuccess<T> {
  success: true;
  data: T;
}

interface ApiError {
  success: false;
  error: {
    code: string;
  };
}
