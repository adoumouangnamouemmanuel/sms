import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { EduTrackDatabase } from '../client.js';
import { createTenantContext, type TenantContext } from '../repositories/base.js';
import { createAcademicYearRepository } from '../repositories/academic-year.repository.js';
import { createClassLevelRepository } from '../repositories/class-level.repository.js';
import { createClassroomRepository } from '../repositories/classroom.repository.js';
import { createClassSubjectRepository } from '../repositories/class-subject.repository.js';
import { createClassEnrollmentRepository } from '../repositories/class-enrollment.repository.js';
import { createStudentRepository } from '../repositories/student.repository.js';
import { createStudentSubjectEnrollmentRepository } from '../repositories/student-subject-enrollment.repository.js';
import { createSubjectRepository } from '../repositories/subject.repository.js';
import * as schema from '../schema.sqlite.js';
import { foundationSeed, seedFoundation } from '../seeds.js';

const migrationsDir = fileURLToPath(new URL('../../migrations/sqlite/', import.meta.url));
const fixedAt = '2026-08-15T10:00:00.000Z';

describe('student-subject-enrollment repository', () => {
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

  function createEnrollmentAndOptionalSubject(schoolId: string, suffix = 'A') {
    const tenant = createTenantContext(schoolId);
    const yearId = getOrCreateYear(tenant);
    const levelId = getOrCreateLevel(tenant);
    const classroom = createClassroomRepository(db, tenant).create({
      academicYearId: yearId,
      classLevelId: levelId,
      code: `3E-${suffix}`,
    });
    const subject = createSubjectRepository(db, tenant).create({
      code: `OPT-${suffix}`,
      name: 'Optionnel',
      category: 'ARTS',
    });
    const classSubject = createClassSubjectRepository(db, tenant).create({
      classroomId: classroom.id,
      subjectId: subject.id,
      coefficient: 1,
      isRequired: false,
    });
    const student = createStudentRepository(db, tenant).create({
      code: `NDS-DEMO-2026-0000000${String(suffix.charCodeAt(0) - 64)}`,
      firstName: 'Aminata',
      lastName: 'Mahamat',
    });
    const enrollment = createClassEnrollmentRepository(db, tenant).create({
      studentId: student.id,
      classroomId: classroom.id,
      academicYearId: yearId,
      enrollmentDate: '2026-09-01',
    });

    return { enrollmentId: enrollment.id, classSubjectId: classSubject.id };
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

  it('creates an optional-subject link scoped to the tenant', () => {
    const [school] = foundationSeed.schools;
    const tenant = createTenantContext(school.id);
    const repository = createStudentSubjectEnrollmentRepository(db, tenant);
    const { enrollmentId, classSubjectId } = createEnrollmentAndOptionalSubject(school.id);

    const created = repository.create({ classEnrollmentId: enrollmentId, classSubjectId });

    expect(created).toMatchObject({
      schoolId: school.id,
      classEnrollmentId: enrollmentId,
      classSubjectId,
      isActive: true,
    });
    expect(created.id).toHaveLength(36);
    expect(created.recordVersion).toBe(1);
  });

  it('rejects a duplicate enrollment/subject pair and frees it after archive', () => {
    const [school] = foundationSeed.schools;
    const tenant = createTenantContext(school.id);
    const repository = createStudentSubjectEnrollmentRepository(db, tenant);
    const { enrollmentId, classSubjectId } = createEnrollmentAndOptionalSubject(school.id);

    const created = repository.create({ classEnrollmentId: enrollmentId, classSubjectId });
    expect(() => repository.create({ classEnrollmentId: enrollmentId, classSubjectId })).toThrow();

    repository.archive(created.id, fixedAt);

    const recreated = repository.create({ classEnrollmentId: enrollmentId, classSubjectId });
    expect(recreated.isActive).toBe(true);
  });

  it('keeps links tenant-isolated across schools', () => {
    const [firstSchool, secondSchool] = foundationSeed.schools;
    const firstTenant = createTenantContext(firstSchool.id);
    const secondTenant = createTenantContext(secondSchool.id);
    const first = createEnrollmentAndOptionalSubject(firstSchool.id, 'A');
    const second = createEnrollmentAndOptionalSubject(secondSchool.id, 'B');

    createStudentSubjectEnrollmentRepository(db, firstTenant).create({
      classEnrollmentId: first.enrollmentId,
      classSubjectId: first.classSubjectId,
    });
    const other = createStudentSubjectEnrollmentRepository(db, secondTenant).create({
      classEnrollmentId: second.enrollmentId,
      classSubjectId: second.classSubjectId,
    });

    expect(other.schoolId).toBe(secondSchool.id);
    expect(createStudentSubjectEnrollmentRepository(db, firstTenant).count()).toBe(1);
    expect(createStudentSubjectEnrollmentRepository(db, secondTenant).count()).toBe(1);
  });

  it('lists and filters links by enrollment or class-subject', () => {
    const [school] = foundationSeed.schools;
    const tenant = createTenantContext(school.id);
    const repository = createStudentSubjectEnrollmentRepository(db, tenant);
    const first = createEnrollmentAndOptionalSubject(school.id, 'A');
    const second = createEnrollmentAndOptionalSubject(school.id, 'B');

    repository.create({
      classEnrollmentId: first.enrollmentId,
      classSubjectId: first.classSubjectId,
    });
    repository.create({
      classEnrollmentId: second.enrollmentId,
      classSubjectId: second.classSubjectId,
    });

    expect(repository.count()).toBe(2);
    expect(repository.list({ classEnrollmentId: first.enrollmentId })).toHaveLength(1);
    expect(repository.list({ classSubjectId: second.classSubjectId })).toHaveLength(1);
    expect(
      repository.findByEnrollmentSubject(second.enrollmentId, second.classSubjectId)?.id
    ).toBeDefined();
  });

  it('archives and reactivates a link without destroying history', () => {
    const [school] = foundationSeed.schools;
    const tenant = createTenantContext(school.id);
    const repository = createStudentSubjectEnrollmentRepository(db, tenant);
    const { enrollmentId, classSubjectId } = createEnrollmentAndOptionalSubject(school.id);
    const created = repository.create({ classEnrollmentId: enrollmentId, classSubjectId });

    const archived = repository.archive(created.id, fixedAt);
    expect(archived.isActive).toBe(false);
    expect(archived.deletedAt).toBe(fixedAt);
    expect(repository.findById(created.id)).toBeDefined();

    const reactivated = repository.reactivate(created.id, fixedAt);
    expect(reactivated.isActive).toBe(true);
    expect(reactivated.deletedAt).toBeNull();
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
