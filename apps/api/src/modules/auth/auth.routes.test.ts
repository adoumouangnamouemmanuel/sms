import type Database from 'better-sqlite3';
import { readFileSync, readdirSync } from 'node:fs';
import type { OutgoingHttpHeaders } from 'node:http';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { BCRYPT_COST, REFRESH_TOKEN_TTL_SECONDS, hashPassword, hashToken } from './index.js';
import { buildServer } from '../../server.js';
import {
  openEduTrackDatabase,
  seedFoundation,
  type EduTrackDatabase,
  type EduTrackDatabaseConnection,
} from '@edutrack/db';
import type { AuthTokenResponse } from '@edutrack/shared';

const migrationsDir = fileURLToPath(
  new URL('../../../../../packages/db/migrations/sqlite/', import.meta.url)
);
const firstSchoolId = '00000000-0000-4000-8000-000000000101';
const schoolMasterId = '00000000-0000-4000-8000-000000000201';
const secondSchoolMasterId = '00000000-0000-4000-8000-000000000202';
const teacherId = '00000000-0000-4000-8000-000000000301';
const correctPassword = 'correct-password';
const changedPassword = 'changed-password';
const newTeacherPassword = 'teacher-password';
const accessTokenSecret = 'phase-2-auth-test-secret-with-local-only-scope';

let passwordHash: string;

