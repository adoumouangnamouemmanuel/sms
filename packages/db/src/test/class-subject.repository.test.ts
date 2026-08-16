import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { EduTrackDatabase } from '../client.js';
import { createTenantContext } from '../repositories/base.js';
import { createAcademicYearRepository } from '../repositories/academic-year.repository.js';
import { createClassLevelRepository } from '../repositories/class-level.repository.js';
import { createClassroomRepository } from '../repositories/classroom.repository.js';
import { createClassSubjectRepository } from '../repositories/class-subject.repository.js';
import { createSubjectRepository } from '../repositories/subject.repository.js';
import { createTeacherRepository } from '../repositories/teacher.repository.js';
import * as schema from '../schema.sqlite.js';
import { foundationSeed, seedFoundation } from '../seeds.js';

const migrationsDir = fileURLToPath(new URL('../../migrations/sqlite/', import.meta.url));
const fixedAt = '2026-08-15T10:00:00.000Z';

describe('class-subject repository', () => {
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

  function createClassroomAndSubject(schoolId: string) {
    const tenant = createTenantContext(schoolId);
    const year = createAcademicYearRepository(db, tenant).createCurrent(
      { label: '2026-2027', startDate: '2026-09-01', endDate: '2027-06-30' },
      fixedAt
    );
    createClassLevelRepository(db, tenant).replaceActive(
      [{ code: '3E', name: 'Troisième', displayOrder: 1, isExamYear: true }],
      fixedAt
    );
    const level = createClassLevelRepository(db, tenant).listActive()[0];
    if (!level) {
      throw new Error('fixture year/level missing');
    }
    const classroom = createClassroomRepository(db, tenant).create({
      academicYearId: year.id,
      classLevelId: level.id,
      code: '3E-A',
    });
    const subject = createSubjectRepository(db, tenant).create({
      code: 'MATH',
      name: 'Mathématiques',
      category: 'MATHEMATIQUES',
    });

    return { classroomId: classroom.id, subjectId: subject.id };
  }

  it('creates a class-subject assignment scoped to the tenant', () => {
    const [school] = foundationSeed.schools;
    const tenant = createTenantContext(school.id);
    const repository = createClassSubjectRepository(db, tenant);
    const { classroomId, subjectId } = createClassroomAndSubject(school.id);

    const created = repository.create({
      classroomId,
      subjectId,
      coefficient: 4,
      isRequired: true,
    });

    expect(created).toMatchObject({
      schoolId: school.id,
      classroomId,
      subjectId,
      coefficient: 4,
      isRequired: true,
      teacherId: null,
      isActive: true,
    });
    expect(created.recordVersion).toBe(1);
  });

  it('rejects a duplicate classroom/subject pair and frees it after archive', () => {
    const [school] = foundationSeed.schools;
    const tenant = createTenantContext(school.id);
    const repository = createClassSubjectRepository(db, tenant);
    const { classroomId, subjectId } = createClassroomAndSubject(school.id);

    const created = repository.create({ classroomId, subjectId, coefficient: 3 });
    expect(() => repository.create({ classroomId, subjectId, coefficient: 5 })).toThrow();

    repository.archive(created.id, fixedAt);

    const recreated = repository.create({ classroomId, subjectId, coefficient: 5 });
    expect(recreated.coefficient).toBe(5);
  });

  it('allows the same subject pair in another classroom or school', () => {
    const [firstSchool, secondSchool] = foundationSeed.schools;
    const firstTenant = createTenantContext(firstSchool.id);
    const secondTenant = createTenantContext(secondSchool.id);
    const first = createClassroomAndSubject(firstSchool.id);
    const second = createClassroomAndSubject(secondSchool.id);

    // Same classroom (first) assigned twice is rejected; a second classroom in
    // the same school accepts the same subject.
    const firstRepo = createClassSubjectRepository(db, firstTenant);
    firstRepo.create({
      classroomId: first.classroomId,
      subjectId: first.subjectId,
      coefficient: 4,
    });
    const year = createAcademicYearRepository(db, firstTenant).findCurrent();
    const level = createClassLevelRepository(db, firstTenant).listActive()[0];
    const otherClassroom = createClassroomRepository(db, firstTenant).create({
      academicYearId: year?.id ?? '',
      classLevelId: level?.id ?? '',
      code: '3E-B',
    });
    const sameSchool = firstRepo.create({
      classroomId: otherClassroom.id,
      subjectId: first.subjectId,
      coefficient: 3,
    });

    const secondRepo = createClassSubjectRepository(db, secondTenant);
    const crossSchool = secondRepo.create({
      classroomId: second.classroomId,
      subjectId: second.subjectId,
      coefficient: 2,
    });

    expect(sameSchool.schoolId).toBe(firstSchool.id);
    expect(crossSchool.schoolId).toBe(secondSchool.id);
    expect(firstRepo.count()).toBe(2);
  });

  it('rejects a coefficient below 1 at the database level', () => {
    const [school] = foundationSeed.schools;
    const { classroomId, subjectId } = createClassroomAndSubject(school.id);

    expect(() =>
      sqlite
        .prepare(
          `INSERT INTO class_subject (id, school_id, classroom_id, subject_id, coefficient)
           VALUES (?, ?, ?, ?, ?)`
        )
        .run('00000000-0000-4000-8000-000000000c01', school.id, classroomId, subjectId, 0)
    ).toThrow(/CHECK/i);
  });

  it('assigns an optional teacher and lists by classroom or teacher', () => {
    const [school] = foundationSeed.schools;
    const tenant = createTenantContext(school.id);
    const repository = createClassSubjectRepository(db, tenant);
    const { classroomId, subjectId } = createClassroomAndSubject(school.id);
    const teacher = createTeacherRepository(db, tenant).create({
      code: 'NDS-DEMO-2026-000000001',
      firstName: 'Ibrahim',
      lastName: 'Ousmane',
    });

    const optional = repository.create({
      classroomId,
      subjectId,
      coefficient: 2,
      isRequired: false,
      teacherId: teacher.id,
    });

    expect(optional.isRequired).toBe(false);
    expect(optional.teacherId).toBe(teacher.id);
    expect(repository.list({ classroomId })).toHaveLength(1);
    expect(repository.list({ teacherId: teacher.id })).toHaveLength(1);
    expect(repository.findByClassroomSubject(classroomId, subjectId)?.id).toBe(optional.id);
  });

  it('updates coefficient, policy and teacher; archives without destroying history', () => {
    const [school] = foundationSeed.schools;
    const tenant = createTenantContext(school.id);
    const repository = createClassSubjectRepository(db, tenant);
    const { classroomId, subjectId } = createClassroomAndSubject(school.id);
    const teacher = createTeacherRepository(db, tenant).create({
      code: 'NDS-DEMO-2026-000000002',
      firstName: 'Aminata',
      lastName: 'Mahamat',
    });
    const created = repository.create({ classroomId, subjectId, coefficient: 3 });

    const updated = repository.update(
      created.id,
      { coefficient: 4, isRequired: false, teacherId: teacher.id },
      fixedAt
    );
    expect(updated).toMatchObject({ coefficient: 4, isRequired: false, teacherId: teacher.id });
    expect(updated.recordVersion).toBe(2);

    repository.archive(created.id, fixedAt);
    expect(repository.findById(created.id)?.isActive).toBe(false);
    repository.reactivate(created.id, fixedAt);
    expect(repository.findById(created.id)?.isActive).toBe(true);
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
