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
  ClassSubjectView,
  ClassroomRosterResponse,
  ClassroomView,
  ConfirmImportResponse,
  EnrolStudentsResponse,
  ImportPreviewResponse,
  SubjectResponse,
} from '@edutrack/shared';
import * as XLSX from 'xlsx';
import { buildServer } from '../server.js';
import { hashPassword } from '../modules/auth/index.js';

const migrationsDir = fileURLToPath(
  new URL('../../../../packages/db/migrations/sqlite/', import.meta.url)
);
const firstSchoolId = '00000000-0000-4000-8000-000000000101';
const schoolMasterId = '00000000-0000-4000-8000-000000000201';
const correctPassword = 'correct-password';
const accessTokenSecret = 'phase-4-gate-test-secret-with-local-only-scope';
const fixedNow = () => new Date('2026-08-15T10:00:00.000Z');

const academicYearId = '00000000-0000-4000-8000-00000000a001';
const levelSixId = '00000000-0000-4000-8000-00000000a101';
const levelThreeId = '00000000-0000-4000-8000-00000000a102';
const studentOneId = '00000000-0000-4000-8000-00000000a201';
const studentTwoId = '00000000-0000-4000-8000-00000000a202';
const studentThreeId = '00000000-0000-4000-8000-00000000a203';
const teacherOneId = '00000000-0000-4000-8000-00000000a301';
const teacherTwoId = '00000000-0000-4000-8000-00000000a302';
const teacherThreeId = '00000000-0000-4000-8000-00000000a303';
const teacherFourId = '00000000-0000-4000-8000-00000000a304';

/**
 * Pilot fixture for the 10.4 gate: a realistic Troisième (3E-A) cohort and
 * curriculum as a SchoolMaster would configure it — subject catalogue, one
 * classroom for the current year, subject/coefficient/teacher assignments and
 * three enrolled students. The expected bulletin rows below are the reference
 * for the structure (roadmap §10.4, "exact subject rows expected on a
 * reference bulletin").
 */
const PILOT_SUBJECTS = [
  { code: 'FR', name: 'Français', category: 'LANGUES' },
  { code: 'MATH', name: 'Mathématiques', category: 'MATHEMATIQUES' },
  { code: 'ANG', name: 'Anglais', category: 'LANGUES' },
  { code: 'HG', name: 'Histoire-Géographie', category: 'SCIENCES_SOCIALES' },
  { code: 'SVT', name: 'Sciences de la Vie et de la Terre', category: 'SCIENCES' },
  { code: 'PC', name: 'Physique-Chimie', category: 'SCIENCES' },
  { code: 'EC', name: 'Éducation Civique et Morale', category: 'SCIENCES_SOCIALES' },
  { code: 'EPS', name: 'Éducation Physique et Sportive', category: 'SPORTS' },
] as const;

/** [subjectCode, coefficient, isRequired, teacherId] */
const PILOT_CURRICULUM = [
  ['FR', 4, true, teacherOneId],
  ['MATH', 4, true, teacherTwoId],
  ['ANG', 3, true, teacherThreeId],
  ['HG', 3, true, teacherOneId],
  ['SVT', 2, true, teacherTwoId],
  ['PC', 2, true, teacherThreeId],
  ['EC', 1, true, teacherFourId],
  ['EPS', 1, false, teacherFourId],
] as const;

/** Reference bulletin rows for 3E-A, ordered by subject code. */
const REFERENCE_BULLETIN_ROWS = [
  ['ANG', 'Anglais', 3, true, 'Paul Djasrangar'],
  ['EC', 'Éducation Civique et Morale', 1, true, 'Claudine Mbai'],
  ['EPS', 'Éducation Physique et Sportive', 1, false, 'Claudine Mbai'],
  ['FR', 'Français', 4, true, 'Jean Nguet'],
  ['HG', 'Histoire-Géographie', 3, true, 'Jean Nguet'],
  ['MATH', 'Mathématiques', 4, true, 'Mariam Abakar'],
  ['PC', 'Physique-Chimie', 2, true, 'Paul Djasrangar'],
  ['SVT', 'Sciences de la Vie et de la Terre', 2, true, 'Mariam Abakar'],
] as const;

let passwordHash: string;

