import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { EduTrackDatabase } from '../client.js';
import { createGuardianRepository } from '../repositories/guardian.repository.js';
import { createTenantContext } from '../repositories/base.js';
import * as schema from '../schema.sqlite.js';
import { foundationSeed, seedFoundation } from '../seeds.js';

const migrationsDir = fileURLToPath(new URL('../../migrations/sqlite/', import.meta.url));

describe('guardian repository', () => {
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

  it('creates a guardian scoped to the tenant school', () => {
    const [school] = foundationSeed.schools;
    const repository = createGuardianRepository(db, createTenantContext(school.id));

    const created = repository.create({
      firstName: 'Fatime',
      lastName: 'Abakar',
      phone: '+23500000010',
      email: 'fatime@example.test',
    });

    expect(created).toMatchObject({
      schoolId: school.id,
      firstName: 'Fatime',
      lastName: 'Abakar',
      phone: '+23500000010',
      email: 'fatime@example.test',
      isActive: true,
      recordVersion: 1,
    });
    expect(created.address).toBeNull();
  });

  it('allows duplicate guardian names', () => {
    const [school] = foundationSeed.schools;
    const repository = createGuardianRepository(db, createTenantContext(school.id));

    repository.create({ firstName: 'Fatime', lastName: 'Abakar' });
    repository.create({ firstName: 'Fatime', lastName: 'Abakar' });

    expect(repository.listActive()).toHaveLength(2);
  });

  it('searches active guardians by name fragment', () => {
    const [school] = foundationSeed.schools;
    const repository = createGuardianRepository(db, createTenantContext(school.id));

    repository.create({ firstName: 'Fatime', lastName: 'Abakar' });
    repository.create({ firstName: 'Mahamat', lastName: 'Ousmane' });

    const matches = repository.listActive({ search: 'Abakar' });
    expect(matches).toHaveLength(1);
    expect(matches[0]?.firstName).toBe('Fatime');
    expect(repository.countActive({ search: 'Abakar' })).toBe(1);
    expect(repository.countActive()).toBe(2);
  });

  it('archives and reactivates a guardian', () => {
    const [school] = foundationSeed.schools;
    const repository = createGuardianRepository(db, createTenantContext(school.id));
    const created = repository.create({ firstName: 'Fatime', lastName: 'Abakar' });

    const archived = repository.archive(created.id, '2026-09-01T00:00:00.000Z');
    expect(archived.isActive).toBe(false);
    expect(archived.deletedAt).not.toBeNull();
    expect(repository.listActive()).toHaveLength(0);

    const reactivated = repository.reactivate(created.id, '2026-09-02T00:00:00.000Z');
    expect(reactivated.isActive).toBe(true);
    expect(reactivated.deletedAt).toBeNull();
    expect(repository.listActive()).toHaveLength(1);
  });

  it('lists archived guardians separately from active ones', () => {
    const [school] = foundationSeed.schools;
    const repository = createGuardianRepository(db, createTenantContext(school.id));

    repository.create({ firstName: 'Fatime', lastName: 'Abakar' });
    const archived = repository.create({ firstName: 'Mahamat', lastName: 'Ousmane' });
    repository.archive(archived.id, '2026-08-15T10:00:00.000Z');

    expect(repository.list().map((guardianRecord) => guardianRecord.lastName)).toEqual(['Abakar']);
    expect(
      repository.list({ status: 'archived' }).map((guardianRecord) => guardianRecord.lastName)
    ).toEqual(['Ousmane']);
    expect(repository.count()).toBe(1);
    expect(repository.count({ status: 'archived' })).toBe(1);
    expect(repository.list({ status: 'archived', search: 'Abakar' })).toHaveLength(0);
  });

  it('updates only the explicitly provided fields', () => {
    const [school] = foundationSeed.schools;
    const repository = createGuardianRepository(db, createTenantContext(school.id));
    const created = repository.create({
      firstName: 'Fatime',
      lastName: 'Abakar',
      phone: '+23500000010',
    });

    const updated = repository.update(
      created.id,
      { lastName: 'Oumar', phone: null },
      '2026-09-03T00:00:00.000Z'
    );

    expect(updated).toMatchObject({
      firstName: 'Fatime',
      lastName: 'Oumar',
      phone: null,
      recordVersion: 2,
    });
  });

  it('isolates guardians between schools', () => {
    const [firstSchool, secondSchool] = foundationSeed.schools;
    const firstRepository = createGuardianRepository(db, createTenantContext(firstSchool.id));
    const secondRepository = createGuardianRepository(db, createTenantContext(secondSchool.id));

    const created = firstRepository.create({ firstName: 'Fatime', lastName: 'Abakar' });

    expect(secondRepository.findById(created.id)).toBeUndefined();
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
