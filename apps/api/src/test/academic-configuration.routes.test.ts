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
  AcademicYearWithTerms,
  AcademicYearsResponse,
  AuthTokenResponse,
  LevelCurriculumsResponse,
  SubjectGroupMembersResponse,
  SubjectGroupsResponse,
  SubjectGroupView,
} from '@edutrack/shared';
import { buildServer } from '../server.js';
import { hashPassword } from '../modules/auth/index.js';

const migrationsDir = fileURLToPath(
  new URL('../../../../packages/db/migrations/sqlite/', import.meta.url)
);
const firstSchoolId = '00000000-0000-4000-8000-000000000101';
const secondSchoolId = '00000000-0000-4000-8000-000000000102';
const schoolMasterId = '00000000-0000-4000-8000-000000000201';
const correctPassword = 'correct-password';
const accessTokenSecret = 'phase-3-academic-configuration-test-secret';
const fixedNow = () => new Date('2026-08-15T10:00:00.000Z');

const levelSixId = '00000000-0000-4000-8000-00000000b101';
const levelThreeId = '00000000-0000-4000-8000-00000000b102';
const subjectMathId = '00000000-0000-4000-8000-00000000b501';
const subjectFrenchId = '00000000-0000-4000-8000-00000000b502';

let passwordHash: string;

