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
  ClassRegisterExportResponse,
  ClassroomRosterResponse,
  ClassroomView,
  CurriculumCopyConfirmResponse,
  CurriculumCopyPreviewResponse,
  EnrolStudentsResponse,
  PaginatedClassroomsResponse,
  PaginatedSubjectsResponse,
  StudentsMissingClassResponse,
  SubjectResponse,
} from '@edutrack/shared';
import { buildServer } from '../server.js';
import { hashPassword } from '../modules/auth/index.js';

const migrationsDir = fileURLToPath(
  new URL('../../../../packages/db/migrations/sqlite/', import.meta.url)
);
const firstSchoolId = '00000000-0000-4000-8000-000000000101';
const schoolMasterId = '00000000-0000-4000-8000-000000000201';
const correctPassword = 'correct-password';
const accessTokenSecret = 'phase-4-classes-test-secret-with-local-only-scope';
const fixedNow = () => new Date('2026-08-15T10:00:00.000Z');

const academicYearId = '00000000-0000-4000-8000-00000000a001';
const levelSixId = '00000000-0000-4000-8000-00000000a101';
const levelThreeId = '00000000-0000-4000-8000-00000000a102';
const levelTerminaleId = '00000000-0000-4000-8000-00000000a103';
const studentOneId = '00000000-0000-4000-8000-00000000a201';
const studentTwoId = '00000000-0000-4000-8000-00000000a202';
const studentThreeId = '00000000-0000-4000-8000-00000000a203';
const teacherOneId = '00000000-0000-4000-8000-00000000a301';
const classroomSixA = '00000000-0000-4000-8000-00000000a401';
const classroomThreeA = '00000000-0000-4000-8000-00000000a402';
const subjectMathId = '00000000-0000-4000-8000-00000000a501';
const subjectFrenchId = '00000000-0000-4000-8000-00000000a502';
const subjectSportId = '00000000-0000-4000-8000-00000000a503';

let passwordHash: string;

