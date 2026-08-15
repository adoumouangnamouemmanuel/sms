import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { EduTrackDatabase } from '../client.js';
import { createTenantContext } from '../repositories/base.js';
import { createUserRepository } from '../repositories/user.repository.js';
import * as schema from '../schema.sqlite.js';
import { foundationSeed, seedFoundation } from '../seeds.js';

const migrationsDir = fileURLToPath(new URL('../../migrations/sqlite/', import.meta.url));

describe('user repository', () => {
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

  it('creates a TEACHER account and finds it by username regardless of status', () => {
    const [school] = foundationSeed.schools;
    const repository = createUserRepository(db, createTenantContext(school.id));

    const created = repository.createUser({
      id: '77777777-7777-4777-8777-777777777701',
      username: 'ibrahim.ousmane',
      passwordHash: 'stored-hash',
      role: 'TEACHER',
    });

    expect(created.isActive).toBe(true);
    expect(created.role).toBe('TEACHER');
    expect(repository.findByUsername('ibrahim.ousmane')?.id).toBe(created.id);
    expect(repository.findByIdAnyStatus(created.id)?.username).toBe('ibrahim.ousmane');
  });

  it('deactivates and reactivates an account while keeping the username taken', () => {
    const [school] = foundationSeed.schools;
    const repository = createUserRepository(db, createTenantContext(school.id));
    const created = repository.createUser({
      username: 'fatime.abakar',
      passwordHash: 'stored-hash',
      role: 'TEACHER',
    });

    const deactivated = repository.deactivate(created.id, '2026-08-15T10:00:00.000Z');
    expect(deactivated.isActive).toBe(false);
    expect(repository.findActiveByUsername('fatime.abakar')).toBeUndefined();
    // The username is never freed for reuse, even after deactivation.
    expect(repository.findByUsername('fatime.abakar')?.id).toBe(created.id);
    expect(repository.findByIdAnyStatus(created.id)?.isActive).toBe(false);

    const reactivated = repository.reactivate(created.id, '2026-08-16T10:00:00.000Z');
    expect(reactivated.isActive).toBe(true);
    expect(reactivated.recordVersion).toBe(3);
    expect(repository.findActiveByUsername('fatime.abakar')?.id).toBe(created.id);
  });

  it('scopes users to their school', () => {
    const [firstSchool, secondSchool] = foundationSeed.schools;
    const firstRepository = createUserRepository(db, createTenantContext(firstSchool.id));
    const created = firstRepository.createUser({
      username: 'scope-check',
      passwordHash: 'stored-hash',
      role: 'SCHOOL_MASTER',
    });

    const secondSchoolLookup = createUserRepository(
      db,
      createTenantContext(secondSchool.id)
    ).findByIdAnyStatus(created.id);

    expect(secondSchoolLookup).toBeUndefined();
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
