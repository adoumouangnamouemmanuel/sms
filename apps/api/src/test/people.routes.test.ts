import type Database from 'better-sqlite3';
import { randomUUID } from 'node:crypto';
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
  GuardianProfileResponse,
  PaginatedGuardiansResponse,
  PaginatedStudentsResponse,
  StudentGuardianLinkResponse,
  StudentProfileResponse,
  StudentResponse,
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
const accessTokenSecret = 'phase-3-people-test-secret-with-local-only-scope';
const fixedNow = () => new Date('2026-08-15T10:00:00.000Z');

let passwordHash: string;

describe('people routes', () => {
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
    seedPeopleFixture(sqlite);
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

  it('creates a student with a generated code when none is provided', async () => {
    const accessToken = await loginAndReadAccessToken('directeur');
    const response = await server.inject({
      method: 'POST',
      url: '/students',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: {
        firstName: 'Aminata',
        lastName: 'Mahamat',
        sex: 'F',
        dateOfBirth: '2012-03-14',
        nationality: 'Tchadienne',
      },
    });

    expect(response.statusCode).toBe(200);
    const body = readJson(response) as ApiSuccess<StudentResponse>;
    expect(body.data).toMatchObject({
      schoolId: firstSchoolId,
      code: 'NDS-DEMO-2026-001',
      firstName: 'Aminata',
      lastName: 'Mahamat',
      sex: 'F',
      dateOfBirth: '2012-03-14',
      nationality: 'Tchadienne',
      isActive: true,
    });
    expect(findLatestAuditAction()).toBe('STUDENT_CREATE');
  });

  it('creates a student with an explicit code, uppercasing it, and rejects duplicates', async () => {
    const accessToken = await loginAndReadAccessToken('directeur');
    const first = await server.inject({
      method: 'POST',
      url: '/students',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { code: 'nds-demo-2026-x12345', firstName: 'Ibrahim', lastName: 'Ousmane' },
    });

    expect((readJson(first) as ApiSuccess<StudentResponse>).data.code).toBe('NDS-DEMO-2026-X12345');

    const duplicate = await server.inject({
      method: 'POST',
      url: '/students',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { code: 'NDS-DEMO-2026-X12345', firstName: 'Fatime', lastName: 'Ousmane' },
    });

    expect(duplicate.statusCode).toBe(409);
    expect(readJson(duplicate) as ApiError).toMatchObject({
      success: false,
      error: { code: 'STUDENT_CODE_EXISTS' },
    });
  });

  it('lists students with search and stable pagination totals', async () => {
    const accessToken = await loginAndReadAccessToken('directeur');
    await createStudent(accessToken, 'Aminata', 'Mahamat');
    await createStudent(accessToken, 'Ibrahim', 'Ousmane');
    await createStudent(accessToken, 'Fatime', 'Mahamat');

    const searched = await server.inject({
      method: 'GET',
      url: '/students?search=Mahamat&limit=1&offset=0',
      headers: { authorization: `Bearer ${accessToken}` },
    });

    expect(searched.statusCode).toBe(200);
    const body = readJson(searched) as ApiSuccess<PaginatedStudentsResponse>;
    expect(body.data.items).toHaveLength(1);
    expect(body.data.total).toBe(2);
    expect(body.data.limit).toBe(1);
    expect(body.data.offset).toBe(0);
    expect(body.data.items[0]?.lastName).toBe('Mahamat');
  });

  it('filters students by archived status so archived records stay findable', async () => {
    const accessToken = await loginAndReadAccessToken('directeur');
    const first = await createStudent(accessToken, 'Aminata', 'Mahamat');
    await createStudent(accessToken, 'Ibrahim', 'Ousmane');
    await server.inject({
      method: 'POST',
      url: `/students/${first.id}/archive`,
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { reason: 'Transfert vers une autre ecole' },
    });

    const active = await server.inject({
      method: 'GET',
      url: '/students',
      headers: { authorization: `Bearer ${accessToken}` },
    });
    const activeBody = readJson(active) as ApiSuccess<PaginatedStudentsResponse>;
    expect(activeBody.data.total).toBe(1);
    expect(activeBody.data.items[0]?.firstName).toBe('Ibrahim');

    const archived = await server.inject({
      method: 'GET',
      url: '/students?status=archived',
      headers: { authorization: `Bearer ${accessToken}` },
    });
    const archivedBody = readJson(archived) as ApiSuccess<PaginatedStudentsResponse>;
    expect(archivedBody.data.total).toBe(1);
    expect(archivedBody.data.items[0]?.firstName).toBe('Aminata');
  });

  it('searches students by code', async () => {
    const accessToken = await loginAndReadAccessToken('directeur');
    await createStudent(accessToken, 'Aminata', 'Mahamat');

    const response = await server.inject({
      method: 'GET',
      url: '/students?search=2026-001',
      headers: { authorization: `Bearer ${accessToken}` },
    });

    const body = readJson(response) as ApiSuccess<PaginatedStudentsResponse>;
    expect(body.data.total).toBe(1);
    expect(body.data.items[0]?.firstName).toBe('Aminata');
  });

  it('filters students by class level and classroom through their active enrolment', async () => {
    const accessToken = await loginAndReadAccessToken('directeur');
    const aminata = await createStudent(accessToken, 'Aminata', 'Mahamat');
    const ibrahim = await createStudent(accessToken, 'Ibrahim', 'Ousmane');
    const third = await createStudent(accessToken, 'Fatime', 'Mahamat');

    seedEnrolmentContext(sqlite);
    const sixLevelId = '00000000-0000-4000-8000-00000000c101';
    const threeClassroomId = '00000000-0000-4000-8000-00000000c202';

    // Aminata is enrolled in 6e A; Ibrahim and Fatime in 3e A.
    sqlite
      .prepare(
        `
          INSERT INTO class_enrollment
            (id, school_id, student_id, classroom_id, academic_year_id, enrollment_date)
          VALUES (?, ?, ?, ?, ?, ?)
        `
      )
      .run(
        '00000000-0000-4000-8000-00000000c301',
        firstSchoolId,
        aminata.id,
        '00000000-0000-4000-8000-00000000c201',
        '00000000-0000-4000-8000-00000000c001',
        '2026-09-01'
      );
    for (const studentId of [ibrahim.id, third.id]) {
      sqlite
        .prepare(
          `
            INSERT INTO class_enrollment
              (id, school_id, student_id, classroom_id, academic_year_id, enrollment_date)
            VALUES (?, ?, ?, ?, ?, ?)
          `
        )
        .run(
          randomUUID(),
          firstSchoolId,
          studentId,
          threeClassroomId,
          '00000000-0000-4000-8000-00000000c001',
          '2026-09-01'
        );
    }

    // By class level (Troisième): only the two students of 3e A.
    const byLevel = await server.inject({
      method: 'GET',
      url: `/students?classLevelId=${sixLevelId}`,
      headers: { authorization: `Bearer ${accessToken}` },
    });
    const byLevelBody = readJson(byLevel) as ApiSuccess<PaginatedStudentsResponse>;
    expect(byLevelBody.data.total).toBe(1);
    expect(byLevelBody.data.items[0]?.id).toBe(aminata.id);

    // By classroom (3e A): the two Troisième students only.
    const byClassroom = await server.inject({
      method: 'GET',
      url: `/students?classroomId=${threeClassroomId}`,
      headers: { authorization: `Bearer ${accessToken}` },
    });
    const byClassroomBody = readJson(byClassroom) as ApiSuccess<PaginatedStudentsResponse>;
    expect(byClassroomBody.data.total).toBe(2);
    expect(new Set(byClassroomBody.data.items.map((item) => item.id))).toEqual(
      new Set([ibrahim.id, third.id])
    );

    // Unfiltered: everyone is still listed.
    const all = await server.inject({
      method: 'GET',
      url: '/students',
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect((readJson(all) as ApiSuccess<PaginatedStudentsResponse>).data.total).toBe(3);
  });

  it('updates only the provided student fields and audits the change', async () => {
    const accessToken = await loginAndReadAccessToken('directeur');
    const created = await createStudent(accessToken, 'Aminata', 'Mahamat');

    const response = await server.inject({
      method: 'PUT',
      url: `/students/${created.id}`,
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { lastName: 'Oumar', phone: '+23500000010' },
    });

    expect(response.statusCode).toBe(200);
    const body = readJson(response) as ApiSuccess<StudentResponse>;
    expect(body.data).toMatchObject({ lastName: 'Oumar', phone: '+23500000010' });
    expect(body.data.firstName).toBe('Aminata');
    expect(body.data.recordVersion).toBe(2);

    const audit = findLatestAuditEvent('STUDENT_UPDATE');
    expect(audit?.metadata_json).toContain('"lastName"');
  });

  it('archives and reactivates a student with an audit reason', async () => {
    const accessToken = await loginAndReadAccessToken('directeur');
    const created = await createStudent(accessToken, 'Aminata', 'Mahamat');

    const archived = await server.inject({
      method: 'POST',
      url: `/students/${created.id}/archive`,
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { reason: 'Transfert vers une autre ecole' },
    });

    expect(archived.statusCode).toBe(200);
    expect((readJson(archived) as ApiSuccess<StudentResponse>).data.isActive).toBe(false);
    const archiveAudit = findLatestAuditEvent('STUDENT_ARCHIVE');
    expect(archiveAudit?.metadata_json).toContain('Transfert vers une autre ecole');

    const listed = await server.inject({
      method: 'GET',
      url: '/students',
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect((readJson(listed) as ApiSuccess<PaginatedStudentsResponse>).data.total).toBe(0);

    const reactivated = await server.inject({
      method: 'POST',
      url: `/students/${created.id}/reactivate`,
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { reason: 'Retour apres reevaluation' },
    });

    expect(reactivated.statusCode).toBe(200);
    expect((readJson(reactivated) as ApiSuccess<StudentResponse>).data.isActive).toBe(true);
    expect(findLatestAuditAction()).toBe('STUDENT_REACTIVATE');
  });

  it('links guardians and keeps at most one primary contact per student', async () => {
    const accessToken = await loginAndReadAccessToken('directeur');
    const student = await createStudent(accessToken, 'Aminata', 'Mahamat');
    const firstGuardian = await createGuardian(accessToken, 'Fatime', 'Abakar');
    const secondGuardian = await createGuardian(accessToken, 'Mahamat', 'Ousmane');

    const firstLink = await linkGuardian(accessToken, student.id, firstGuardian.id, 'MERE', true);
    const secondLink = await linkGuardian(accessToken, student.id, secondGuardian.id, 'PERE', true);

    const profile = await server.inject({
      method: 'GET',
      url: `/students/${student.id}`,
      headers: { authorization: `Bearer ${accessToken}` },
    });
    const body = readJson(profile) as ApiSuccess<StudentProfileResponse>;

    expect(body.data.guardians).toHaveLength(2);
    expect(
      body.data.guardians.filter((view) => view.link.isPrimary).map((view) => view.link.id)
    ).toEqual([secondLink.id]);
    expect(body.data.guardians.find((view) => view.link.id === firstLink.id)?.link.isPrimary).toBe(
      false
    );
  });

  it('updates link flags and unlinks a guardian', async () => {
    const accessToken = await loginAndReadAccessToken('directeur');
    const student = await createStudent(accessToken, 'Aminata', 'Mahamat');
    const guardian = await createGuardian(accessToken, 'Fatime', 'Abakar');
    const link = await linkGuardian(accessToken, student.id, guardian.id, 'MERE', false);

    const updated = await server.inject({
      method: 'PUT',
      url: `/student-guardians/${link.id}`,
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { isEmergency: true, relationshipType: 'TUTEUR' },
    });

    expect(updated.statusCode).toBe(200);
    expect((readJson(updated) as ApiSuccess<StudentGuardianLinkResponse>).data).toMatchObject({
      id: link.id,
      isEmergency: true,
      relationshipType: 'TUTEUR',
    });

    const unlinked = await server.inject({
      method: 'DELETE',
      url: `/student-guardians/${link.id}`,
      headers: { authorization: `Bearer ${accessToken}` },
    });

    expect(unlinked.statusCode).toBe(200);
    const profile = await server.inject({
      method: 'GET',
      url: `/students/${student.id}`,
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect((readJson(profile) as ApiSuccess<StudentProfileResponse>).data.guardians).toHaveLength(
      0
    );
  });

  it('rejects linking the same guardian twice to one student', async () => {
    const accessToken = await loginAndReadAccessToken('directeur');
    const student = await createStudent(accessToken, 'Aminata', 'Mahamat');
    const guardian = await createGuardian(accessToken, 'Fatime', 'Abakar');

    await linkGuardian(accessToken, student.id, guardian.id, 'MERE', false);
    const duplicate = await server.inject({
      method: 'POST',
      url: `/students/${student.id}/guardians`,
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { guardianId: guardian.id, relationshipType: 'PERE' },
    });

    expect(duplicate.statusCode).toBe(409);
    expect(readJson(duplicate) as ApiError).toMatchObject({
      success: false,
      error: { code: 'STUDENT_GUARDIAN_LINK_EXISTS' },
    });
  });

  it('manages guardians and shows sibling students in their profile', async () => {
    const accessToken = await loginAndReadAccessToken('directeur');
    const firstStudent = await createStudent(accessToken, 'Aminata', 'Mahamat');
    const secondStudent = await createStudent(accessToken, 'Ibrahim', 'Mahamat');
    const guardian = await createGuardian(accessToken, 'Fatime', 'Abakar');

    await linkGuardian(accessToken, firstStudent.id, guardian.id, 'MERE', true);
    await linkGuardian(accessToken, secondStudent.id, guardian.id, 'MERE', false);

    const profile = await server.inject({
      method: 'GET',
      url: `/guardians/${guardian.id}`,
      headers: { authorization: `Bearer ${accessToken}` },
    });

    expect(profile.statusCode).toBe(200);
    const body = readJson(profile) as ApiSuccess<GuardianProfileResponse>;
    expect(body.data.guardian.firstName).toBe('Fatime');
    expect(body.data.students).toHaveLength(2);

    const listed = await server.inject({
      method: 'GET',
      url: '/guardians?search=Abakar',
      headers: { authorization: `Bearer ${accessToken}` },
    });
    const listBody = readJson(listed) as ApiSuccess<PaginatedGuardiansResponse>;
    expect(listBody.data.total).toBe(1);
  });

  it('rejects people operations for a TEACHER account', async () => {
    const accessToken = await loginAndReadAccessToken('enseignant');

    const response = await server.inject({
      method: 'POST',
      url: '/students',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { firstName: 'Aminata', lastName: 'Mahamat' },
    });

    expect(response.statusCode).toBe(403);
    expect(readJson(response) as ApiError).toMatchObject({
      success: false,
      error: { code: 'FORBIDDEN' },
    });
  });

  it('isolates students across schools', async () => {
    const accessToken = await loginAndReadAccessToken('directeur');
    const student = await createStudent(accessToken, 'Aminata', 'Mahamat');
    const otherSchoolToken = await loginAndReadAccessToken('directeur', 'MND-DEMO');

    const foreignRead = await server.inject({
      method: 'GET',
      url: `/students/${student.id}`,
      headers: { authorization: `Bearer ${otherSchoolToken}` },
    });

    expect(foreignRead.statusCode).toBe(404);
    expect(readJson(foreignRead) as ApiError).toMatchObject({
      success: false,
      error: { code: 'STUDENT_NOT_FOUND' },
    });

    const guardian = await createGuardian(accessToken, 'Fatime', 'Abakar');
    const foreignLink = await server.inject({
      method: 'POST',
      url: `/students/${student.id}/guardians`,
      headers: { authorization: `Bearer ${otherSchoolToken}` },
      payload: { guardianId: guardian.id, relationshipType: 'MERE' },
    });

    expect(foreignLink.statusCode).toBe(404);
  });

  it('returns French validation errors for malformed payloads', async () => {
    const accessToken = await loginAndReadAccessToken('directeur');

    const response = await server.inject({
      method: 'POST',
      url: '/students',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { lastName: 'Mahamat' },
    });

    expect(response.statusCode).toBe(400);
    const error = readJson(response) as ApiError;
    expect(error.success).toBe(false);
    expect(error.error.code).toBe('VALIDATION_ERROR');
    expect(typeof error.error.fields?.firstName).toBe('string');
  });

  async function createStudent(accessToken: string, firstName: string, lastName: string) {
    const response = await server.inject({
      method: 'POST',
      url: '/students',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { firstName, lastName },
    });

    expect(response.statusCode).toBe(200);
    return (readJson(response) as ApiSuccess<StudentResponse>).data;
  }

  async function createGuardian(accessToken: string, firstName: string, lastName: string) {
    const response = await server.inject({
      method: 'POST',
      url: '/guardians',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { firstName, lastName },
    });

    expect(response.statusCode).toBe(200);
    return (readJson(response) as ApiSuccess<{ id: string; firstName: string; lastName: string }>)
      .data;
  }

  async function linkGuardian(
    accessToken: string,
    studentId: string,
    guardianId: string,
    relationshipType: string,
    isPrimary: boolean
  ) {
    const response = await server.inject({
      method: 'POST',
      url: `/students/${studentId}/guardians`,
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { guardianId, relationshipType, isPrimary },
    });

    expect(response.statusCode).toBe(200);
    return (readJson(response) as ApiSuccess<StudentGuardianLinkResponse>).data;
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

/** Current year + 6e/3e levels + one classroom each, for the class filter. */
function seedEnrolmentContext(sqlite: Database.Database) {
  sqlite
    .prepare(
      `
        INSERT INTO academic_year (id, school_id, label, start_date, end_date, is_current)
        VALUES (?, ?, ?, ?, ?, 1)
      `
    )
    .run(
      '00000000-0000-4000-8000-00000000c001',
      firstSchoolId,
      '2026-2027',
      '2026-09-01',
      '2027-06-30'
    );

  const levels = [
    ['00000000-0000-4000-8000-00000000c101', '6E', 'Sixième', 1, 0],
    ['00000000-0000-4000-8000-00000000c102', '3E', 'Troisième', 5, 1],
  ] as const;

  for (const [id, code, name, order, exam] of levels) {
    sqlite
      .prepare(
        `
          INSERT INTO class_level (id, school_id, code, name, display_order, is_exam_year)
          VALUES (?, ?, ?, ?, ?, ?)
        `
      )
      .run(id, firstSchoolId, code, name, order, exam);
  }

  const classrooms = [
    ['00000000-0000-4000-8000-00000000c201', '6E', '6E-A'],
    ['00000000-0000-4000-8000-00000000c202', '3E', '3E-A'],
  ] as const;

  for (const [id, levelCode, code] of classrooms) {
    const levelId =
      levelCode === '6E'
        ? '00000000-0000-4000-8000-00000000c101'
        : '00000000-0000-4000-8000-00000000c102';
    sqlite
      .prepare(
        `
          INSERT INTO classroom
            (id, school_id, academic_year_id, class_level_id, code)
          VALUES (?, ?, ?, ?, ?)
        `
      )
      .run(id, firstSchoolId, '00000000-0000-4000-8000-00000000c001', levelId, code);
  }
}

function seedPeopleFixture(sqlite: Database.Database) {
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