describe('classes routes', () => {
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
    seedClassesFixture(sqlite);
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
  // Subjects
  // -------------------------------------------------------------------------

  it('creates a subject, uppercases its code, and writes an audit event', async () => {
    const accessToken = await loginAndReadAccessToken('directeur');
    const response = await server.inject({
      method: 'POST',
      url: '/subjects',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: {
        code: 'math',
        name: 'Mathématiques',
        nameEn: 'Mathematics',
        category: 'MATHEMATIQUES',
      },
    });

    expect(response.statusCode).toBe(200);
    const body = readJson(response) as ApiSuccess<SubjectResponse>;
    expect(body.data).toMatchObject({
      schoolId: firstSchoolId,
      code: 'MATH',
      name: 'Mathématiques',
      nameEn: 'Mathematics',
      category: 'MATHEMATIQUES',
      isActive: true,
    });
    expect(findLatestAuditAction()).toBe('SUBJECT_CREATE');
  });

  it('rejects duplicate subject codes with a 409', async () => {
    seedSubjectRow();
    const accessToken = await loginAndReadAccessToken('directeur');
    const response = await server.inject({
      method: 'POST',
      url: '/subjects',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { code: 'MATH', name: 'Autre maths', category: 'MATHEMATIQUES' },
    });

    expect(response.statusCode).toBe(409);
    expect((readJson(response) as ApiFailure).error.code).toBe('SUBJECT_CODE_EXISTS');
  });

  it('lists subjects with search and category filters', async () => {
    seedSubjectRow();
    const accessToken = await loginAndReadAccessToken('directeur');

    const all = await server.inject({
      method: 'GET',
      url: '/subjects',
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect((readJson(all) as ApiSuccess<PaginatedSubjectsResponse>).data.total).toBe(2);

    const byCategory = await server.inject({
      method: 'GET',
      url: '/subjects?category=SCIENCES',
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect((readJson(byCategory) as ApiSuccess<PaginatedSubjectsResponse>).data.total).toBe(0);

    const bySearch = await server.inject({
      method: 'GET',
      url: '/subjects?search=MAT',
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect((readJson(bySearch) as ApiSuccess<PaginatedSubjectsResponse>).data.total).toBe(1);
  });

  it('updates a subject and rejects a stale version', async () => {
    seedSubjectRow();
    const accessToken = await loginAndReadAccessToken('directeur');
    const subject = (
      readJson(
        await server.inject({
          method: 'GET',
          url: '/subjects',
          headers: { authorization: `Bearer ${accessToken}` },
        })
      ) as ApiSuccess<PaginatedSubjectsResponse>
    ).data.items[0];
    const found = requireFound(subject, 'subject');

    const stale = await server.inject({
      method: 'PUT',
      url: `/subjects/${found.id}`,
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { name: 'Nouveau nom', recordVersion: 999 },
    });
    expect(stale.statusCode).toBe(409);
    expect((readJson(stale) as ApiFailure).error.code).toBe('VERSION_CONFLICT');

    const updated = await server.inject({
      method: 'PUT',
      url: `/subjects/${found.id}`,
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { name: 'Nouveau nom', recordVersion: found.recordVersion },
    });
    expect(updated.statusCode).toBe(200);
    expect((readJson(updated) as ApiSuccess<SubjectResponse>).data).toMatchObject({
      name: 'Nouveau nom',
      recordVersion: 2,
    });
    expect(findLatestAuditAction()).toBe('SUBJECT_UPDATE');
  });

  it('archives and reactivates a subject', async () => {
    seedSubjectRow();
    const accessToken = await loginAndReadAccessToken('directeur');
    const subject = (
      readJson(
        await server.inject({
          method: 'GET',
          url: '/subjects',
          headers: { authorization: `Bearer ${accessToken}` },
        })
      ) as ApiSuccess<PaginatedSubjectsResponse>
    ).data.items[0];
    const found = requireFound(subject, 'subject');

    const archived = await server.inject({
      method: 'POST',
      url: `/subjects/${found.id}/archive`,
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { reason: 'Plus enseignee' },
    });
    expect((readJson(archived) as ApiSuccess<SubjectResponse>).data.isActive).toBe(false);

    const archivedList = await server.inject({
      method: 'GET',
      url: '/subjects?status=archived',
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect((readJson(archivedList) as ApiSuccess<PaginatedSubjectsResponse>).data.total).toBe(1);

    const activeList = await server.inject({
      method: 'GET',
      url: '/subjects',
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect((readJson(activeList) as ApiSuccess<PaginatedSubjectsResponse>).data.total).toBe(1);

    const reactivated = await server.inject({
      method: 'POST',
      url: `/subjects/${found.id}/reactivate`,
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { reason: 'Reprise' },
    });
    expect((readJson(reactivated) as ApiSuccess<SubjectResponse>).data.isActive).toBe(true);
  });

  // -------------------------------------------------------------------------
  // Classrooms
  // -------------------------------------------------------------------------

  it('creates a classroom with its level/year context and headcount', async () => {
    const accessToken = await loginAndReadAccessToken('directeur');
    const response = await server.inject({
      method: 'POST',
      url: '/classrooms',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: {
        academicYearId,
        classLevelId: levelSixId,
        code: '6e-a',
        name: '6e A',
        capacity: 45,
      },
    });

    expect(response.statusCode).toBe(200);
    const body = readJson(response) as ApiSuccess<ClassroomView>;
    expect(body.data).toMatchObject({
      classroom: {
        schoolId: firstSchoolId,
        code: '6E-A',
        capacity: 45,
        isActive: true,
      },
      classLevelCode: '6E',
      classLevelName: 'Sixième',
      academicYearLabel: '2026-2027',
      activeEnrollmentCount: 0,
    });
    expect(findLatestAuditAction()).toBe('CLASSROOM_CREATE');
  });

  it('rejects a duplicate classroom code in the same year', async () => {
    seedClassroomRow();
    const accessToken = await loginAndReadAccessToken('directeur');
    const response = await server.inject({
      method: 'POST',
      url: '/classrooms',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { academicYearId, classLevelId: levelSixId, code: '6E-A' },
    });

    expect(response.statusCode).toBe(409);
    expect((readJson(response) as ApiFailure).error.code).toBe('CLASSROOM_CODE_EXISTS');
  });

  it('rejects a classroom referencing an unknown academic year', async () => {
    const accessToken = await loginAndReadAccessToken('directeur');
    const response = await server.inject({
      method: 'POST',
      url: '/classrooms',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: {
        academicYearId: '00000000-0000-4000-8000-00000000ffff',
        classLevelId: levelSixId,
        code: '6E-A',
      },
    });

    expect(response.statusCode).toBe(404);
    expect((readJson(response) as ApiFailure).error.code).toBe('ACADEMIC_YEAR_NOT_FOUND');
  });

  it('lists classrooms filtered by level and updates capacity', async () => {
    seedClassroomRow();
    const accessToken = await loginAndReadAccessToken('directeur');

    const six = await server.inject({
      method: 'GET',
      url: `/classrooms?classLevelId=${levelSixId}`,
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect((readJson(six) as ApiSuccess<PaginatedClassroomsResponse>).data.total).toBe(1);

    const three = await server.inject({
      method: 'GET',
      url: `/classrooms?classLevelId=${levelThreeId}`,
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect((readJson(three) as ApiSuccess<PaginatedClassroomsResponse>).data.total).toBe(0);

    const created = requireFound(
      (readJson(six) as ApiSuccess<PaginatedClassroomsResponse>).data.items[0]?.classroom,
      'classroom'
    );
    const updated = await server.inject({
      method: 'PUT',
      url: `/classrooms/${created.id}`,
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { capacity: 50, recordVersion: created.recordVersion },
    });
    expect((readJson(updated) as ApiSuccess<ClassroomView>).data.classroom.capacity).toBe(50);
  });

  // -------------------------------------------------------------------------
  // Class-subjects
  // -------------------------------------------------------------------------

  it('assigns a subject with coefficient and teacher to a classroom', async () => {
    seedClassroomRow();
    seedSubjectRow();
    const accessToken = await loginAndReadAccessToken('directeur');
    const response = await server.inject({
      method: 'POST',
      url: '/class-subjects',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: {
        classroomId: classroomSixA,
        subjectId: subjectMathId,
        coefficient: 4,
        isRequired: true,
        teacherId: teacherOneId,
      },
    });

    expect(response.statusCode).toBe(200);
    const body = readJson(response) as ApiSuccess<ClassSubjectView>;
    expect(body.data).toMatchObject({
      classSubject: { coefficient: 4, isRequired: true, teacherId: teacherOneId },
      subjectCode: 'MATH',
      subjectName: 'Mathématiques',
      subjectCategory: 'MATHEMATIQUES',
      teacherName: 'Jean Nguet',
    });
    expect(findLatestAuditAction()).toBe('CLASS_SUBJECT_ASSIGN');
  });

  it('rejects an already-assigned pair and an unknown teacher', async () => {
    seedClassroomRow();
    seedSubjectRow();
    const accessToken = await loginAndReadAccessToken('directeur');
    const basePayload = {
      classroomId: classroomSixA,
      subjectId: subjectMathId,
      coefficient: 2,
      isRequired: true,
    };

    const first = await server.inject({
      method: 'POST',
      url: '/class-subjects',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: basePayload,
    });
    expect(first.statusCode).toBe(200);

    const duplicate = await server.inject({
      method: 'POST',
      url: '/class-subjects',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: basePayload,
    });
    expect(duplicate.statusCode).toBe(409);
    expect((readJson(duplicate) as ApiFailure).error.code).toBe('CLASS_SUBJECT_PAIR_EXISTS');

    const unknownTeacher = await server.inject({
      method: 'POST',
      url: '/class-subjects',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: {
        classroomId: classroomSixA,
        subjectId: subjectFrenchId,
        coefficient: 3,
        isRequired: false,
        teacherId: '00000000-0000-4000-8000-00000000ffff',
      },
    });
    expect(unknownTeacher.statusCode).toBe(404);
    expect((readJson(unknownTeacher) as ApiFailure).error.code).toBe('TEACHER_NOT_FOUND');
  });

  it('lists class-subjects with names and updates coefficient', async () => {
    seedClassroomRow();
    seedSubjectRow();
    const accessToken = await loginAndReadAccessToken('directeur');
    const created = (
      readJson(
        await server.inject({
          method: 'POST',
          url: '/class-subjects',
          headers: { authorization: `Bearer ${accessToken}` },
          payload: {
            classroomId: classroomSixA,
            subjectId: subjectMathId,
            coefficient: 2,
            isRequired: true,
          },
        })
      ) as ApiSuccess<ClassSubjectView>
    ).data;

    const list = await server.inject({
      method: 'GET',
      url: `/class-subjects?classroomId=${classroomSixA}`,
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect((readJson(list) as { success: boolean; data: ClassSubjectView[] }).data).toHaveLength(1);

    const updated = await server.inject({
      method: 'PUT',
      url: `/class-subjects/${created.classSubject.id}`,
      headers: { authorization: `Bearer ${accessToken}` },
      payload: {
        coefficient: 5,
        isRequired: false,
        recordVersion: created.classSubject.recordVersion,
      },
    });
    expect((readJson(updated) as ApiSuccess<ClassSubjectView>).data.classSubject).toMatchObject({
      coefficient: 5,
      isRequired: false,
    });
  });

  // -------------------------------------------------------------------------
  // Enrolment
  // -------------------------------------------------------------------------

  it('bulk-enrols students, auto-enrols required subjects, and reports per-item skips', async () => {
    seedClassroomRow();
    seedSubjectRow();
    seedEnrolmentSetup();
    const accessToken = await loginAndReadAccessToken('directeur');

    // Assign MATH (required) and EPS (optional) to the classroom.
    const mathAssignment = await assignSubject(
      accessToken,
      classroomSixA,
      subjectMathId,
      4,
      true,
      null
    );
    const sportAssignment = await assignSubject(
      accessToken,
      classroomSixA,
      subjectSportId,
      1,
      false,
      null
    );

    const response = await server.inject({
      method: 'POST',
      url: '/class-enrollments',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { classroomId: classroomSixA, studentIds: [studentOneId, studentTwoId] },
    });

    expect(response.statusCode).toBe(200);
    const body = readJson(response) as ApiSuccess<EnrolStudentsResponse>;
    expect(body.data).toMatchObject({ classroomId: classroomSixA, imported: 2, skipped: [] });

    const roster = await server.inject({
      method: 'GET',
      url: `/classrooms/${classroomSixA}/roster`,
      headers: { authorization: `Bearer ${accessToken}` },
    });
    const rosterBody = readJson(roster) as ApiSuccess<ClassroomRosterResponse>;
    expect(rosterBody.data.enrolledCount).toBe(2);
    expect(rosterBody.data.entries.map((entry) => entry.student.code).sort()).toEqual([
      'NDS-DEMO-2026-S001',
      'NDS-DEMO-2026-S002',
    ]);

    // Required subject auto-enrolled for both students; optional not.
    const requiredLinks = countRowsWhere(
      'student_subject_enrollment',
      `school_id = '${firstSchoolId}' AND class_subject_id = '${mathAssignment.classSubject.id}'`
    );
    expect(requiredLinks).toBe(2);
    const optionalLinks = countRowsWhere(
      'student_subject_enrollment',
      `school_id = '${firstSchoolId}' AND class_subject_id = '${sportAssignment.classSubject.id}'`
    );
    expect(optionalLinks).toBe(0);

    // A second enrolment of the same students is skipped per item, not failed.
    const repeat = await server.inject({
      method: 'POST',
      url: '/class-enrollments',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { classroomId: classroomSixA, studentIds: [studentOneId] },
    });
    const repeatBody = readJson(repeat) as ApiSuccess<EnrolStudentsResponse>;
    expect(repeatBody.data.imported).toBe(0);
    expect(repeatBody.data.skipped[0]).toMatchObject({
      studentId: studentOneId,
      ok: false,
      errorCode: 'ALREADY_ENROLLED',
    });
  });

  it('respects classroom capacity during enrolment', async () => {
    seedClassroomRow();
    seedEnrolmentSetup();
    const accessToken = await loginAndReadAccessToken('directeur');

    const updated = await server.inject({
      method: 'PUT',
      url: `/classrooms/${classroomSixA}`,
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { capacity: 1 },
    });
    expect(updated.statusCode).toBe(200);

    const response = await server.inject({
      method: 'POST',
      url: '/class-enrollments',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { classroomId: classroomSixA, studentIds: [studentOneId, studentTwoId] },
    });
    const body = readJson(response) as ApiSuccess<EnrolStudentsResponse>;
    expect(body.data.imported).toBe(1);
    expect(body.data.skipped[0]).toMatchObject({ errorCode: 'CAPACITY_EXCEEDED' });
  });

  it('transfers a student with effective date and reason while preserving history', async () => {
    seedClassroomRow();
    seedClassroomRowTwo();
    seedEnrolmentSetup();
    const accessToken = await loginAndReadAccessToken('directeur');

    await server.inject({
      method: 'POST',
      url: '/class-enrollments',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { classroomId: classroomSixA, studentIds: [studentOneId] },
    });

    const transfer = await server.inject({
      method: 'POST',
      url: `/students/${studentOneId}/transfer`,
      headers: { authorization: `Bearer ${accessToken}` },
      payload: {
        targetClassroomId: classroomThreeA,
        effectiveDate: '2026-11-02',
        reason: 'Changement de niveau sur decision de la famille',
      },
    });
    expect(transfer.statusCode).toBe(200);
    const transferBody = readJson(transfer) as ApiSuccess<{
      closed: { status: string; exitDate: string | null; reason: string | null };
      opened: { classroomId: string; status: string; enrollmentDate: string };
    }>;
    expect(transferBody.data.closed).toMatchObject({
      status: 'TRANSFERRED',
      exitDate: '2026-11-02',
    });
    expect(transferBody.data.opened).toMatchObject({
      classroomId: classroomThreeA,
      status: 'ACTIVE',
      enrollmentDate: '2026-11-02',
    });

    // History preserved: both rows exist for the student/year.
    expect(
      countRowsWhere(
        'class_enrollment',
        `school_id = '${firstSchoolId}' AND student_id = '${studentOneId}'`
      )
    ).toBe(2);
    expect(findLatestAuditAction()).toBe('ENROLMENT_TRANSFER');

    const roster = await server.inject({
      method: 'GET',
      url: `/classrooms/${classroomThreeA}/roster`,
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect((readJson(roster) as ApiSuccess<ClassroomRosterResponse>).data.enrolledCount).toBe(1);
  });

  it('lists active students missing an active class and rejects transfers without an enrolment', async () => {
    seedClassroomRow();
    seedEnrolmentSetup();
    const accessToken = await loginAndReadAccessToken('directeur');

    const missing = await server.inject({
      method: 'GET',
      url: '/students/missing-class',
      headers: { authorization: `Bearer ${accessToken}` },
    });
    const missingBody = readJson(missing) as ApiSuccess<StudentsMissingClassResponse>;
    expect(missingBody.data.academicYearLabel).toBe('2026-2027');
    expect(missingBody.data.total).toBe(3);
    expect(missingBody.data.students.map((student) => student.code).sort()).toEqual([
      'NDS-DEMO-2026-S001',
      'NDS-DEMO-2026-S002',
      'NDS-DEMO-2026-S003',
    ]);

    const noEnrolment = await server.inject({
      method: 'POST',
      url: `/students/${studentOneId}/transfer`,
      headers: { authorization: `Bearer ${accessToken}` },
      payload: {
        targetClassroomId: classroomSixA,
        effectiveDate: '2026-11-02',
        reason: 'Aucune inscription precedente',
      },
    });
    expect(noEnrolment.statusCode).toBe(404);
    expect((readJson(noEnrolment) as ApiFailure).error.code).toBe('ENROLLMENT_NOT_FOUND');
  });

  it('exports a class register as an injection-safe CSV', async () => {
    seedClassroomRow();
    seedEnrolmentSetup();
    const accessToken = await loginAndReadAccessToken('directeur');
    await server.inject({
      method: 'POST',
      url: '/class-enrollments',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { classroomId: classroomSixA, studentIds: [studentOneId] },
    });

    const response = await server.inject({
      method: 'GET',
      url: `/classrooms/${classroomSixA}/register`,
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(response.statusCode).toBe(200);
    const body = readJson(response) as ApiSuccess<ClassRegisterExportResponse>;
    expect(body.data.filename).toBe('registre-6e-a.csv');
    expect(body.data.content).toContain('Code;Nom;Prénom;Sexe;Date de naissance');
    expect(body.data.content).toContain('NDS-DEMO-2026-S001');
    expect(body.data.content).toContain('Ahmat;Ali');
  });

  it('enrols a student in optional subjects only, rejecting required ones', async () => {
    seedClassroomRow();
    seedSubjectRow();
    seedEnrolmentSetup();
    const accessToken = await loginAndReadAccessToken('directeur');
    await assignSubject(accessToken, classroomSixA, subjectMathId, 4, true, null);
    await assignSubject(accessToken, classroomSixA, subjectSportId, 1, false, null);
    await server.inject({
      method: 'POST',
      url: '/class-enrollments',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { classroomId: classroomSixA, studentIds: [studentOneId] },
    });

    // Get the optional class-subject id via the list endpoint.
    const list = await server.inject({
      method: 'GET',
      url: `/class-subjects?classroomId=${classroomSixA}`,
      headers: { authorization: `Bearer ${accessToken}` },
    });
    const views = (readJson(list) as { success: boolean; data: ClassSubjectView[] }).data;
    const optional = views.find((view) => !view.classSubject.isRequired);
    const required = views.find((view) => view.classSubject.isRequired);

    const ok = await server.inject({
      method: 'POST',
      url: '/class-enrollments/optional-subjects',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: {
        classroomId: classroomSixA,
        studentId: studentOneId,
        classSubjectIds: [optional?.classSubject.id ?? ''],
      },
    });
    expect(ok.statusCode).toBe(200);
    expect((readJson(ok) as { success: boolean; data: unknown[] }).data).toHaveLength(1);

    const rejected = await server.inject({
      method: 'POST',
      url: '/class-enrollments/optional-subjects',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: {
        classroomId: classroomSixA,
        studentId: studentOneId,
        classSubjectIds: [required?.classSubject.id ?? ''],
      },
    });
    expect(rejected.statusCode).toBe(409);
    expect((readJson(rejected) as ApiFailure).error.code).toBe('CLASS_SUBJECT_REQUIRED_LINK');
  });

  // -------------------------------------------------------------------------
  // Curriculum copy
  // -------------------------------------------------------------------------

  it('previews a curriculum copy and confirms it idempotently', async () => {
    seedClassroomRow();
    seedClassroomRowTwo();
    seedSubjectRow();
    const accessToken = await loginAndReadAccessToken('directeur');
    await assignSubject(accessToken, classroomSixA, subjectMathId, 4, true, teacherOneId);
    await assignSubject(accessToken, classroomSixA, subjectFrenchId, 3, false, null);

    // Target already has FR - the preview flags it as already assigned.
    await assignSubject(accessToken, classroomThreeA, subjectFrenchId, 2, true, null);

    const preview = await server.inject({
      method: 'POST',
      url: '/curriculum/copy/preview',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { sourceClassroomId: classroomSixA, targetClassroomId: classroomThreeA },
    });
    expect(preview.statusCode).toBe(200);
    const previewBody = readJson(preview) as ApiSuccess<CurriculumCopyPreviewResponse>;
    expect(previewBody.data.items).toHaveLength(2);
    expect(previewBody.data.newCount).toBe(1);
    expect(previewBody.data.skippedCount).toBe(1);
    expect(
      previewBody.data.items.find((item) => item.subjectCode === 'MATH')?.alreadyAssigned
    ).toBe(false);
    expect(previewBody.data.items.find((item) => item.subjectCode === 'FR')?.alreadyAssigned).toBe(
      true
    );

    const confirm = await server.inject({
      method: 'POST',
      url: '/curriculum/copy/confirm',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { sourceClassroomId: classroomSixA, targetClassroomId: classroomThreeA },
    });
    expect(confirm.statusCode).toBe(200);
    const confirmBody = readJson(confirm) as ApiSuccess<CurriculumCopyConfirmResponse>;
    expect(confirmBody.data).toMatchObject({ assigned: 1, skipped: 1 });

    const repeat = await server.inject({
      method: 'POST',
      url: '/curriculum/copy/confirm',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { sourceClassroomId: classroomSixA, targetClassroomId: classroomThreeA },
    });
    expect((readJson(repeat) as ApiSuccess<CurriculumCopyConfirmResponse>).data).toMatchObject({
      assigned: 0,
      skipped: 2,
    });

    // The copied MATH assignment keeps its coefficient and teacher.
    const targetList = await server.inject({
      method: 'GET',
      url: `/class-subjects?classroomId=${classroomThreeA}`,
      headers: { authorization: `Bearer ${accessToken}` },
    });
    const targetViews = (readJson(targetList) as { success: boolean; data: ClassSubjectView[] })
      .data;
    expect(targetViews).toHaveLength(2);
    expect(targetViews.find((view) => view.subjectCode === 'MATH')?.classSubject).toMatchObject({
      coefficient: 4,
      teacherId: teacherOneId,
    });
  });

  // -------------------------------------------------------------------------
  // Authorization
  // -------------------------------------------------------------------------

  it('rejects a non-school-master role from managing classes', async () => {
    seedClassroomRow();
    seedSubjectRow();
    const accessToken = await loginAndReadAccessToken('enseignant');
    const response = await server.inject({
      method: 'POST',
      url: '/subjects',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { code: 'GEO', name: 'Géographie', category: 'SCIENCES_SOCIALES' },
    });

    expect(response.statusCode).toBe(403);
    expect((readJson(response) as ApiFailure).error.code).toBe('FORBIDDEN');
  });

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  async function assignSubject(
    accessToken: string,
    classroomId: string,
    subjectId: string,
    coefficient: number,
    isRequired: boolean,
    teacherId: string | null
  ) {
    const response = await server.inject({
      method: 'POST',
      url: '/class-subjects',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { classroomId, subjectId, coefficient, isRequired, teacherId },
    });
    expect(response.statusCode).toBe(200);
    return (readJson(response) as ApiSuccess<ClassSubjectView>).data;
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

  function seedSubjectRow() {
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

  function seedClassroomRow() {
    sqlite
      .prepare(
        `
          INSERT INTO classroom (id, school_id, academic_year_id, class_level_id, code, name)
          VALUES (?, ?, ?, ?, ?, ?)
        `
      )
      .run(classroomSixA, firstSchoolId, academicYearId, levelSixId, '6E-A', '6e A');
  }

  function requireFound<T>(value: T | undefined, label: string): T {
    if (value === undefined) {
      throw new Error(`Expected ${label} to exist.`);
    }

    return value;
  }

  function countRowsWhere(table: string, whereClause: string) {
    const row = sqlite
      .prepare(`SELECT COUNT(*) AS value FROM ${table} WHERE ${whereClause}`)
      .get() as { value: number };

    return row.value;
  }

  function seedClassroomRowTwo() {
    sqlite
      .prepare(
        `
          INSERT INTO classroom (id, school_id, academic_year_id, class_level_id, code, name)
          VALUES (?, ?, ?, ?, ?, ?)
        `
      )
      .run(classroomThreeA, firstSchoolId, academicYearId, levelThreeId, '3E-A', '3e A');
  }

  function seedEnrolmentSetup() {
    sqlite
      .prepare(
        `
          INSERT INTO subject (id, school_id, code, name, category)
          VALUES (?, ?, ?, ?, ?)
        `
      )
      .run(subjectSportId, firstSchoolId, 'EPS', 'Éducation physique', 'SPORTS');
  }
});

function seedClassesFixture(sqlite: Database.Database) {
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
        INSERT INTO academic_year (id, school_id, label, start_date, end_date, is_current)
        VALUES (?, ?, ?, ?, ?, 1)
      `
    )
    .run(academicYearId, firstSchoolId, '2026-2027', '2026-09-01', '2027-06-30');

  const levels = [
    [levelSixId, '6E', 'Sixième', 1, 0],
    [levelThreeId, '3E', 'Troisième', 5, 1],
    [levelTerminaleId, 'TLE', 'Terminale', 7, 1],
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

  const students = [
    [studentOneId, 'NDS-DEMO-2026-S001', 'Ali', 'Ahmat', 'M', '2011-01-12'],
    [studentTwoId, 'NDS-DEMO-2026-S002', 'Aminata', 'Mahamat', 'F', '2012-03-14'],
    [studentThreeId, 'NDS-DEMO-2026-S003', 'Ibrahim', 'Ousmane', 'M', '2010-11-02'],
  ] as const;

  for (const [id, code, firstName, lastName, sex, dateOfBirth] of students) {
    sqlite
      .prepare(
        `
          INSERT INTO student (id, school_id, code, first_name, last_name, sex, date_of_birth)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `
      )
      .run(id, firstSchoolId, code, firstName, lastName, sex, dateOfBirth);
  }

  sqlite
    .prepare(
      `
        INSERT INTO teacher (id, school_id, code, first_name, last_name)
        VALUES (?, ?, ?, ?, ?)
      `
    )
    .run(teacherOneId, firstSchoolId, 'NDS-DEMO-2026-T00001', 'Jean', 'Nguet');
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

interface ApiFailure {
  success: false;
  error: { code: string; message: string };
}