describe('local auth routes', () => {
  let sqlite: Database.Database;
  let db: EduTrackDatabase;
  let connection: EduTrackDatabaseConnection;
  let server: ReturnType<typeof buildServer>;
  let currentTime: Date;

  beforeAll(async () => {
    passwordHash = await hashPassword(correctPassword);
  });

  beforeEach(() => {
    currentTime = new Date('2026-08-13T10:00:00.000Z');
    connection = openEduTrackDatabase(':memory:');
    sqlite = connection.sqlite;
    sqlite.pragma('foreign_keys = ON');
    applyAllMigrations(sqlite);
    db = connection.db;
    seedFoundation(db);
    seedAuthFixture(sqlite);
    server = buildServer({
      databaseStatus: {
        sqlitePath: ':memory:',
        migrated: true,
      },
      database: db,
      logger: false,
      auth: {
        accessTokenSecret,
        now: () => currentTime,
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

  it('logs in a SchoolMaster, sets an httpOnly refresh cookie and audits success', async () => {
    const response = await loginAsSchoolMaster();
    const body = response.json<ApiSuccess<AuthTokenResponse>>();
    const sessionCount = sqlite.prepare('SELECT COUNT(*) AS value FROM refresh_session').get() as {
      value: number;
    };
    const auditEvent = findLatestAuditEvent('AUTH_LOGIN');

    expect(response.statusCode).toBe(200);
    expect(body.data.user).toEqual({
      id: schoolMasterId,
      schoolId: firstSchoolId,
      username: 'directeur',
      role: 'SCHOOL_MASTER',
    });
    expect(body.data.accessToken).toEqual(expect.any(String));
    expect(body.data).not.toHaveProperty('refreshToken');
    expect(readSetCookie(response)).toContain('HttpOnly');
    expect(readSetCookie(response)).toContain('SameSite=Strict');
    expect(readSetCookie(response)).toContain(`Max-Age=${String(REFRESH_TOKEN_TTL_SECONDS)}`);
    expect(sessionCount.value).toBe(1);
    expect(auditEvent).toMatchObject({
      schoolId: firstSchoolId,
      actorUserId: schoolMasterId,
      outcome: 'SUCCESS',
    });
  });

  it('rotates refresh sessions and rejects reuse of an old refresh token', async () => {
    const loginResponse = await loginAsSchoolMaster();
    const oldRefreshCookie = readRefreshCookiePair(loginResponse);
    const oldRefreshToken = decodeURIComponent(oldRefreshCookie.split('=')[1] ?? '');

    const refreshResponse = await server.inject({
      method: 'POST',
      url: '/auth/refresh',
      headers: {
        cookie: oldRefreshCookie,
      },
    });
    const newRefreshCookie = readRefreshCookiePair(refreshResponse);

    expect(refreshResponse.statusCode).toBe(200);
    expect(newRefreshCookie).not.toBe(oldRefreshCookie);

    const oldSession = sqlite
      .prepare(
        `
          SELECT revoked_at AS revokedAt, replaced_by_session_id AS replacedBySessionId
          FROM refresh_session
          WHERE token_hash = ?
        `
      )
      .get(hashToken(oldRefreshToken)) as RefreshSessionProbe | undefined;

    expect(oldSession?.revokedAt).toBe(currentTime.toISOString());
    expect(oldSession?.replacedBySessionId).toEqual(expect.any(String));

    const reuseResponse = await server.inject({
      method: 'POST',
      url: '/auth/refresh',
      headers: {
        cookie: oldRefreshCookie,
      },
    });

    expect(reuseResponse.statusCode).toBe(401);
    expect(reuseResponse.json<ApiError>()).toMatchObject({
      success: false,
      error: {
        code: 'INVALID_REFRESH_SESSION',
      },
    });
  });

  it('locks an account for 15 minutes after five failed login attempts', async () => {
    for (const attempt of [1, 2, 3, 4]) {
      const response = await loginWithPassword('wrong-password');

      expect(response.statusCode, `attempt ${String(attempt)}`).toBe(401);
    }

    const lockResponse = await loginWithPassword('wrong-password');
    const lockedUser = sqlite
      .prepare(
        `
          SELECT failed_login_attempts AS failedLoginAttempts, locked_until AS lockedUntil
          FROM user
          WHERE id = ?
        `
      )
      .get(schoolMasterId) as LockedUserProbe | undefined;

    expect(lockResponse.statusCode).toBe(423);
    expect(lockedUser?.failedLoginAttempts).toBe(5);
    expect(lockedUser?.lockedUntil).toBe('2026-08-13T10:15:00.000Z');

    const correctPasswordResponse = await loginWithPassword(correctPassword);

    expect(correctPasswordResponse.statusCode).toBe(423);
  });

  it('changes a password, revokes refresh sessions and allows the new password only', async () => {
    const loginResponse = await loginAsSchoolMaster();
    const accessToken = loginResponse.json<ApiSuccess<AuthTokenResponse>>().data.accessToken;
    const refreshCookie = readRefreshCookiePair(loginResponse);

    const changeResponse = await server.inject({
      method: 'POST',
      url: '/auth/password/change',
      headers: {
        authorization: `Bearer ${accessToken}`,
        cookie: refreshCookie,
      },
      payload: {
        currentPassword: correctPassword,
        newPassword: changedPassword,
      },
    });

    expect(changeResponse.statusCode).toBe(200);
    expect(readSetCookie(changeResponse)).toContain('Max-Age=0');

    const refreshResponse = await server.inject({
      method: 'POST',
      url: '/auth/refresh',
      headers: {
        cookie: refreshCookie,
      },
    });
    const oldPasswordResponse = await loginWithPassword(correctPassword);
    const newPasswordResponse = await loginWithPassword(changedPassword);

    expect(refreshResponse.statusCode).toBe(401);
    expect(oldPasswordResponse.statusCode).toBe(401);
    expect(newPasswordResponse.statusCode).toBe(200);
  });

  it('allows SchoolMaster password reset only inside the authenticated school', async () => {
    const schoolMasterLogin = await loginAsSchoolMaster();
    const schoolMasterToken =
      schoolMasterLogin.json<ApiSuccess<AuthTokenResponse>>().data.accessToken;
    const teacherLogin = await loginAsTeacher();
    const teacherToken = teacherLogin.json<ApiSuccess<AuthTokenResponse>>().data.accessToken;

    const teacherResetResponse = await server.inject({
      method: 'POST',
      url: `/auth/users/${schoolMasterId}/password/reset`,
      headers: {
        authorization: `Bearer ${teacherToken}`,
      },
      payload: {
        newPassword: newTeacherPassword,
      },
    });
    const crossSchoolResetResponse = await server.inject({
      method: 'POST',
      url: `/auth/users/${secondSchoolMasterId}/password/reset`,
      headers: {
        authorization: `Bearer ${schoolMasterToken}`,
      },
      payload: {
        newPassword: newTeacherPassword,
      },
    });
    const schoolMasterResetResponse = await server.inject({
      method: 'POST',
      url: `/auth/users/${teacherId}/password/reset`,
      headers: {
        authorization: `Bearer ${schoolMasterToken}`,
      },
      payload: {
        newPassword: newTeacherPassword,
      },
    });
    const teacherNewPasswordResponse = await loginWithPassword(newTeacherPassword, {
      username: 'enseignant',
    });

    expect(teacherResetResponse.statusCode).toBe(403);
    expect(crossSchoolResetResponse.statusCode).toBe(404);
    expect(schoolMasterResetResponse.statusCode).toBe(200);
    expect(teacherNewPasswordResponse.statusCode).toBe(200);
  });

  it('hashes new passwords with bcrypt cost 12', async () => {
    const hash = await hashPassword('minimum-eight');

    expect(hash.startsWith(`$2b$${String(BCRYPT_COST)}$`)).toBe(true);
  });

  async function loginAsSchoolMaster() {
    return loginWithPassword(correctPassword);
  }

  async function loginAsTeacher() {
    return loginWithPassword(correctPassword, {
      username: 'enseignant',
    });
  }

  async function loginWithPassword(
    password: string,
    overrides: Partial<{ schoolCode: string; username: string }> = {}
  ) {
    return server.inject({
      method: 'POST',
      url: '/auth/login',
      payload: {
        schoolCode: overrides.schoolCode ?? 'NDS-DEMO',
        username: overrides.username ?? 'directeur',
        password,
        deviceName: 'Vitest',
      },
    });
  }

  function findLatestAuditEvent(action: string) {
    return sqlite
      .prepare(
        `
          SELECT school_id AS schoolId, actor_user_id AS actorUserId, outcome
          FROM audit_log
          WHERE action = ?
          ORDER BY occurred_at DESC
          LIMIT 1
        `
      )
      .get(action);
  }
});

function seedAuthFixture(sqlite: Database.Database) {
  sqlite
    .prepare(
      `
        UPDATE user
        SET password_hash = ?, failed_login_attempts = 0, locked_until = NULL
        WHERE id = ?
      `
    )
    .run(passwordHash, schoolMasterId);
  sqlite
    .prepare(
      `
        UPDATE user
        SET password_hash = ?, failed_login_attempts = 0, locked_until = NULL
        WHERE id = ?
      `
    )
    .run(passwordHash, secondSchoolMasterId);
  sqlite
    .prepare(
      `
        INSERT INTO user (id, school_id, username, password_hash, role)
        VALUES (?, ?, ?, ?, ?)
      `
    )
    .run(teacherId, firstSchoolId, 'enseignant', passwordHash, 'TEACHER');
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

function readRefreshCookiePair(response: { headers: OutgoingHttpHeaders }) {
  return readSetCookie(response).split(';')[0] ?? '';
}

function readSetCookie(response: { headers: OutgoingHttpHeaders }) {
  const header = response.headers['set-cookie'];

  if (Array.isArray(header)) {
    return header[0] ?? '';
  }

  return typeof header === 'string' ? header : '';
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

interface RefreshSessionProbe {
  revokedAt: string | null;
  replacedBySessionId: string | null;
}

interface LockedUserProbe {
  failedLoginAttempts: number;
  lockedUntil: string | null;
}
