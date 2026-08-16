import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { randomUUID } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { EduTrackDatabase } from '../client.js';
import { createTenantContext, type TenantContext } from '../repositories/base.js';
import { createAcademicYearRepository } from '../repositories/academic-year.repository.js';
import { createClassLevelRepository } from '../repositories/class-level.repository.js';
import { createClassroomRepository } from '../repositories/classroom.repository.js';
import { createClassEnrollmentRepository } from '../repositories/class-enrollment.repository.js';
import { createStudentRepository } from '../repositories/student.repository.js';
import * as schema from '../schema.sqlite.js';
import { foundationSeed, seedFoundation } from '../seeds.js';

const migrationsDir = fileURLToPath(new URL('../../migrations/sqlite/', import.meta.url));
const fixedAt = '2026-08-15T10:00:00.000Z';

describe('class-enrollment repository', () => {
  let sqlite: Database.Database;
  let db: EduTrackDatabase;

  beforeEach(() => {
    sqlite = new Database(':memory:');
    sqlite.pragma('foreign_keys = ON');
    applyAllMigrations(sqlite);
    db = drizzle(sqlite, { schema });
    seedFoundation(db);
  });

  afterEach(() => {
    sqlite.close();
  });

  function createClassroom(schoolId: string, code = '3E-A') {
    const tenant = createTenantContext(schoolId);
    const yearId = getOrCreateYear(tenant);
    const levelId = getOrCreateLevel(tenant);
    const classroom = createClassroomRepository(db, tenant).create({
      academicYearId: yearId,
      classLevelId: levelId,
      code,
    });

    return { classroomId: classroom.id, yearId };
  }

  function getOrCreateYear(tenant: TenantContext) {
    const existing = createAcademicYearRepository(db, tenant).findActiveByLabel('2026-2027');
    if (existing) {
      return existing.id;
    }
    return createAcademicYearRepository(db, tenant).createCurrent(
      { label: '2026-2027', startDate: '2026-09-01', endDate: '2027-06-30' },
      fixedAt
    ).id;
  }

  function getOrCreateLevel(tenant: TenantContext) {
    const existing = createClassLevelRepository(db, tenant).listActive()[0];
    if (existing) {
      return existing.id;
    }
    createClassLevelRepository(db, tenant).replaceActive(
      [{ code: '3E', name: 'Troisième', displayOrder: 1, isExamYear: true }],
      fixedAt
    );
    const created = createClassLevelRepository(db, tenant).listActive()[0];
    if (!created) {
      throw new Error('fixture level missing');
    }
    return created.id;
  }

  function createStudent(schoolId: string, code: string) {
    const tenant = createTenantContext(schoolId);
    return createStudentRepository(db, tenant).create({
      code,
      firstName: 'Aminata',
      lastName: 'Mahamat',
    });
  }

  it('creates an enrollment scoped to the tenant with ACTIVE status by default', () => {
    const [school] = foundationSeed.schools;
    const tenant = createTenantContext(school.id);
    const repository = createClassEnrollmentRepository(db, tenant);
    const { classroomId, yearId } = createClassroom(school.id);
    const student = createStudent(school.id, 'NDS-DEMO-2026-000000001');

    const created = repository.create({
      studentId: student.id,
      classroomId,
      academicYearId: yearId,
      enrollmentDate: '2026-09-01',
    });

    expect(created).toMatchObject({
      schoolId: school.id,
      studentId: student.id,
      classroomId,
      academicYearId: yearId,
      status: 'ACTIVE',
      enrollmentDate: '2026-09-01',
      exitDate: null,
      reason: null,
    });
    expect(created.recordVersion).toBe(1);
  });

  it('allows at most one ACTIVE enrollment per student and year', () => {
    const [school] = foundationSeed.schools;
    const tenant = createTenantContext(school.id);
    const repository = createClassEnrollmentRepository(db, tenant);
    const first = createClassroom(school.id, '3E-A');
    const second = createClassroom(school.id, '3E-B');
    const student = createStudent(school.id, 'NDS-DEMO-2026-000000002');

    repository.create({
      studentId: student.id,
      classroomId: first.classroomId,
      academicYearId: first.yearId,
      enrollmentDate: '2026-09-01',
    });

    // A second ACTIVE enrollment in the same year is rejected.
    expect(() =>
      repository.create({
        studentId: student.id,
        classroomId: second.classroomId,
        academicYearId: first.yearId,
        enrollmentDate: '2026-09-05',
      })
    ).toThrow();

    // Once the first enrollment leaves ACTIVE, a new one is allowed (transfer path).
    repository.updateStatus(
      repository.findActiveByStudentYear(student.id, first.yearId)?.id ?? '',
      'TRANSFERRED',
      fixedAt,
      { exitDate: '2026-10-01', reason: 'Changement de classe' }
    );

    const secondEnrollment = repository.create({
      studentId: student.id,
      classroomId: second.classroomId,
      academicYearId: first.yearId,
      enrollmentDate: '2026-10-02',
    });
    expect(secondEnrollment.classroomId).toBe(second.classroomId);
  });

  it('allows the same student to be active in a different year or school', () => {
    const [firstSchool] = foundationSeed.schools;
    const tenant = createTenantContext(firstSchool.id);
    const firstYearId = getOrCreateYear(tenant);
    const levelId = getOrCreateLevel(tenant);
    // Second year, non-current (a school has exactly one current year).
    const secondYearId = randomUUID();
    sqlite
      .prepare(
        `INSERT INTO academic_year (id, school_id, label, start_date, end_date, is_current)
         VALUES (?, ?, ?, ?, ?, 0)`
      )
      .run(secondYearId, firstSchool.id, '2027-2028', '2027-09-01', '2028-06-30');
    const firstClassroom = createClassroomRepository(db, tenant).create({
      academicYearId: firstYearId,
      classLevelId: levelId,
      code: '3E-A',
    });
    const secondClassroom = createClassroomRepository(db, tenant).create({
      academicYearId: secondYearId,
      classLevelId: levelId,
      code: '3E-A',
    });
    const student = createStudent(firstSchool.id, 'NDS-DEMO-2026-000000003');

    createClassEnrollmentRepository(db, tenant).create({
      studentId: student.id,
      classroomId: firstClassroom.id,
      academicYearId: firstYearId,
      enrollmentDate: '2026-09-01',
    });
    const nextYear = createClassEnrollmentRepository(db, tenant).create({
      studentId: student.id,
      classroomId: secondClassroom.id,
      academicYearId: secondYearId,
      enrollmentDate: '2027-09-01',
    });

    expect(nextYear.academicYearId).toBe(secondYearId);
  });

  it('keeps enrollments tenant-isolated across schools', () => {
    const [firstSchool, secondSchool] = foundationSeed.schools;
    const firstTenant = createTenantContext(firstSchool.id);
    const secondTenant = createTenantContext(secondSchool.id);
    const first = createClassroom(firstSchool.id, '3E-A');
    const second = createClassroom(secondSchool.id, '3E-A');
    const firstStudent = createStudent(firstSchool.id, 'SHARED-2026-000000001');
    const secondStudent = createStudent(secondSchool.id, 'SHARED-2026-000000001');

    // Same student code + same year active in two schools must both succeed.
    createClassEnrollmentRepository(db, firstTenant).create({
      studentId: firstStudent.id,
      classroomId: first.classroomId,
      academicYearId: first.yearId,
      enrollmentDate: '2026-09-01',
    });
    const other = createClassEnrollmentRepository(db, secondTenant).create({
      studentId: secondStudent.id,
      classroomId: second.classroomId,
      academicYearId: second.yearId,
      enrollmentDate: '2026-09-01',
    });

    expect(other.schoolId).toBe(secondSchool.id);
    expect(createClassEnrollmentRepository(db, firstTenant).count()).toBe(1);
    expect(createClassEnrollmentRepository(db, secondTenant).count()).toBe(1);
  });

  it('rejects an unknown status at the database level', () => {
    const [school] = foundationSeed.schools;
    const { classroomId, yearId } = createClassroom(school.id);
    const student = createStudent(school.id, 'NDS-DEMO-2026-000000004');

    expect(() =>
      sqlite
        .prepare(
          `INSERT INTO class_enrollment
             (id, school_id, student_id, classroom_id, academic_year_id, status, enrollment_date)
           VALUES (?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          '00000000-0000-4000-8000-000000000d01',
          school.id,
          student.id,
          classroomId,
          yearId,
          'PAUSED',
          '2026-09-01'
        )
    ).toThrow(/CHECK/i);
  });

  it('re-links the same classroom/student pair after an unlink-style archive', () => {
    const [school] = foundationSeed.schools;
    const tenant = createTenantContext(school.id);
    const repository = createClassEnrollmentRepository(db, tenant);
    const { classroomId, yearId } = createClassroom(school.id);
    const student = createStudent(school.id, 'NDS-DEMO-2026-000000005');

    const created = repository.create({
      studentId: student.id,
      classroomId,
      academicYearId: yearId,
      enrollmentDate: '2026-09-01',
    });
    repository.archive(created.id, fixedAt);

    const relinked = repository.create({
      studentId: student.id,
      classroomId,
      academicYearId: yearId,
      enrollmentDate: '2026-09-15',
    });
    expect(relinked.studentId).toBe(student.id);
  });

  it('lists and counts enrollments by classroom, student, year and status', () => {
    const [school] = foundationSeed.schools;
    const tenant = createTenantContext(school.id);
    const repository = createClassEnrollmentRepository(db, tenant);
    const { classroomId, yearId } = createClassroom(school.id);
    const firstStudent = createStudent(school.id, 'NDS-DEMO-2026-000000006');
    const secondStudent = createStudent(school.id, 'NDS-DEMO-2026-000000007');

    repository.create({
      studentId: firstStudent.id,
      classroomId,
      academicYearId: yearId,
      enrollmentDate: '2026-09-01',
    });
    const second = repository.create({
      studentId: secondStudent.id,
      classroomId,
      academicYearId: yearId,
      enrollmentDate: '2026-09-02',
    });

    expect(repository.count({ classroomId })).toBe(2);
    expect(repository.list({ classroomId })).toHaveLength(2);
    expect(repository.list({ studentId: secondStudent.id })).toHaveLength(1);
    expect(repository.list({ status: 'ACTIVE' })).toHaveLength(2);

    repository.updateStatus(second.id, 'WITHDRAWN', fixedAt, { reason: 'Départ' });
    expect(repository.count({ status: 'ACTIVE' })).toBe(1);
    expect(repository.count({ status: 'WITHDRAWN' })).toBe(1);
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
