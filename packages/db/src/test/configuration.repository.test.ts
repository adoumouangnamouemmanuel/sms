import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { EduTrackDatabase } from '../client.js';
import { createConfigurationRepository } from '../repositories/configuration.repository.js';
import { createTenantContext } from '../repositories/base.js';
import * as schema from '../schema.sqlite.js';
import { foundationSeed, seedFoundation } from '../seeds.js';

const migrationsDir = fileURLToPath(new URL('../../migrations/sqlite/', import.meta.url));
const firstSchoolId = '00000000-0000-4000-8000-000000000101';
const secondSchoolId = '00000000-0000-4000-8000-000000000102';

describe('configuration repository', () => {
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

  it('reports an empty snapshot for a freshly seeded school', () => {
    const repository = createConfigurationRepository(db, createTenantContext(firstSchoolId));

    expect(repository.getSnapshot()).toEqual({
      schoolProfileComplete: false,
      activeAcademicYear: false,
      levelCount: 0,
      subjectCount: 0,
      curriculumClassCount: 0,
      publishedGradingPolicies: 0,
      appreciationConfigured: false,
      validatedSubmissions: 0,
      bulletinConfigured: false,
    });
  });

  it('reads live profile, year, level, subject and curriculum facts', () => {
    const yearId = '00000000-0000-4000-8000-00000000a101';
    const levelId = '00000000-0000-4000-8000-00000000a102';
    const subjectId = '00000000-0000-4000-8000-00000000a103';
    const classroomId = '00000000-0000-4000-8000-00000000a104';

    sqlite.prepare(`UPDATE school SET setup_status = 'COMPLETED' WHERE id = ?`).run(firstSchoolId);
    sqlite
      .prepare(
        `INSERT INTO academic_year (id, school_id, label, start_date, end_date, is_current)
         VALUES (?, ?, '2026-2027', '2026-09-01', '2027-06-30', 1)`
      )
      .run(yearId, firstSchoolId);
    sqlite
      .prepare(
        `INSERT INTO class_level (id, school_id, code, name, display_order, is_exam_year)
         VALUES (?, ?, '6E', 'Sixième', 1, 0)`
      )
      .run(levelId, firstSchoolId);
    sqlite
      .prepare(
        `INSERT INTO subject (id, school_id, code, name, category)
         VALUES (?, ?, 'MATH', 'Mathématiques', 'MATHEMATIQUES')`
      )
      .run(subjectId, firstSchoolId);
    sqlite
      .prepare(
        `INSERT INTO classroom (id, school_id, academic_year_id, class_level_id, code, name)
         VALUES (?, ?, ?, ?, '6E-A', 'Sixième A')`
      )
      .run(classroomId, firstSchoolId, yearId, levelId);
    sqlite
      .prepare(
        `INSERT INTO class_subject (id, school_id, classroom_id, subject_id, coefficient)
         VALUES (?, ?, ?, ?, 3)`
      )
      .run('00000000-0000-4000-8000-00000000a105', firstSchoolId, classroomId, subjectId);

    const repository = createConfigurationRepository(db, createTenantContext(firstSchoolId));

    expect(repository.getSnapshot()).toMatchObject({
      schoolProfileComplete: true,
      activeAcademicYear: true,
      levelCount: 1,
      subjectCount: 1,
      curriculumClassCount: 1,
    });
  });

  it('ignores archived or soft-deleted records in the counts', () => {
    const levelId = '00000000-0000-4000-8000-00000000a102';
    const subjectId = '00000000-0000-4000-8000-00000000a103';

    sqlite
      .prepare(
        `INSERT INTO class_level (id, school_id, code, name, display_order, is_exam_year, is_active, deleted_at)
         VALUES (?, ?, '6E', 'Sixième', 1, 0, 0, '2026-08-01T00:00:00.000Z')`
      )
      .run(levelId, firstSchoolId);
    sqlite
      .prepare(
        `INSERT INTO subject (id, school_id, code, name, category, is_active, deleted_at)
         VALUES (?, ?, 'MATH', 'Mathématiques', 'MATHEMATIQUES', 0, '2026-08-01T00:00:00.000Z')`
      )
      .run(subjectId, firstSchoolId);

    const repository = createConfigurationRepository(db, createTenantContext(firstSchoolId));

    expect(repository.getSnapshot()).toMatchObject({
      levelCount: 0,
      subjectCount: 0,
    });
  });

  it('never leaks the other school data into the tenant snapshot', () => {
    const yearId = '00000000-0000-4000-8000-00000000b101';
    const levelId = '00000000-0000-4000-8000-00000000b102';

    sqlite.prepare(`UPDATE school SET setup_status = 'COMPLETED' WHERE id = ?`).run(firstSchoolId);
    sqlite
      .prepare(
        `INSERT INTO academic_year (id, school_id, label, start_date, end_date, is_current)
         VALUES (?, ?, '2026-2027', '2026-09-01', '2027-06-30', 1)`
      )
      .run(yearId, firstSchoolId);
    sqlite
      .prepare(
        `INSERT INTO class_level (id, school_id, code, name, display_order, is_exam_year)
         VALUES (?, ?, '6E', 'Sixième', 1, 0)`
      )
      .run(levelId, firstSchoolId);

    const repository = createConfigurationRepository(db, createTenantContext(secondSchoolId));

    expect(repository.getSnapshot()).toMatchObject({
      schoolProfileComplete: false,
      activeAcademicYear: false,
      levelCount: 0,
    });
  });

  it('reports the not-yet-implemented facts as unmet (policy, appreciation, bulletin)', () => {
    const repository = createConfigurationRepository(db, createTenantContext(firstSchoolId));
    const snapshot = repository.getSnapshot();

    expect(snapshot.publishedGradingPolicies).toBe(0);
    expect(snapshot.appreciationConfigured).toBe(false);
    expect(snapshot.validatedSubmissions).toBe(0);
    expect(snapshot.bulletinConfigured).toBe(false);
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
