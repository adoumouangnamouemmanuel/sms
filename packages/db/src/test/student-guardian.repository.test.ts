import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { EduTrackDatabase } from '../client';
import type { GuardianRelationshipType } from '@edutrack/shared';
import { createGuardianRepository } from '../repositories/guardian.repository';
import { createStudentGuardianRepository } from '../repositories/student-guardian.repository';
import { createStudentRepository } from '../repositories/student.repository';
import { createTenantContext } from '../repositories/base';
import * as schema from '../schema.sqlite';
import { foundationSeed, seedFoundation } from '../seeds';

const migrationsDir = fileURLToPath(new URL('../../migrations/sqlite/', import.meta.url));

describe('student-guardian repository', () => {
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

  it('links a student and guardian of the same school', () => {
    const [school] = foundationSeed.schools;
    const tenant = createTenantContext(school.id);
    const student = createStudentRepository(db, tenant).create({
      code: 'NDS-DEMO-2026-000000100',
      firstName: 'Aminata',
      lastName: 'Mahamat',
    });
    const guardian = createGuardianRepository(db, tenant).create({
      firstName: 'Fatime',
      lastName: 'Abakar',
    });
    const repository = createStudentGuardianRepository(db, tenant);

    const link = repository.link({
      studentId: student.id,
      guardianId: guardian.id,
      relationshipType: 'MERE',
      isPrimary: true,
      isEmergency: true,
    });

    expect(link).toMatchObject({
      schoolId: school.id,
      studentId: student.id,
      guardianId: guardian.id,
      relationshipType: 'MERE',
      isPrimary: true,
      isEmergency: true,
      recordVersion: 1,
    });
    expect(repository.listForStudent(student.id)).toHaveLength(1);
    expect(repository.listForGuardian(guardian.id)).toHaveLength(1);
  });

  it('rejects a duplicate student-guardian link', () => {
    const [school] = foundationSeed.schools;
    const tenant = createTenantContext(school.id);
    const student = createStudentRepository(db, tenant).create({
      code: 'NDS-DEMO-2026-000000101',
      firstName: 'Aminata',
      lastName: 'Mahamat',
    });
    const guardian = createGuardianRepository(db, tenant).create({
      firstName: 'Fatime',
      lastName: 'Abakar',
    });
    const repository = createStudentGuardianRepository(db, tenant);

    repository.link({ studentId: student.id, guardianId: guardian.id, relationshipType: 'MERE' });
    expect(() =>
      repository.link({ studentId: student.id, guardianId: guardian.id, relationshipType: 'PERE' })
    ).toThrow();
  });

  it('allows re-linking the same pair after an unlink', () => {
    const [school] = foundationSeed.schools;
    const tenant = createTenantContext(school.id);
    const student = createStudentRepository(db, tenant).create({
      code: 'NDS-DEMO-2026-000000102',
      firstName: 'Aminata',
      lastName: 'Mahamat',
    });
    const guardian = createGuardianRepository(db, tenant).create({
      firstName: 'Fatime',
      lastName: 'Abakar',
    });
    const repository = createStudentGuardianRepository(db, tenant);
    const link = repository.link({
      studentId: student.id,
      guardianId: guardian.id,
      relationshipType: 'MERE',
    });

    const unlinked = repository.unlink(link.id, '2026-09-01T00:00:00.000Z');
    expect(unlinked.deletedAt).not.toBeNull();
    expect(repository.listForStudent(student.id)).toHaveLength(0);

    const relinked = repository.link({
      studentId: student.id,
      guardianId: guardian.id,
      relationshipType: 'PERE',
    });
    expect(relinked.relationshipType).toBe('PERE');
  });

  it('allows at most one primary contact per student', () => {
    const [school] = foundationSeed.schools;
    const tenant = createTenantContext(school.id);
    const student = createStudentRepository(db, tenant).create({
      code: 'NDS-DEMO-2026-000000103',
      firstName: 'Aminata',
      lastName: 'Mahamat',
    });
    const mother = createGuardianRepository(db, tenant).create({
      firstName: 'Fatime',
      lastName: 'Abakar',
    });
    const father = createGuardianRepository(db, tenant).create({
      firstName: 'Mahamat',
      lastName: 'Abakar',
    });
    const repository = createStudentGuardianRepository(db, tenant);

    repository.link({
      studentId: student.id,
      guardianId: mother.id,
      relationshipType: 'MERE',
      isPrimary: true,
    });
    expect(() =>
      repository.link({
        studentId: student.id,
        guardianId: father.id,
        relationshipType: 'PERE',
        isPrimary: true,
      })
    ).toThrow();

    // A second guardian without the primary flag is accepted.
    const second = repository.link({
      studentId: student.id,
      guardianId: father.id,
      relationshipType: 'PERE',
      isEmergency: true,
    });
    expect(second.isPrimary).toBe(false);
    expect(repository.listForStudent(student.id)).toHaveLength(2);
  });

  it('supports siblings sharing one guardian and several guardians per student', () => {
    const [school] = foundationSeed.schools;
    const tenant = createTenantContext(school.id);
    const studentRepository = createStudentRepository(db, tenant);
    const firstSibling = studentRepository.create({
      code: 'NDS-DEMO-2026-000000104',
      firstName: 'Aminata',
      lastName: 'Mahamat',
    });
    const secondSibling = studentRepository.create({
      code: 'NDS-DEMO-2026-000000105',
      firstName: 'Fatime',
      lastName: 'Mahamat',
    });
    const guardianRepository = createGuardianRepository(db, tenant);
    const guardian = guardianRepository.create({ firstName: 'Fatime', lastName: 'Abakar' });
    const repository = createStudentGuardianRepository(db, tenant);

    repository.link({
      studentId: firstSibling.id,
      guardianId: guardian.id,
      relationshipType: 'MERE',
    });
    repository.link({
      studentId: secondSibling.id,
      guardianId: guardian.id,
      relationshipType: 'MERE',
    });

    expect(repository.listForGuardian(guardian.id)).toHaveLength(2);
    expect(repository.listForStudent(firstSibling.id)).toHaveLength(1);
    expect(repository.listForStudent(secondSibling.id)).toHaveLength(1);
  });

  it('rejects a link across schools', () => {
    const [firstSchool, secondSchool] = foundationSeed.schools;
    const firstTenant = createTenantContext(firstSchool.id);
    const student = createStudentRepository(db, firstTenant).create({
      code: 'NDS-DEMO-2026-000000106',
      firstName: 'Aminata',
      lastName: 'Mahamat',
    });
    const otherSchoolGuardian = createGuardianRepository(
      db,
      createTenantContext(secondSchool.id)
    ).create({ firstName: 'Autre', lastName: 'Ecole' });
    const repository = createStudentGuardianRepository(db, firstTenant);

    expect(() =>
      repository.link({
        studentId: student.id,
        guardianId: otherSchoolGuardian.id,
        relationshipType: 'TUTEUR',
      })
    ).toThrow();
  });

  it('rejects a relationship type outside the accepted enum', () => {
    const [school] = foundationSeed.schools;
    const tenant = createTenantContext(school.id);
    const student = createStudentRepository(db, tenant).create({
      code: 'NDS-DEMO-2026-000000107',
      firstName: 'Aminata',
      lastName: 'Mahamat',
    });
    const guardian = createGuardianRepository(db, tenant).create({
      firstName: 'Fatime',
      lastName: 'Abakar',
    });
    const repository = createStudentGuardianRepository(db, tenant);

    expect(() =>
      repository.link({
        studentId: student.id,
        guardianId: guardian.id,
        relationshipType: 'VOISIN' as GuardianRelationshipType,
      })
    ).toThrow();
  });

  it('updates link flags and unlink is tenant-scoped', () => {
    const [school] = foundationSeed.schools;
    const tenant = createTenantContext(school.id);
    const student = createStudentRepository(db, tenant).create({
      code: 'NDS-DEMO-2026-000000108',
      firstName: 'Aminata',
      lastName: 'Mahamat',
    });
    const guardian = createGuardianRepository(db, tenant).create({
      firstName: 'Fatime',
      lastName: 'Abakar',
    });
    const repository = createStudentGuardianRepository(db, tenant);
    const link = repository.link({
      studentId: student.id,
      guardianId: guardian.id,
      relationshipType: 'MERE',
    });

    const updated = repository.update(
      link.id,
      { relationshipType: 'TUTEUR', isEmergency: true },
      '2026-09-02T00:00:00.000Z'
    );
    expect(updated).toMatchObject({
      relationshipType: 'TUTEUR',
      isEmergency: true,
      recordVersion: 2,
    });

    const [, secondSchool] = foundationSeed.schools;
    const otherTenant = createTenantContext(secondSchool.id);
    expect(
      createStudentGuardianRepository(db, otherTenant).unlink(link.id, '2026-09-03T00:00:00.000Z')
    ).toBeUndefined();
    expect(repository.findById(link.id)?.deletedAt).toBeNull();
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
