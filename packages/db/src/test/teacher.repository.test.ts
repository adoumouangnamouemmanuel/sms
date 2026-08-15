import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { EduTrackDatabase } from '../client.js';
import { createTenantContext } from '../repositories/base.js';
import { createTeacherRepository } from '../repositories/teacher.repository.js';
import { createUserRepository } from '../repositories/user.repository.js';
import * as schema from '../schema.sqlite.js';
import { foundationSeed, seedFoundation } from '../seeds.js';

const migrationsDir = fileURLToPath(new URL('../../migrations/sqlite/', import.meta.url));

describe('teacher repository', () => {
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

  it('creates a teacher scoped to the tenant school', () => {
    const [school] = foundationSeed.schools;
    const repository = createTeacherRepository(db, createTenantContext(school.id));

    const created = repository.create({
      code: 'NDS-DEMO-2026-T00001',
      firstName: 'Ibrahim',
      lastName: 'Ousmane',
      specialization: 'Mathematiques',
      hireDate: '2020-10-01',
    });

    expect(created).toMatchObject({
      schoolId: school.id,
      code: 'NDS-DEMO-2026-T00001',
      firstName: 'Ibrahim',
      lastName: 'Ousmane',
      specialization: 'Mathematiques',
      hireDate: '2020-10-01',
      userId: null,
      isActive: true,
      recordVersion: 1,
    });
  });

  it('rejects a duplicate teacher code in the same school, including after archive', () => {
    const [school] = foundationSeed.schools;
    const repository = createTeacherRepository(db, createTenantContext(school.id));
    const code = 'NDS-DEMO-2026-T00002';

    const created = repository.create({ code, firstName: 'Ibrahim', lastName: 'Ousmane' });
    expect(() => repository.create({ code, firstName: 'Other', lastName: 'Teacher' })).toThrow();

    repository.archive(created.id, '2026-09-01T00:00:00.000Z');

    // Strict uniqueness: archiving never frees the code for reuse.
    expect(() => repository.create({ code, firstName: 'New', lastName: 'Owner' })).toThrow();
  });

  it('allows the same teacher code in a different school', () => {
    const [firstSchool, secondSchool] = foundationSeed.schools;
    const code = 'SHARED-2026-T00001';

    createTeacherRepository(db, createTenantContext(firstSchool.id)).create({
      code,
      firstName: 'Ibrahim',
      lastName: 'Ousmane',
    });
    const secondSchoolTeacher = createTeacherRepository(
      db,
      createTenantContext(secondSchool.id)
    ).create({ code, firstName: 'Ali', lastName: 'Ahmat' });

    expect(secondSchoolTeacher.schoolId).toBe(secondSchool.id);
  });

  it('links a teacher to a login account of the same school', () => {
    const [school] = foundationSeed.schools;
    const tenant = createTenantContext(school.id);
    const user = createUserRepository(db, tenant).createUser({
      id: '66666666-6666-4666-8666-666666666666',
      username: 'enseignant1',
      passwordHash: 'stored-hash',
      role: 'TEACHER',
    });
    const repository = createTeacherRepository(db, tenant);

    const created = repository.create({
      code: 'NDS-DEMO-2026-T00010',
      firstName: 'Ibrahim',
      lastName: 'Ousmane',
      userId: user.id,
    });

    expect(created.userId).toBe(user.id);
  });

  it('rejects linking a teacher to a login account of another school', () => {
    const [firstSchool, secondSchool] = foundationSeed.schools;
    const otherSchoolUser = createUserRepository(
      db,
      createTenantContext(secondSchool.id)
    ).createUser({
      id: '66666666-6666-4666-8666-666666666667',
      username: 'enseignant2',
      passwordHash: 'stored-hash',
      role: 'TEACHER',
    });
    const repository = createTeacherRepository(db, createTenantContext(firstSchool.id));

    expect(() =>
      repository.create({
        code: 'NDS-DEMO-2026-T00011',
        firstName: 'Ibrahim',
        lastName: 'Ousmane',
        userId: otherSchoolUser.id,
      })
    ).toThrow();
  });

  it('keeps the record status independent from the login account status', () => {
    const [school] = foundationSeed.schools;
    const tenant = createTenantContext(school.id);
    const user = createUserRepository(db, tenant).createUser({
      id: '66666666-6666-4666-8666-666666666668',
      username: 'enseignant3',
      passwordHash: 'stored-hash',
      role: 'TEACHER',
    });
    const repository = createTeacherRepository(db, tenant);
    const created = repository.create({
      code: 'NDS-DEMO-2026-T00012',
      firstName: 'Ibrahim',
      lastName: 'Ousmane',
      userId: user.id,
    });

    const archived = repository.archive(created.id, '2026-09-01T00:00:00.000Z');
    expect(archived.isActive).toBe(false);

    const stillActiveUser = createUserRepository(db, tenant).findActiveByUsername('enseignant3');
    expect(stillActiveUser?.isActive).toBe(true);
    expect(stillActiveUser?.id).toBe(user.id);
  });

  it('archives and reactivates a teacher', () => {
    const [school] = foundationSeed.schools;
    const repository = createTeacherRepository(db, createTenantContext(school.id));
    const created = repository.create({
      code: 'NDS-DEMO-2026-T00020',
      firstName: 'Ibrahim',
      lastName: 'Ousmane',
    });

    const archived = repository.archive(created.id, '2026-09-01T00:00:00.000Z');
    expect(archived.isActive).toBe(false);
    expect(repository.listActive()).toHaveLength(0);

    const reactivated = repository.reactivate(created.id, '2026-09-02T00:00:00.000Z');
    expect(reactivated.isActive).toBe(true);
    expect(repository.listActive()).toHaveLength(1);
  });

  it('isolates teachers between schools', () => {
    const [firstSchool, secondSchool] = foundationSeed.schools;
    const firstRepository = createTeacherRepository(db, createTenantContext(firstSchool.id));
    const secondRepository = createTeacherRepository(db, createTenantContext(secondSchool.id));

    const created = firstRepository.create({
      code: 'NDS-DEMO-2026-T00030',
      firstName: 'Ibrahim',
      lastName: 'Ousmane',
    });

    expect(secondRepository.findById(created.id)).toBeUndefined();
    expect(secondRepository.findByCode('NDS-DEMO-2026-T00030')).toBeUndefined();
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
