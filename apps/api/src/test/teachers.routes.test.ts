import type Database from 'better-sqlite3';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  openEduTrackDatabase,
  seedFoundation,
  type EduTrackDatabase,
  type EduTrackDatabaseConnection,
} from '@edutrack/db';
import type {
  AuthTokenResponse,
  PaginatedTeachersResponse,
  TeacherLoginCreatedResponse,
  TeacherProfileResponse,
  TeacherResponse,
} from '@edutrack/shared';
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
const accessTokenSecret = 'phase-3-teachers-test-secret-with-local-only-scope';
const fixedNow = () => new Date('2026-08-15T10:00:00.000Z');

let passwordHash: string;

describe('teachers routes', () => {
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
    seedTeachersFixture(sqlite);
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
        now: fixedNow,
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

  it('creates a teacher with a generated code when none is provided', async () => {
    const accessToken = await loginAndReadAccessToken('directeur');
    const response = await server.inject({
      method: 'POST',
      url: '/teachers',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: {
        firstName: 'Ibrahim',
        lastName: 'Ousmane',
        specialization: 'Mathematiques',
        hireDate: '2020-10-01',
      },
    });

    expect(response.statusCode).toBe(200);
    const body = readJson(response) as ApiSuccess<TeacherResponse>;
    expect(body.data).toMatchObject({
      schoolId: firstSchoolId,
      code: 'NDS-DEMO-2026-001',
      firstName: 'Ibrahim',
      lastName: 'Ousmane',
      specialization: 'Mathematiques',
      hireDate: '2020-10-01',
      userId: null,
      isActive: true,
    });
    expect(findLatestAuditAction()).toBe('TEACHER_CREATE');
  });

  it('creates a teacher with an explicit code, uppercasing it, and rejects duplicates', async () => {
    const accessToken = await loginAndReadAccessToken('directeur');
    const first = await server.inject({
      method: 'POST',
      url: '/teachers',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { code: 'nds-demo-2026-x777', firstName: 'Ibrahim', lastName: 'Ousmane' },
    });

    expect((readJson(first) as ApiSuccess<TeacherResponse>).data.code).toBe('NDS-DEMO-2026-X777');

    const duplicate = await server.inject({
      method: 'POST',
      url: '/teachers',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { code: 'NDS-DEMO-2026-X777', firstName: 'Ali', lastName: 'Ahmat' },
    });

    expect(duplicate.statusCode).toBe(409);
    expect(readJson(duplicate) as ApiError).toMatchObject({
      success: false,
      error: { code: 'TEACHER_CODE_EXISTS' },
    });
  });

  it('lists teachers with search, pagination, and the archived status filter', async () => {
    const accessToken = await loginAndReadAccessToken('directeur');
    const first = await createTeacher(accessToken, 'Ibrahim', 'Ousmane');
    const second = await createTeacher(accessToken, 'Fatime', 'Abakar');
    await server.inject({
      method: 'POST',
      url: `/teachers/${first.id}/archive`,
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { reason: 'Fin de contrat' },
    });

    const active = await server.inject({
      method: 'GET',
      url: '/teachers',
      headers: { authorization: `Bearer ${accessToken}` },
    });
    const activeBody = readJson(active) as ApiSuccess<PaginatedTeachersResponse>;
    expect(activeBody.data.total).toBe(1);
    expect(activeBody.data.items[0]?.id).toBe(second.id);

    const archived = await server.inject({
      method: 'GET',
      url: '/teachers?status=archived',
      headers: { authorization: `Bearer ${accessToken}` },
    });
    const archivedBody = readJson(archived) as ApiSuccess<PaginatedTeachersResponse>;
    expect(archivedBody.data.total).toBe(1);
    expect(archivedBody.data.items[0]?.id).toBe(first.id);

    const searched = await server.inject({
      method: 'GET',
      url: '/teachers?search=Ousmane',
      headers: { authorization: `Bearer ${accessToken}` },
    });
    const searchedBody = readJson(searched) as ApiSuccess<PaginatedTeachersResponse>;
    expect(searchedBody.data.total).toBe(0);
  });

  it('updates only the provided teacher fields and audits the change', async () => {
    const accessToken = await loginAndReadAccessToken('directeur');
    const created = await createTeacher(accessToken, 'Ibrahim', 'Ousmane');

    const response = await server.inject({
      method: 'PUT',
      url: `/teachers/${created.id}`,
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { lastName: 'Ahmat', phone: '+23500000020' },
    });

    expect(response.statusCode).toBe(200);
    const body = readJson(response) as ApiSuccess<TeacherResponse>;
    expect(body.data).toMatchObject({ lastName: 'Ahmat', phone: '+23500000020' });
    expect(body.data.firstName).toBe('Ibrahim');
    expect(body.data.code).toBe(created.code);
    expect(body.data.recordVersion).toBe(2);
    expect(findLatestAuditAction()).toBe('TEACHER_UPDATE');
  });

  it('archives and reactivates a teacher with an audit reason', async () => {
    const accessToken = await loginAndReadAccessToken('directeur');
    const created = await createTeacher(accessToken, 'Ibrahim', 'Ousmane');

    const archived = await server.inject({
      method: 'POST',
      url: `/teachers/${created.id}/archive`,
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { reason: 'Fin de contrat' },
    });

    expect(archived.statusCode).toBe(200);
    expect((readJson(archived) as ApiSuccess<TeacherResponse>).data.isActive).toBe(false);
    expect(findLatestAuditEvent('TEACHER_ARCHIVE')?.metadata_json).toContain('Fin de contrat');

    const reactivated = await server.inject({
      method: 'POST',
      url: `/teachers/${created.id}/reactivate`,
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { reason: 'Reembauche' },
    });

    expect(reactivated.statusCode).toBe(200);
    expect((readJson(reactivated) as ApiSuccess<TeacherResponse>).data.isActive).toBe(true);
    expect(findLatestAuditAction()).toBe('TEACHER_REACTIVATE');
  });

  it('creates a login account with generated credentials that actually work', async () => {
    const accessToken = await loginAndReadAccessToken('directeur');
    const teacher = await createTeacher(accessToken, 'Fatime', 'Abakar');

    const created = await server.inject({
      method: 'POST',
      url: `/teachers/${teacher.id}/login`,
      headers: { authorization: `Bearer ${accessToken}` },
      payload: {},
    });

    expect(created.statusCode).toBe(200);
    const body = readJson(created) as ApiSuccess<TeacherLoginCreatedResponse>;
    expect(body.data.username).toBe('fatime.abakar');
    expect(body.data.initialPassword).toHaveLength(12);
    expect(findLatestAuditAction()).toBe('TEACHER_LOGIN_CREATE');

    const login = await server.inject({
      method: 'POST',
      url: '/auth/login',
      payload: {
        schoolCode: 'NDS-DEMO',
        username: body.data.username,
        password: body.data.initialPassword,
        deviceName: 'Vitest',
      },
    });
    expect(login.statusCode).toBe(200);
    expect((readJson(login) as ApiSuccess<AuthTokenResponse>).data.user.role).toBe('TEACHER');
  });

  it('refuses a second login, a login on an archived record, and login ops on a foreign teacher', async () => {
    const accessToken = await loginAndReadAccessToken('directeur');
    const otherSchoolToken = await loginAndReadAccessToken('directeur', 'MND-DEMO');
    const teacher = await createTeacher(accessToken, 'Fatime', 'Abakar');

    await server.inject({
      method: 'POST',
      url: `/teachers/${teacher.id}/login`,
      headers: { authorization: `Bearer ${accessToken}` },
      payload: {},
    });

    const duplicate = await server.inject({
      method: 'POST',
      url: `/teachers/${teacher.id}/login`,
      headers: { authorization: `Bearer ${accessToken}` },
      payload: {},
    });
    expect(duplicate.statusCode).toBe(409);
    expect(readJson(duplicate) as ApiError).toMatchObject({
      success: false,
      error: { code: 'TEACHER_LOGIN_EXISTS' },
    });

    const other = await createTeacher(accessToken, 'Ibrahim', 'Ousmane');
    await server.inject({
      method: 'POST',
      url: `/teachers/${other.id}/archive`,
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { reason: 'Fin de contrat' },
    });
    const archivedLogin = await server.inject({
      method: 'POST',
      url: `/teachers/${other.id}/login`,
      headers: { authorization: `Bearer ${accessToken}` },
      payload: {},
    });
    expect(archivedLogin.statusCode).toBe(409);
    expect(readJson(archivedLogin) as ApiError).toMatchObject({
      success: false,
      error: { code: 'TEACHER_LOGIN_REQUIRES_ACTIVE_RECORD' },
    });

    const foreignLogin = await server.inject({
      method: 'POST',
      url: `/teachers/${teacher.id}/login`,
      headers: { authorization: `Bearer ${otherSchoolToken}` },
      payload: {},
    });
    expect(foreignLogin.statusCode).toBe(404);
    expect(readJson(foreignLogin) as ApiError).toMatchObject({
      success: false,
      error: { code: 'TEACHER_NOT_FOUND' },
    });
  });

  it('deactivates a login so the teacher can no longer authenticate, then reactivates it', async () => {
    const accessToken = await loginAndReadAccessToken('directeur');
    const teacher = await createTeacher(accessToken, 'Fatime', 'Abakar');
    const created = await server.inject({
      method: 'POST',
      url: `/teachers/${teacher.id}/login`,
      headers: { authorization: `Bearer ${accessToken}` },
      payload: {},
    });
    const credentials = (readJson(created) as ApiSuccess<TeacherLoginCreatedResponse>).data;

    const deactivated = await server.inject({
      method: 'POST',
      url: `/teachers/${teacher.id}/login/deactivate`,
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { reason: 'Compte inutilise' },
    });
    expect(deactivated.statusCode).toBe(200);
    expect((readJson(deactivated) as ApiSuccess<TeacherProfileResponse>).data.login).toMatchObject({
      username: 'fatime.abakar',
      isActive: false,
    });
    expect(findLatestAuditEvent('TEACHER_LOGIN_DEACTIVATE')?.metadata_json).toContain(
      'Compte inutilise'
    );

    const failedLogin = await server.inject({
      method: 'POST',
      url: '/auth/login',
      payload: {
        schoolCode: 'NDS-DEMO',
        username: credentials.username,
        password: credentials.initialPassword,
        deviceName: 'Vitest',
      },
    });
    expect(failedLogin.statusCode).toBe(401);

    const reactivated = await server.inject({
      method: 'POST',
      url: `/teachers/${teacher.id}/login/reactivate`,
      headers: { authorization: `Bearer ${accessToken}` },
      payload: {},
    });
    expect(reactivated.statusCode).toBe(200);
    expect((readJson(reactivated) as ApiSuccess<TeacherProfileResponse>).data.login?.isActive).toBe(
      true
    );

    const successfulLogin = await server.inject({
      method: 'POST',
      url: '/auth/login',
      payload: {
        schoolCode: 'NDS-DEMO',
        username: credentials.username,
        password: credentials.initialPassword,
        deviceName: 'Vitest',
      },
    });
    expect(successfulLogin.statusCode).toBe(200);
  });

  it('suffixes colliding usernames and keeps the record status independent of the account', async () => {
    const accessToken = await loginAndReadAccessToken('directeur');
    const first = await createTeacher(accessToken, 'Fatime', 'Abakar');
    const second = await createTeacher(accessToken, 'Fatime', 'Abakar');

    const firstLogin = await server.inject({
      method: 'POST',
      url: `/teachers/${first.id}/login`,
      headers: { authorization: `Bearer ${accessToken}` },
      payload: {},
    });
    const secondLogin = await server.inject({
      method: 'POST',
      url: `/teachers/${second.id}/login`,
      headers: { authorization: `Bearer ${accessToken}` },
      payload: {},
    });

    expect((readJson(firstLogin) as ApiSuccess<TeacherLoginCreatedResponse>).data.username).toBe(
      'fatime.abakar'
    );
    expect((readJson(secondLogin) as ApiSuccess<TeacherLoginCreatedResponse>).data.username).toBe(
      'fatime.abakar2'
    );

    await server.inject({
      method: 'POST',
      url: `/teachers/${first.id}/archive`,
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { reason: 'Fin de contrat' },
    });

    const profile = await server.inject({
      method: 'GET',
      url: `/teachers/${first.id}`,
      headers: { authorization: `Bearer ${accessToken}` },
    });
    const body = readJson(profile) as ApiSuccess<TeacherProfileResponse>;
    expect(body.data.teacher.isActive).toBe(false);
    // Archiving the record does not touch the login account.
    expect(body.data.login?.isActive).toBe(true);
  });

  it('rejects teacher operations for a TEACHER account', async () => {
    const accessToken = await loginAndReadAccessToken('enseignant');

    const response = await server.inject({
      method: 'POST',
      url: '/teachers',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { firstName: 'Ibrahim', lastName: 'Ousmane' },
    });

    expect(response.statusCode).toBe(403);
    expect(readJson(response) as ApiError).toMatchObject({
      success: false,
      error: { code: 'FORBIDDEN' },
    });
  });

  it('isolates teachers across schools', async () => {
    const accessToken = await loginAndReadAccessToken('directeur');
    const teacher = await createTeacher(accessToken, 'Ibrahim', 'Ousmane');
    const otherSchoolToken = await loginAndReadAccessToken('directeur', 'MND-DEMO');

    const foreignRead = await server.inject({
      method: 'GET',
      url: `/teachers/${teacher.id}`,
      headers: { authorization: `Bearer ${otherSchoolToken}` },
    });

    expect(foreignRead.statusCode).toBe(404);
    expect(readJson(foreignRead) as ApiError).toMatchObject({
      success: false,
      error: { code: 'TEACHER_NOT_FOUND' },
    });
  });

  async function createTeacher(accessToken: string, firstName: string, lastName: string) {
    const response = await server.inject({
      method: 'POST',
      url: '/teachers',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { firstName, lastName },
    });

    expect(response.statusCode).toBe(200);
    return (readJson(response) as ApiSuccess<TeacherResponse>).data;
  }

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

  function findLatestAuditAction() {
    return findLatestAuditEvent()?.action;
  }

  function findLatestAuditEvent(action?: string) {
    const row = sqlite
      .prepare(
        `
          SELECT action, metadata_json
          FROM audit_log
          WHERE school_id = ?
          ${action ? 'AND action = ?' : ''}
          ORDER BY rowid DESC
          LIMIT 1
        `
      )
      .get(...(action ? [firstSchoolId, action] : [firstSchoolId])) as
      { action: string; metadata_json: string } | undefined;

    return row;
  }
});

function seedTeachersFixture(sqlite: Database.Database) {
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
  return JSON.parse(response.body) as unknown;
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
    fields?: Record<string, string>;
  };
}
