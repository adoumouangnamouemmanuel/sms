import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { EduTrackDatabase } from '../client.js';
import { createTenantContext } from '../repositories/base.js';
import { createStudentRepository } from '../repositories/student.repository.js';
import * as schema from '../schema.sqlite.js';
import { foundationSeed, seedFoundation } from '../seeds.js';
import type { PersonSex } from '@edutrack/shared';

const migrationsDir = fileURLToPath(new URL('../../migrations/sqlite/', import.meta.url));

describe('student repository', () => {
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

  it('creates a student scoped to the tenant school', () => {
    const [school] = foundationSeed.schools;
    const repository = createStudentRepository(db, createTenantContext(school.id));

    const created = repository.create({
      code: 'NDS-DEMO-2026-000000001',
      firstName: 'Aminata',
      lastName: 'Mahamat',
      sex: 'F',
      dateOfBirth: '2012-04-15',
      nationality: 'Tchadienne',
    });

    expect(created).toMatchObject({
      schoolId: school.id,
      code: 'NDS-DEMO-2026-000000001',
      firstName: 'Aminata',
      lastName: 'Mahamat',
      sex: 'F',
      dateOfBirth: '2012-04-15',
      nationality: 'Tchadienne',
      isActive: true,
    });
    expect(created.id).toHaveLength(36);
    expect(created.recordVersion).toBe(1);
  });

  it('rejects a duplicate code in the same school, including after archive', () => {
    const [school] = foundationSeed.schools;
    const repository = createStudentRepository(db, createTenantContext(school.id));
    const code = 'NDS-DEMO-2026-000000002';

    const created = repository.create({ code, firstName: 'Ali', lastName: 'Mahamat' });
    expect(() => repository.create({ code, firstName: 'Other', lastName: 'Student' })).toThrow();

    repository.archive(created.id, '2026-09-01T00:00:00.000Z');

    // Strict uniqueness: archiving never frees the code for reuse.
    expect(() => repository.create({ code, firstName: 'New', lastName: 'Owner' })).toThrow();
  });

  it('allows the same code in a different school', () => {
    const [firstSchool, secondSchool] = foundationSeed.schools;
    const code = 'SHARED-2026-000000001';

    createStudentRepository(db, createTenantContext(firstSchool.id)).create({
      code,
      firstName: 'Aminata',
      lastName: 'Mahamat',
    });
    const secondSchoolStudent = createStudentRepository(
      db,
      createTenantContext(secondSchool.id)
    ).create({ code, firstName: 'Ibrahim', lastName: 'Ousmane' });

    expect(secondSchoolStudent.schoolId).toBe(secondSchool.id);
    expect(secondSchoolStudent.code).toBe(code);
  });

  it('allows duplicate names with distinct codes', () => {
    const [school] = foundationSeed.schools;
    const repository = createStudentRepository(db, createTenantContext(school.id));

    const first = repository.create({
      code: 'NDS-DEMO-2026-000000010',
      firstName: 'Aminata',
      lastName: 'Mahamat',
    });
    const second = repository.create({
      code: 'NDS-DEMO-2026-000000011',
      firstName: 'Aminata',
      lastName: 'Mahamat',
    });

    expect(first.code).not.toBe(second.code);
    expect(repository.listActive()).toHaveLength(2);
  });

  it('rejects a sex value outside the accepted enum through the database check', () => {
    const [school] = foundationSeed.schools;
    const repository = createStudentRepository(db, createTenantContext(school.id));

    expect(() =>
      repository.create({
        code: 'NDS-DEMO-2026-000000020',
        firstName: 'Aminata',
        lastName: 'Mahamat',
        sex: 'INCONNU' as PersonSex,
      })
    ).toThrow();
  });

  it('searches active students by name fragment and paginates', () => {
    const [school] = foundationSeed.schools;
    const repository = createStudentRepository(db, createTenantContext(school.id));

    repository.create({
      code: 'NDS-DEMO-2026-000000030',
      firstName: 'Aminata',
      lastName: 'Mahamat',
    });
    repository.create({
      code: 'NDS-DEMO-2026-000000031',
      firstName: 'Ibrahim',
      lastName: 'Ousmane',
    });
    repository.create({
      code: 'NDS-DEMO-2026-000000032',
      firstName: 'Fatime',
      lastName: 'Mahamat',
    });

    const matches = repository.listActive({ search: 'Mahamat' });
    expect(matches).toHaveLength(2);
    expect(matches.map((studentRecord) => studentRecord.firstName).sort()).toEqual([
      'Aminata',
      'Fatime',
    ]);

    expect(repository.listActive({ limit: 2 }).map((studentRecord) => studentRecord.code)).toEqual([
      'NDS-DEMO-2026-000000030',
      'NDS-DEMO-2026-000000032',
    ]);
    expect(
      repository.listActive({ limit: 2, offset: 2 }).map((studentRecord) => studentRecord.code)
    ).toEqual(['NDS-DEMO-2026-000000031']);
  });

  it('searches active students by code and counts totals for pagination', () => {
    const [school] = foundationSeed.schools;
    const repository = createStudentRepository(db, createTenantContext(school.id));

    repository.create({
      code: 'NDS-DEMO-2026-000000040',
      firstName: 'Aminata',
      lastName: 'Mahamat',
    });
    repository.create({
      code: 'NDS-DEMO-2026-000000041',
      firstName: 'Ibrahim',
      lastName: 'Ousmane',
    });

    const byCode = repository.listActive({ search: '2026-000000040' });
    expect(byCode).toHaveLength(1);
    expect(byCode[0]?.firstName).toBe('Aminata');
    expect(repository.countActive({ search: '000000040' })).toBe(1);
    expect(repository.countActive()).toBe(2);
  });

  it('counts archived students in the code sequence total', () => {
    const [school] = foundationSeed.schools;
    const repository = createStudentRepository(db, createTenantContext(school.id));

    const studentRecord = repository.create({
      code: 'NDS-DEMO-2026-000000050',
      firstName: 'Aminata',
      lastName: 'Mahamat',
    });

    expect(repository.countActive()).toBe(1);
    expect(repository.countAll()).toBe(1);

    repository.archive(studentRecord.id, '2026-08-15T10:00:00.000Z');

    expect(repository.countActive()).toBe(0);
    // Archived students keep their codes, so they stay in the sequence total.
    expect(repository.countAll()).toBe(1);
  });

  it('archives and reactivates a student', () => {
    const [school] = foundationSeed.schools;
    const repository = createStudentRepository(db, createTenantContext(school.id));
    const created = repository.create({
      code: 'NDS-DEMO-2026-000000040',
      firstName: 'Aminata',
      lastName: 'Mahamat',
    });

    const archived = repository.archive(created.id, '2026-09-01T00:00:00.000Z');
    expect(archived.isActive).toBe(false);
    expect(archived.deletedAt).not.toBeNull();
    expect(archived.recordVersion).toBe(2);
    expect(repository.listActive()).toHaveLength(0);

    const reactivated = repository.reactivate(created.id, '2026-09-02T00:00:00.000Z');
    expect(reactivated.isActive).toBe(true);
    expect(reactivated.deletedAt).toBeNull();
    expect(reactivated.recordVersion).toBe(3);
    expect(repository.listActive()).toHaveLength(1);
  });

  it('updates profile fields, bumps record version, and never changes the code', () => {
    const [school] = foundationSeed.schools;
    const repository = createStudentRepository(db, createTenantContext(school.id));
    const created = repository.create({
      code: 'NDS-DEMO-2026-000000050',
      firstName: 'Aminata',
      lastName: 'Mahamat',
      phone: '+23500000001',
    });

    const updated = repository.update(
      created.id,
      { lastName: 'Abakar', phone: null },
      '2026-09-03T00:00:00.000Z'
    );

    expect(updated).toMatchObject({
      code: 'NDS-DEMO-2026-000000050',
      firstName: 'Aminata',
      lastName: 'Abakar',
      phone: null,
      recordVersion: 2,
    });
    expect(updated.sex).toBeNull();
  });

  it('isolates students between schools', () => {
    const [firstSchool, secondSchool] = foundationSeed.schools;
    const firstRepository = createStudentRepository(db, createTenantContext(firstSchool.id));
    const secondRepository = createStudentRepository(db, createTenantContext(secondSchool.id));

    const created = firstRepository.create({
      code: 'NDS-DEMO-2026-000000060',
      firstName: 'Aminata',
      lastName: 'Mahamat',
    });

    expect(secondRepository.findById(created.id)).toBeUndefined();
    expect(secondRepository.findByCode('NDS-DEMO-2026-000000060')).toBeUndefined();
    expect(secondRepository.listActive()).toHaveLength(0);
  });
});

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