describe('academic configuration routes (roadmap §9.3/§9.5/§9.6)', () => {
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
    seedAcademicFixture(sqlite);
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

  // -------------------------------------------------------------------------
  // Academic years (roadmap §9.3)
  // -------------------------------------------------------------------------

  it('creates a DRAFT academic year with its terms and audits the event', async () => {
    const accessToken = await loginAndReadAccessToken('directeur');

    const response = await server.inject({
      method: 'POST',
      url: '/configuration/academic-years',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: {
        label: '2027-2028',
        startDate: '2027-09-01',
        endDate: '2028-06-30',
        terms: [
          { label: 'Trimestre 1', termNumber: 1, startDate: '2027-09-01', endDate: '2027-12-19' },
          { label: 'Trimestre 2', termNumber: 2, startDate: '2028-01-04', endDate: '2028-03-24' },
          { label: 'Trimestre 3', termNumber: 3, startDate: '2028-04-03', endDate: '2028-06-30' },
        ],
      },
    });

    expect(response.statusCode).toBe(200);
    const body = readJson(response) as ApiSuccess<AcademicYearWithTerms>;
    expect(body.data).toMatchObject({
      schoolId: firstSchoolId,
      label: '2027-2028',
      status: 'DRAFT',
      isCurrent: false,
    });
    expect(body.data.terms).toHaveLength(3);
    expect(body.data.terms.every((term) => !term.isCurrent)).toBe(true);
    expect(findLatestAuditAction()).toBe('CONFIG_YEAR_CREATE');
  });

  it('rejects a draft year with invalid dates or fewer than two terms', async () => {
    const accessToken = await loginAndReadAccessToken('directeur');

    const invalidDates = await server.inject({
      method: 'POST',
      url: '/configuration/academic-years',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: {
        label: '2027-2028',
        startDate: 'not-a-date',
        endDate: '2028-06-30',
        terms: [
          { label: 'Trimestre 1', termNumber: 1, startDate: '2027-09-01', endDate: '2027-12-19' },
          { label: 'Trimestre 2', termNumber: 2, startDate: '2028-01-04', endDate: '2028-03-24' },
        ],
      },
    });
    expect(invalidDates.statusCode).toBe(400);

    const singleTerm = await server.inject({
      method: 'POST',
      url: '/configuration/academic-years',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: {
        label: '2027-2028',
        startDate: '2027-09-01',
        endDate: '2028-06-30',
        terms: [
          { label: 'Trimestre 1', termNumber: 1, startDate: '2027-09-01', endDate: '2027-12-19' },
        ],
      },
    });
    expect(singleTerm.statusCode).toBe(400);
  });

  it('lets a SchoolMaster list years but forbids teachers from managing them', async () => {
    const directorToken = await loginAndReadAccessToken('directeur');
    const listResponse = await server.inject({
      method: 'GET',
      url: '/configuration/academic-years',
      headers: { authorization: `Bearer ${directorToken}` },
    });
    expect(listResponse.statusCode).toBe(200);
    const listBody = readJson(listResponse) as ApiSuccess<AcademicYearsResponse>;
    expect(listBody.data.years.length).toBeGreaterThanOrEqual(1);

    const teacherToken = await loginAndReadAccessToken('enseignant');
    const createResponse = await server.inject({
      method: 'POST',
      url: '/configuration/academic-years',
      headers: { authorization: `Bearer ${teacherToken}` },
      payload: {
        label: '2027-2028',
        startDate: '2027-09-01',
        endDate: '2028-06-30',
        terms: [
          { label: 'Trimestre 1', termNumber: 1, startDate: '2027-09-01', endDate: '2027-12-19' },
          { label: 'Trimestre 2', termNumber: 2, startDate: '2028-01-04', endDate: '2028-03-24' },
        ],
      },
    });
    expect(createResponse.statusCode).toBe(403);
    expect(readFailure(createResponse).error.code).toBe('ACADEMIC_YEARS_FORBIDDEN');
  });

  it('activating a year rolls the school over: previous year closed, new year current', async () => {
    const accessToken = await loginAndReadAccessToken('directeur');

    // Seed a second DRAFT year for 2027-2028.
    const draftYear = await createDraftYear(accessToken, '2027-2028');

    const activateResponse = await server.inject({
      method: 'PUT',
      url: `/configuration/academic-years/${draftYear.id}/status`,
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { status: 'ACTIVE' },
    });
    expect(activateResponse.statusCode).toBe(200);

    const activated = readJson(activateResponse) as ApiSuccess<AcademicYearWithTerms>;
    expect(activated.data.status).toBe('ACTIVE');
    expect(activated.data.isCurrent).toBe(true);
    expect(activated.data.terms[0]?.isCurrent).toBe(true);

    const listResponse = await server.inject({
      method: 'GET',
      url: '/configuration/academic-years',
      headers: { authorization: `Bearer ${accessToken}` },
    });
    const listBody = readJson(listResponse) as ApiSuccess<AcademicYearsResponse>;
    const activeYears = listBody.data.years.filter((year) => year.status === 'ACTIVE');
    expect(activeYears).toHaveLength(1);
    expect(activeYears[0]?.id).toBe(draftYear.id);

    // Exactly one current term across the school.
    const currentTerms = countRowsWhere('term', 'is_current = 1');
    expect(currentTerms).toBe(1);

    expect(findLatestAuditAction()).toBe('CONFIG_YEAR_ACTIVATE');
  });

  it('closes an ACTIVE year explicitly and records the audit event', async () => {
    const accessToken = await loginAndReadAccessToken('directeur');
    const draftYear = await createDraftYear(accessToken, '2027-2028');

    await server.inject({
      method: 'PUT',
      url: `/configuration/academic-years/${draftYear.id}/status`,
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { status: 'ACTIVE' },
    });

    const closeResponse = await server.inject({
      method: 'PUT',
      url: `/configuration/academic-years/${draftYear.id}/status`,
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { status: 'CLOSED' },
    });
    expect(closeResponse.statusCode).toBe(200);
    const closed = readJson(closeResponse) as ApiSuccess<AcademicYearWithTerms>;
    expect(closed.data.status).toBe('CLOSED');
    expect(findLatestAuditAction()).toBe('CONFIG_YEAR_CLOSE');
  });

  it('rejects an invalid transition (activating a CLOSED year)', async () => {
    const accessToken = await loginAndReadAccessToken('directeur');
    const draftYear = await createDraftYear(accessToken, '2027-2028');

    await server.inject({
      method: 'PUT',
      url: `/configuration/academic-years/${draftYear.id}/status`,
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { status: 'CLOSED' },
    });

    const reactivateResponse = await server.inject({
      method: 'PUT',
      url: `/configuration/academic-years/${draftYear.id}/status`,
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { status: 'ACTIVE' },
    });
    expect(reactivateResponse.statusCode).toBe(400);
  });

  it('never leaks another school academic years into the tenant list', async () => {
    const firstToken = await loginAndReadAccessToken('directeur');
    await createDraftYear(firstToken, '2027-2028');

    const secondToken = await loginAndReadAccessToken('directeur', 'MND-DEMO');
    const response = await server.inject({
      method: 'GET',
      url: '/configuration/academic-years',
      headers: { authorization: `Bearer ${secondToken}` },
    });
    const body = readJson(response) as ApiSuccess<AcademicYearsResponse>;
    expect(body.data.years.every((year) => year.schoolId === secondSchoolId)).toBe(true);
    expect(body.data.years.some((year) => year.label === '2027-2028')).toBe(false);
  });

  // -------------------------------------------------------------------------
  // Level curriculum (roadmap §9.5)
  // -------------------------------------------------------------------------

  it('saves a level curriculum with positive coefficients and required flags', async () => {
    const accessToken = await loginAndReadAccessToken('directeur');

    const response = await server.inject({
      method: 'PUT',
      url: '/level-curriculum',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: {
        levelId: levelSixId,
        entries: [
          { subjectId: subjectMathId, coefficient: 4, isRequired: true },
          { subjectId: subjectFrenchId, coefficient: 3, isRequired: false },
        ],
      },
    });

    expect(response.statusCode).toBe(200);
    const body = readJson(response) as ApiSuccess<LevelCurriculumsResponse>;
    const sixieme = body.data.items.find((item) => item.levelId === levelSixId);
    expect(sixieme?.entries).toHaveLength(2);
    expect(sixieme?.entries[0]).toMatchObject({
      subjectId: subjectMathId,
      coefficient: 4,
      isRequired: true,
    });
    expect(findLatestAuditAction()).toBe('CONFIG_LEVEL_UPDATE');
  });

  it('rejects level curriculum entries with invalid coefficients or unknown subjects', async () => {
    const accessToken = await loginAndReadAccessToken('directeur');

    const zeroCoefficient = await server.inject({
      method: 'PUT',
      url: '/level-curriculum',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: {
        levelId: levelSixId,
        entries: [{ subjectId: subjectMathId, coefficient: 0, isRequired: true }],
      },
    });
    expect(zeroCoefficient.statusCode).toBe(400);

    const unknownSubject = await server.inject({
      method: 'PUT',
      url: '/level-curriculum',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: {
        levelId: levelSixId,
        entries: [
          {
            subjectId: '00000000-0000-4000-8000-00000000ffff',
            coefficient: 2,
            isRequired: true,
          },
        ],
      },
    });
    expect(unknownSubject.statusCode).toBe(404);
    expect(readFailure(unknownSubject).error.code).toBe('LEVEL_CURRICULUM_NOT_FOUND');
  });

  it('rejects level curriculum writes from teachers and from other-school levels', async () => {
    const teacherToken = await loginAndReadAccessToken('enseignant');
    const forbidden = await server.inject({
      method: 'PUT',
      url: '/level-curriculum',
      headers: { authorization: `Bearer ${teacherToken}` },
      payload: {
        levelId: levelSixId,
        entries: [{ subjectId: subjectMathId, coefficient: 2, isRequired: true }],
      },
    });
    expect(forbidden.statusCode).toBe(403);

    const otherSchoolLevelId = '00000000-0000-4000-8000-00000000c101';
    sqlite
      .prepare(
        `INSERT INTO class_level (id, school_id, code, name, display_order, is_exam_year)
         VALUES (?, ?, '6E', 'Sixième', 1, 0)`
      )
      .run(otherSchoolLevelId, secondSchoolId);

    const directorToken = await loginAndReadAccessToken('directeur');
    const crossSchool = await server.inject({
      method: 'PUT',
      url: '/level-curriculum',
      headers: { authorization: `Bearer ${directorToken}` },
      payload: {
        levelId: otherSchoolLevelId,
        entries: [{ subjectId: subjectMathId, coefficient: 2, isRequired: true }],
      },
    });
    expect(crossSchool.statusCode).toBe(404);
  });

  it('replaces the level matrix atomically on each save', async () => {
    const accessToken = await loginAndReadAccessToken('directeur');

    await server.inject({
      method: 'PUT',
      url: '/level-curriculum',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: {
        levelId: levelSixId,
        entries: [{ subjectId: subjectMathId, coefficient: 4, isRequired: true }],
      },
    });

    const response = await server.inject({
      method: 'PUT',
      url: '/level-curriculum',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: {
        levelId: levelSixId,
        entries: [{ subjectId: subjectFrenchId, coefficient: 3, isRequired: false }],
      },
    });
    const body = readJson(response) as ApiSuccess<LevelCurriculumsResponse>;
    const sixieme = body.data.items.find((item) => item.levelId === levelSixId);
    expect(sixieme?.entries).toHaveLength(1);
    expect(sixieme?.entries[0]?.subjectId).toBe(subjectFrenchId);

    const persisted = countRowsWhere(
      'level_subject',
      'class_level_id = ? AND is_active = 1 AND deleted_at IS NULL',
      [levelSixId]
    );
    expect(persisted).toBe(1);

    // The replaced entry is soft-deactivated, never hard-deleted.
    const softDeleted = countRowsWhere('level_subject', 'class_level_id = ? AND is_active = 0', [
      levelSixId,
    ]);
    expect(softDeleted).toBe(1);
  });

  // -------------------------------------------------------------------------
  // Subject groups (roadmap §9.6)
  // -------------------------------------------------------------------------

  it('creates a subject group with display order and audits the event', async () => {
    const accessToken = await loginAndReadAccessToken('directeur');

    const response = await server.inject({
      method: 'POST',
      url: '/subject-groups',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: {
        name: 'Matières scientifiques',
        nameEn: 'Science subjects',
        nameAr: 'المواد العلمية',
        displayOrder: 1,
      },
    });

    expect(response.statusCode).toBe(200);
    const body = readJson(response) as ApiSuccess<SubjectGroupView>;
    expect(body.data).toMatchObject({
      schoolId: firstSchoolId,
      name: 'Matières scientifiques',
      displayOrder: 1,
      isActive: true,
      subjectCount: 0,
    });
    expect(findLatestAuditAction()).toBe('CONFIG_GROUP_CREATE');
  });

  it('rejects duplicate group names with a 409', async () => {
    const accessToken = await loginAndReadAccessToken('directeur');

    await server.inject({
      method: 'POST',
      url: '/subject-groups',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { name: 'Matières littéraires', displayOrder: 1 },
    });

    const duplicate = await server.inject({
      method: 'POST',
      url: '/subject-groups',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { name: 'Matières littéraires', displayOrder: 2 },
    });
    expect(duplicate.statusCode).toBe(409);
    expect(readFailure(duplicate).error.code).toBe('SUBJECT_GROUP_NAME_EXISTS');
  });

  it('updates a group and rejects stale record versions with a 409', async () => {
    const accessToken = await loginAndReadAccessToken('directeur');
    const created = await createGroup(accessToken, 'Matières scientifiques');

    const updateResponse = await server.inject({
      method: 'PUT',
      url: `/subject-groups/${created.id}`,
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { name: 'Matières scientifiques et techniques', displayOrder: 2, recordVersion: 1 },
    });
    expect(updateResponse.statusCode).toBe(200);
    const updated = readJson(updateResponse) as ApiSuccess<SubjectGroupView>;
    expect(updated.data.name).toBe('Matières scientifiques et techniques');
    expect(updated.data.recordVersion).toBe(2);

    const stale = await server.inject({
      method: 'PUT',
      url: `/subject-groups/${created.id}`,
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { name: 'Matières littéraires', displayOrder: 3, recordVersion: 1 },
    });
    expect(stale.statusCode).toBe(409);
    expect(readFailure(stale).error.code).toBe('VERSION_CONFLICT');
    expect(findLatestAuditAction()).toBe('CONFIG_GROUP_UPDATE');
  });

  it('sets and lists group members with display order', async () => {
    const accessToken = await loginAndReadAccessToken('directeur');
    const group = await createGroup(accessToken, 'Matières scientifiques');

    const setResponse = await server.inject({
      method: 'PUT',
      url: `/subject-groups/${group.id}/members`,
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { subjectIds: [subjectFrenchId, subjectMathId] },
    });
    expect(setResponse.statusCode).toBe(200);

    const listResponse = await server.inject({
      method: 'GET',
      url: `/subject-groups/${group.id}/members`,
      headers: { authorization: `Bearer ${accessToken}` },
    });
    const listBody = readJson(listResponse) as ApiSuccess<SubjectGroupMembersResponse>;
    expect(listBody.data.members).toHaveLength(2);
    expect(listBody.data.members[0]?.subjectId).toBe(subjectFrenchId);
    expect(listBody.data.members[0]?.displayOrder).toBe(1);
    expect(listBody.data.members[1]?.subjectId).toBe(subjectMathId);

    // The list view reflects the member count.
    const groupsResponse = await server.inject({
      method: 'GET',
      url: '/subject-groups',
      headers: { authorization: `Bearer ${accessToken}` },
    });
    const groupsBody = readJson(groupsResponse) as ApiSuccess<SubjectGroupsResponse>;
    const withMembers = groupsBody.data.items.find((item) => item.id === group.id);
    expect(withMembers?.subjectCount).toBe(2);
  });

  it('archives a group and forbids teacher writes', async () => {
    const accessToken = await loginAndReadAccessToken('directeur');
    const group = await createGroup(accessToken, 'Matières scientifiques');

    const archiveResponse = await server.inject({
      method: 'POST',
      url: `/subject-groups/${group.id}/archive`,
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(archiveResponse.statusCode).toBe(200);
    const archived = readJson(archiveResponse) as ApiSuccess<SubjectGroupView>;
    expect(archived.data.isActive).toBe(false);

    const teacherToken = await loginAndReadAccessToken('enseignant');
    const forbidden = await server.inject({
      method: 'POST',
      url: '/subject-groups',
      headers: { authorization: `Bearer ${teacherToken}` },
      payload: { name: 'Matières littéraires', displayOrder: 1 },
    });
    expect(forbidden.statusCode).toBe(403);
  });

  it('keeps subject groups tenant-scoped', async () => {
    const directorToken = await loginAndReadAccessToken('directeur');
    await createGroup(directorToken, 'Matières scientifiques');

    const secondToken = await loginAndReadAccessToken('directeur', 'MND-DEMO');
    const response = await server.inject({
      method: 'GET',
      url: '/subject-groups',
      headers: { authorization: `Bearer ${secondToken}` },
    });
    const body = readJson(response) as ApiSuccess<SubjectGroupsResponse>;
    expect(body.data.items).toHaveLength(0);
  });

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

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

  async function createDraftYear(accessToken: string, label: string) {
    const response = await server.inject({
      method: 'POST',
      url: '/configuration/academic-years',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: {
        label,
        startDate: '2027-09-01',
        endDate: '2028-06-30',
        terms: [
          { label: 'Trimestre 1', termNumber: 1, startDate: '2027-09-01', endDate: '2027-12-19' },
          { label: 'Trimestre 2', termNumber: 2, startDate: '2028-01-04', endDate: '2028-03-24' },
        ],
      },
    });
    expect(response.statusCode).toBe(200);
    return (readJson(response) as ApiSuccess<AcademicYearWithTerms>).data;
  }

  async function createGroup(accessToken: string, name: string) {
    const response = await server.inject({
      method: 'POST',
      url: '/subject-groups',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { name, displayOrder: 1 },
    });
    expect(response.statusCode).toBe(200);
    return (readJson(response) as ApiSuccess<SubjectGroupView>).data;
  }

  function findLatestAuditAction() {
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

  function countRowsWhere(
    table: string,
    whereClause: string,
    params: (string | number)[] = []
  ): number {
    const row = sqlite
      .prepare(`SELECT COUNT(*) AS value FROM ${table} WHERE ${whereClause}`)
      .get(...params) as { value: number };

    return row.value;
  }
});

function seedAcademicFixture(sqlite: Database.Database) {
  sqlite
    .prepare(
      `
        UPDATE user
        SET password_hash = ?, failed_login_attempts = 0, locked_until = NULL
        WHERE id = ? OR id = ?
      `
    )
    .run(passwordHash, schoolMasterId, '00000000-0000-4000-8000-000000000202');

  sqlite
    .prepare(
      `
        INSERT INTO user (id, school_id, username, password_hash, role)
        VALUES (?, ?, ?, ?, ?)
      `
    )
    .run(
      '00000000-0000-4000-8000-000000000302',
      firstSchoolId,
      'enseignant',
      passwordHash,
      'TEACHER'
    );

  sqlite
    .prepare(
      `
        INSERT INTO academic_year (id, school_id, label, start_date, end_date, is_current, status)
        VALUES (?, ?, '2026-2027', '2026-09-01', '2027-06-30', 1, 'ACTIVE')
      `
    )
    .run('00000000-0000-4000-8000-00000000b001', firstSchoolId);

  sqlite
    .prepare(
      `
        INSERT INTO term (id, school_id, academic_year_id, label, term_number, start_date, end_date, is_current)
        VALUES (?, ?, ?, 'Trimestre 1', 1, '2026-09-01', '2026-12-19', 1)
      `
    )
    .run(
      '00000000-0000-4000-8000-00000000b011',
      firstSchoolId,
      '00000000-0000-4000-8000-00000000b001'
    );

  const levels = [
    [levelSixId, '6E', 'Sixième', 1, 0],
    [levelThreeId, '3E', 'Troisième', 2, 1],
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

  const subjects = [
    [subjectMathId, 'MATH', 'Mathématiques', 'MATHEMATIQUES'],
    [subjectFrenchId, 'FR', 'Français', 'LANGUES'],
  ] as const;

  for (const [id, code, name, category] of subjects) {
    sqlite
      .prepare(
        `
          INSERT INTO subject (id, school_id, code, name, category)
          VALUES (?, ?, ?, ?, ?)
        `
      )
      .run(id, firstSchoolId, code, name, category);
  }
}

function readJson(response: { body: string }) {
  return JSON.parse(response.body) as unknown;
}

function readFailure(response: { body: string }): ApiFailure {
  return readJson(response) as ApiFailure;
}

function applyAllMigrations(sqlite: Database.Database) {
  const migrationFiles = readdirSync(migrationsDir)
    .filter((file) => file.endsWith('.sql'))
    .sort();

  for (const migrationFile of migrationFiles) {
    const migrationSql = readFileSync(join(migrationsDir, migrationFile), 'utf8');
    sqlite.exec(migrationSql.replaceAll('--> statement-breakpoint', '\n'));
  }
}

interface ApiSuccess<T> {
  success: true;
  data: T;
}

interface ApiFailure {
  success: false;
  error: { code: string; message: string };
}
