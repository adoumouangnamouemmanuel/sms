import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { randomUUID } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { EduTrackDatabase } from '../client.js';
import { createTenantContext } from '../repositories/base.js';
import { createAcademicYearRepository } from '../repositories/academic-year.repository.js';
import { createClassLevelRepository } from '../repositories/class-level.repository.js';
import { createClassroomRepository } from '../repositories/classroom.repository.js';
import * as schema from '../schema.sqlite.js';
import { foundationSeed, seedFoundation } from '../seeds.js';

const migrationsDir = fileURLToPath(new URL('../../migrations/sqlite/', import.meta.url));
const fixedAt = '2026-08-15T10:00:00.000Z';

describe('classroom repository', () => {
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

  function createYearAndLevel(schoolId: string) {
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
    return { yearId: year.id, levelId: level.id };
  }

  it('creates a classroom scoped to the tenant school and academic context', () => {
    const [school] = foundationSeed.schools;
    const repository = createClassroomRepository(db, createTenantContext(school.id));
    const { yearId, levelId } = createYearAndLevel(school.id);

    const created = repository.create({
      academicYearId: yearId,
      classLevelId: levelId,
      code: '3E-A',
      name: 'Troisième A',
      capacity: 45,
    });

    expect(created).toMatchObject({
      schoolId: school.id,
      academicYearId: yearId,
      classLevelId: levelId,
      code: '3E-A',
      name: 'Troisième A',
      capacity: 45,
      isActive: true,
    });
    expect(created.id).toHaveLength(36);
    expect(created.recordVersion).toBe(1);
  });

  it('rejects a duplicate year code in the same school and frees it after archive', () => {
    const [school] = foundationSeed.schools;
    const tenant = createTenantContext(school.id);
    const repository = createClassroomRepository(db, tenant);
    const { yearId, levelId } = createYearAndLevel(school.id);

    const created = repository.create({
      academicYearId: yearId,
      classLevelId: levelId,
      code: '3E-A',
    });
    expect(() =>
      repository.create({ academicYearId: yearId, classLevelId: levelId, code: '3E-A' })
    ).toThrow();

    repository.archive(created.id, fixedAt);

    const recreated = repository.create({
      academicYearId: yearId,
      classLevelId: levelId,
      code: '3E-A',
    });
    expect(recreated.isActive).toBe(true);
  });

  it('allows the same classroom code in a different academic year or school', () => {
    const [firstSchool, secondSchool] = foundationSeed.schools;
    const firstTenant = createTenantContext(firstSchool.id);
    const secondTenant = createTenantContext(secondSchool.id);
    const firstYear = createAcademicYearRepository(db, firstTenant).createCurrent(
      { label: '2026-2027', startDate: '2026-09-01', endDate: '2027-06-30' },
      fixedAt
    );
    const secondYear = createAcademicYearRepository(db, secondTenant).createCurrent(
      { label: '2026-2027', startDate: '2026-09-01', endDate: '2027-06-30' },
      fixedAt
    );
    // A previous year in the first school (non-current: one current year per school).
    const previousYearId = randomUUID();
    sqlite
      .prepare(
        `INSERT INTO academic_year (id, school_id, label, start_date, end_date, is_current, status)
         VALUES (?, ?, ?, ?, ?, 0, 'CLOSED')`
      )
      .run(previousYearId, firstSchool.id, '2025-2026', '2025-09-01', '2026-06-30');
    createClassLevelRepository(db, firstTenant).replaceActive(
      [{ code: '3E', name: 'Troisième', displayOrder: 1, isExamYear: true }],
      fixedAt
    );
    createClassLevelRepository(db, secondTenant).replaceActive(
      [{ code: '3E', name: 'Troisième', displayOrder: 1, isExamYear: true }],
      fixedAt
    );
    const firstLevel = createClassLevelRepository(db, firstTenant).listActive()[0];
    const secondLevel = createClassLevelRepository(db, secondTenant).listActive()[0];
    if (!firstLevel || !secondLevel) {
      throw new Error('fixture missing');
    }

    createClassroomRepository(db, firstTenant).create({
      academicYearId: firstYear.id,
      classLevelId: firstLevel.id,
      code: '6E-A',
    });
    const otherYear = createClassroomRepository(db, firstTenant).create({
      academicYearId: previousYearId,
      classLevelId: firstLevel.id,
      code: '6E-A',
    });
    const otherSchool = createClassroomRepository(db, secondTenant).create({
      academicYearId: secondYear.id,
      classLevelId: secondLevel.id,
      code: '6E-A',
    });

    expect(otherYear.academicYearId).toBe(previousYearId);
    expect(otherSchool.schoolId).toBe(secondSchool.id);
  });

  it('rejects an invalid capacity at the database level', () => {
    const [school] = foundationSeed.schools;
    const { yearId, levelId } = createYearAndLevel(school.id);

    expect(() =>
      sqlite
        .prepare(
          `INSERT INTO classroom (id, school_id, academic_year_id, class_level_id, code, capacity)
           VALUES (?, ?, ?, ?, ?, ?)`
        )
        .run('00000000-0000-4000-8000-000000000b01', school.id, yearId, levelId, '6E-A', 0)
    ).toThrow(/CHECK/i);
  });

  it('lists classrooms filtered by academic year and class level', () => {
    const [school] = foundationSeed.schools;
    const tenant = createTenantContext(school.id);
    const repository = createClassroomRepository(db, tenant);
    const { yearId, levelId } = createYearAndLevel(school.id);

    repository.create({ academicYearId: yearId, classLevelId: levelId, code: '3E-A' });
    repository.create({ academicYearId: yearId, classLevelId: levelId, code: '3E-B' });

    expect(repository.count({ academicYearId: yearId })).toBe(2);
    expect(repository.list({ academicYearId: yearId })).toHaveLength(2);
    expect(repository.list({ classLevelId: levelId })).toHaveLength(2);
    expect(repository.findByYearCode(yearId, '3E-B')?.id).toBeDefined();
  });

  it('updates a classroom and archives/reactivates without destroying history', () => {
    const [school] = foundationSeed.schools;
    const tenant = createTenantContext(school.id);
    const repository = createClassroomRepository(db, tenant);
    const { yearId, levelId } = createYearAndLevel(school.id);
    const created = repository.create({
      academicYearId: yearId,
      classLevelId: levelId,
      code: '6E-A',
      capacity: 40,
    });

    const updated = repository.update(created.id, { capacity: 35, name: 'Sixième A' }, fixedAt);
    expect(updated.capacity).toBe(35);
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