describe('phase 4 gate (roadmap §10.4)', () => {
  let sqlite: Database.Database;
  let db: EduTrackDatabase;
  let connection: EduTrackDatabaseConnection;
  let server: ReturnType<typeof buildServer>;
  let accessToken: string;

  beforeAll(async () => {
    passwordHash = await hashPassword(correctPassword);
  });

  beforeEach(async () => {
    connection = openEduTrackDatabase(':memory:');
    sqlite = connection.sqlite;
    sqlite.pragma('foreign_keys = ON');
    applyAllMigrations(sqlite);
    db = connection.db;
    seedFoundation(db);
    seedFixture(sqlite);
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
    accessToken = await loginAndReadAccessToken('directeur');
  });

  afterEach(async () => {
    await server.close();
    connection.close();
  });

  afterAll(() => {
    passwordHash = '';
  });

  // -------------------------------------------------------------------------
  // 10.4 — "A SchoolMaster configures a realistic class and curriculum from a
  // pilot fixture."
  // -------------------------------------------------------------------------

  it('configures the pilot 3E-A class and curriculum through the API', async () => {
    const subjects = await configurePilotSubjects();
    const classroom = await createPilotClassroom();
    const assignments = await assignPilotCurriculum(classroom, subjects);

    expect(subjects.map((subject) => subject.code).sort()).toEqual(
      PILOT_SUBJECTS.map((subject) => subject.code).sort()
    );
    expect(assignments).toHaveLength(8);
    expect(classroom.classroom.code).toBe('3E-A');
    expect(classroom.classLevelCode).toBe('3E');
    expect(classroom.academicYearLabel).toBe('2026-2027');

    const enrol = await server.inject({
      method: 'POST',
      url: '/class-enrollments',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { classroomId: classroom.classroom.id, studentIds: [studentOneId, studentTwoId, studentThreeId] },
    });
    expect(enrol.statusCode).toBe(200);
    expect((readJson(enrol) as ApiSuccess<EnrolStudentsResponse>).data.imported).toBe(3);

    const roster = await server.inject({
      method: 'GET',
      url: `/classrooms/${classroom.classroom.id}/roster`,
      headers: { authorization: `Bearer ${accessToken}` },
    });
    const rosterBody = readJson(roster) as ApiSuccess<ClassroomRosterResponse>;
    expect(rosterBody.data.capacity).toBe(40);
    expect(rosterBody.data.enrolledCount).toBe(3);
    expect(rosterBody.data.entries.map((entry) => entry.student.lastName).sort()).toEqual([
      'Ahmat',
      'Mahamat',
      'Ousmane',
    ]);
  });

  // -------------------------------------------------------------------------
  // 10.4 — "The structure produces the exact subject rows expected on a
  // reference bulletin."
  // -------------------------------------------------------------------------

  it('produces the exact reference-bulletin subject rows for 3E-A', async () => {
    const subjects = await configurePilotSubjects();
    const classroom = await createPilotClassroom();
    await assignPilotCurriculum(classroom, subjects);

    const response = await server.inject({
      method: 'GET',
      url: `/class-subjects?classroomId=${classroom.classroom.id}`,
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(response.statusCode).toBe(200);

    const rows = (readJson(response) as ApiSuccess<ClassSubjectView[]>).data
      .map((view) => [
        view.subjectCode,
        view.subjectName,
        view.classSubject.coefficient,
        view.classSubject.isRequired,
        view.teacherName,
      ])
      .sort((left, right) => String(left[0]).localeCompare(String(right[0])));

    expect(rows).toEqual(
      REFERENCE_BULLETIN_ROWS.map((row) => [...row] as (string | number | boolean | null)[])
    );
  });

  // -------------------------------------------------------------------------
  // 10.4 — "Reimporting the same confirmed curriculum file is idempotent and
  // does not duplicate assignments."
  // -------------------------------------------------------------------------

  it('reimporting the confirmed curriculum workbook is idempotent', async () => {
    // The catalogue and the class exist; the curriculum itself comes from the
    // import file (as a SchoolMaster would load the downloadable template).
    await configurePilotSubjects();
    await createPilotClassroom();
    const classSubjectCountBefore = countRows('class_subject');

    // The pilot curriculum as the downloadable CLASS_SUBJECTS template.
    const workbookRows = PILOT_CURRICULUM.map(([subjectCode, coefficient, isRequired, teacherId]) => [
      '3E-A',
      subjectCode,
      coefficient,
      isRequired ? 'OUI' : 'NON',
      teacherCodeOf(teacherId),
    ]);
    const { payload, contentType } = buildMultipart(
      classSubjectWorkbook(workbookRows),
      'affectations-3e-a.xlsx'
    );

    // First confirm: the 8 assignments are created from the file.
    const firstPreview = await preview(accessToken, payload, contentType, 'CLASS_SUBJECTS');
    expect(firstPreview).toMatchObject({ validRows: 8, errorRows: 0 });
    const firstConfirm = await confirmImport(accessToken, firstPreview.importId, 'affectations-3e-a-1');
    expect(firstConfirm).toMatchObject({ imported: 8, skippedExisting: 0 });
    expect(countRows('class_subject')).toBe(classSubjectCountBefore + 8);

    // Reconfirm the same file under a new import identifier: every row already
    // exists, nothing is duplicated, and the audit trail still records the run.
    const secondPreview = await preview(accessToken, payload, contentType, 'CLASS_SUBJECTS');
    expect(secondPreview).toMatchObject({ validRows: 8, errorRows: 0 });
    const secondConfirm = await confirmImport(accessToken, secondPreview.importId, 'affectations-3e-a-2');
    expect(secondConfirm).toMatchObject({ imported: 0, skippedExisting: 8 });
    expect(countRows('class_subject')).toBe(classSubjectCountBefore + 8);
    expect(countRowsWhere('import_batch', `kind = 'CLASS_SUBJECTS'`)).toBe(2);
  });

  // -------------------------------------------------------------------------
  // 10.4 — "Teacher assignment and optional-subject authorization tests pass."
  // -------------------------------------------------------------------------

  it('authorizes optional-subject enrolment only for optional class-subjects', async () => {
    const subjects = await configurePilotSubjects();
    const classroom = await createPilotClassroom();
    const assignments = await assignPilotCurriculum(classroom, subjects);
    const optional = requireFound(
      assignments.find(
        (assignment) => assignment.subjectCode === 'EPS' && !assignment.classSubject.isRequired
      ),
      'optional EPS class-subject'
    );
    const required = requireFound(
      assignments.find(
        (assignment) => assignment.subjectCode === 'FR' && assignment.classSubject.isRequired
      ),
      'required FR class-subject'
    );

    await server.inject({
      method: 'POST',
      url: '/class-enrollments',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { classroomId: classroom.classroom.id, studentIds: [studentOneId] },
    });

    // Explicit enrolment in the optional EPS class-subject is allowed.
    const okResponse = await server.inject({
      method: 'POST',
      url: '/class-enrollments/optional-subjects',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: {
        classroomId: classroom.classroom.id,
        studentId: studentOneId,
        classSubjectIds: [optional.classSubject.id],
      },
    });
    expect(okResponse.statusCode).toBe(200);

    // Required class-subjects are auto-enrolled on class join and cannot be
    // requested through the optional-enrolment endpoint.
    const rejected = await server.inject({
      method: 'POST',
      url: '/class-enrollments/optional-subjects',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: {
        classroomId: classroom.classroom.id,
        studentId: studentOneId,
        classSubjectIds: [required.classSubject.id],
      },
    });
    expect(rejected.statusCode).toBe(409);
    expect((readJson(rejected) as ApiFailure).error.code).toBe('CLASS_SUBJECT_REQUIRED_LINK');
  });

  // -------------------------------------------------------------------------
  // 10.4 — "Transfer and historical-enrolment tests pass."
  // -------------------------------------------------------------------------

  it('transfers a pilot student with effective date and reason, preserving history', async () => {
    const subjects = await configurePilotSubjects();
    const classroom = await createPilotClassroom();
    await assignPilotCurriculum(classroom, subjects);

    // Second classroom for the transfer target (6e A).
    const targetResponse = await server.inject({
      method: 'POST',
      url: '/classrooms',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: {
        academicYearId,
        classLevelId: levelSixId,
        code: '6E-A',
        name: '6e A',
        capacity: 35,
      },
    });
    const target = (readJson(targetResponse) as ApiSuccess<ClassroomView>).data;

    await server.inject({
      method: 'POST',
      url: '/class-enrollments',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { classroomId: classroom.classroom.id, studentIds: [studentOneId] },
    });

    const transfer = await server.inject({
      method: 'POST',
      url: `/students/${studentOneId}/transfer`,
      headers: { authorization: `Bearer ${accessToken}` },
      payload: {
        targetClassroomId: target.classroom.id,
        effectiveDate: '2026-11-02',
        reason: 'Changement de niveau sur decision de la famille',
      },
    });
    expect(transfer.statusCode).toBe(200);
    const transferBody = readJson(transfer) as ApiSuccess<{
      closed: { status: string; exitDate: string | null };
      opened: { classroomId: string; status: string; enrollmentDate: string };
    }>;
    expect(transferBody.data.closed).toMatchObject({
      status: 'TRANSFERRED',
      exitDate: '2026-11-02',
    });
    expect(transferBody.data.opened).toMatchObject({
      classroomId: target.classroom.id,
      status: 'ACTIVE',
      enrollmentDate: '2026-11-02',
    });

    // History preserved: both the closed and opened enrollments exist.
    expect(
      countRowsWhere(
        'class_enrollment',
        `school_id = '${firstSchoolId}' AND student_id = '${studentOneId}'`
      )
    ).toBe(2);
    expect(findLatestAuditAction()).toBe('ENROLMENT_TRANSFER');

    const roster = await server.inject({
      method: 'GET',
      url: `/classrooms/${classroom.classroom.id}/roster`,
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect((readJson(roster) as ApiSuccess<ClassroomRosterResponse>).data.enrolledCount).toBe(0);
  });

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  async function configurePilotSubjects() {
    const subjects: SubjectResponse[] = [];

    for (const subject of PILOT_SUBJECTS) {
      const response = await server.inject({
        method: 'POST',
        url: '/subjects',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: subject,
      });
      expect(response.statusCode).toBe(200);
      subjects.push((readJson(response) as ApiSuccess<SubjectResponse>).data);
    }

    return subjects;
  }

  async function createPilotClassroom() {
    const response = await server.inject({
      method: 'POST',
      url: '/classrooms',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: {
        academicYearId,
        classLevelId: levelThreeId,
        code: '3E-A',
        name: '3e A',
        capacity: 40,
      },
    });
    expect(response.statusCode).toBe(200);
    return (readJson(response) as ApiSuccess<ClassroomView>).data;
  }

  async function assignPilotCurriculum(classroom: ClassroomView, subjects: SubjectResponse[]) {
    const byCode = new Map(subjects.map((subject) => [subject.code, subject.id]));

    const assignments: ClassSubjectView[] = [];

    for (const [subjectCode, coefficient, isRequired, teacherId] of PILOT_CURRICULUM) {
      const subjectId = byCode.get(subjectCode);
      expect(subjectId).toBeDefined();
      const response = await server.inject({
        method: 'POST',
        url: '/class-subjects',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: {
          classroomId: classroom.classroom.id,
          subjectId,
          coefficient,
          isRequired,
          teacherId,
        },
      });
      expect(response.statusCode).toBe(200);
      assignments.push((readJson(response) as ApiSuccess<ClassSubjectView>).data);
    }

    return assignments;
  }

  async function preview(
    token: string,
    payload: Buffer,
    contentType: string,
    kind: 'SUBJECTS' | 'CLASSROOMS' | 'CLASS_SUBJECTS'
  ) {
    const response = await server.inject({
      method: 'POST',
      url: `/imports/preview/${kind}`,
      headers: { authorization: `Bearer ${token}`, 'content-type': contentType },
      payload,
    });
    expect(response.statusCode).toBe(200);
    return (readJson(response) as ApiSuccess<ImportPreviewResponse>).data;
  }

  async function confirmImport(token: string, importId: string, importIdentifier: string) {
    const response = await server.inject({
      method: 'POST',
      url: '/imports/confirm',
      headers: { authorization: `Bearer ${token}` },
      payload: { importId, importIdentifier },
    });
    expect(response.statusCode).toBe(200);
    return (readJson(response) as ApiSuccess<ConfirmImportResponse>).data;
  }

  function requireFound<T>(value: T | undefined, label: string): T {
    if (value === undefined) {
      throw new Error(`Expected ${label} to exist.`);
    }

    return value;
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
    const row = sqlite
      .prepare(
        `SELECT action FROM audit_log WHERE school_id = ? ORDER BY rowid DESC LIMIT 1`
      )
      .get(firstSchoolId) as { action: string } | undefined;

    return row?.action;
  }

  function countRows(table: 'subject' | 'classroom' | 'class_subject' | 'class_enrollment') {
    const row = sqlite
      .prepare(`SELECT COUNT(*) AS value FROM ${table} WHERE school_id = ?`)
      .get(firstSchoolId) as { value: number };

    return row.value;
  }

  function countRowsWhere(table: string, whereClause: string) {
    const row = sqlite
      .prepare(`SELECT COUNT(*) AS value FROM ${table} WHERE ${whereClause}`)
      .get() as { value: number };

    return row.value;
  }
});

function teacherCodeOf(teacherId: string) {
  switch (teacherId) {
    case teacherOneId:
      return 'NDS-DEMO-2026-T00001';
    case teacherTwoId:
      return 'NDS-DEMO-2026-T00002';
    case teacherThreeId:
      return 'NDS-DEMO-2026-T00003';
    case teacherFourId:
      return 'NDS-DEMO-2026-T00004';
    default:
      throw new Error(`Unknown teacher id: ${teacherId}`);
  }
}

function seedFixture(sqlite: Database.Database) {
  sqlite
    .prepare(
      `UPDATE user SET password_hash = ?, failed_login_attempts = 0, locked_until = NULL WHERE id = ?`
    )
    .run(passwordHash, schoolMasterId);

  sqlite
    .prepare(
      `INSERT INTO academic_year (id, school_id, label, start_date, end_date, is_current)
       VALUES (?, ?, ?, ?, ?, 1)`
    )
    .run(academicYearId, firstSchoolId, '2026-2027', '2026-09-01', '2027-06-30');

  const levels = [
    [levelSixId, '6E', 'Sixième', 1, 0],
    [levelThreeId, '3E', 'Troisième', 5, 1],
  ] as const;

  for (const [id, code, name, order, exam] of levels) {
    sqlite
      .prepare(
        `INSERT INTO class_level (id, school_id, code, name, display_order, is_exam_year)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(id, firstSchoolId, code, name, order, exam);
  }

  const students = [
    [studentOneId, 'NDS-DEMO-2026-S001', 'Ali', 'Ahmat', 'M', '2011-01-12'],
    [studentTwoId, 'NDS-DEMO-2026-S002', 'Aminata', 'Mahamat', 'F', '2012-03-14'],
    [studentThreeId, 'NDS-DEMO-2026-S003', 'Ibrahim', 'Ousmane', 'M', '2010-11-02'],
  ] as const;

  for (const [id, code, firstName, lastName, sex, dateOfBirth] of students) {
    sqlite
      .prepare(
        `INSERT INTO student (id, school_id, code, first_name, last_name, sex, date_of_birth)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(id, firstSchoolId, code, firstName, lastName, sex, dateOfBirth);
  }

  const teachers = [
    [teacherOneId, 'NDS-DEMO-2026-T00001', 'Jean', 'Nguet'],
    [teacherTwoId, 'NDS-DEMO-2026-T00002', 'Mariam', 'Abakar'],
    [teacherThreeId, 'NDS-DEMO-2026-T00003', 'Paul', 'Djasrangar'],
    [teacherFourId, 'NDS-DEMO-2026-T00004', 'Claudine', 'Mbai'],
  ] as const;

  for (const [id, code, firstName, lastName] of teachers) {
    sqlite
      .prepare(
        `INSERT INTO teacher (id, school_id, code, first_name, last_name)
         VALUES (?, ?, ?, ?, ?)`
      )
      .run(id, firstSchoolId, code, firstName, lastName);
  }
}

function buildMultipart(buffer: Buffer, filename: string) {
  const boundary = '----vitest-phase4-gate-boundary-9d1f';
  const head = Buffer.from(
    `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="file"; filename="${filename}"\r\n` +
      'Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet\r\n' +
      '\r\n'
  );
  const tail = Buffer.from(`\r\n--${boundary}--\r\n`);

  return {
    payload: Buffer.concat([head, buffer, tail]),
    contentType: `multipart/form-data; boundary=${boundary}`,
  };
}

function classSubjectWorkbook(rows: (string | number | null)[][]) {
  const columns = ['Code classe', 'Code matière', 'Coefficient', 'Obligatoire', 'Code professeur'];
  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.aoa_to_sheet([columns, ...rows]);
  XLSX.utils.book_append_sheet(workbook, sheet, 'Donnees');

  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}

function readJson(response: { body: string }) {
  return JSON.parse(response.body) as unknown;
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
