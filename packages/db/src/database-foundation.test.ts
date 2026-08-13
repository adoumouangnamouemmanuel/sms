import Database from 'better-sqlite3';
import { count, eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { EduTrackDatabase } from './client';
import { withTransaction } from './client';
import { createTenantContext, createUserRepository } from './repositories';
import * as schema from './schema.sqlite';
import { foundationSeed, seedFoundation } from './seeds';

const migrationsDir = fileURLToPath(new URL('../migrations/sqlite/', import.meta.url));
const legacySchoolId = '11111111-1111-4111-8111-111111111111';
const legacyUserId = '22222222-2222-4222-8222-222222222222';

describe('database foundation migrations', () => {
  let sqlite: Database.Database;

  afterEach(() => {
    sqlite.close();
  });

  it('applies the 7.3 migration to a non-empty scaffold database', () => {
    sqlite = new Database(':memory:');
    sqlite.pragma('foreign_keys = ON');
    applyMigration(sqlite, '0000_public_mongu.sql');

    sqlite
      .prepare(
        `
          INSERT INTO school (id, name, short_name, created_at)
          VALUES (?, ?, ?, ?)
        `
      )
      .run(legacySchoolId, 'Legacy School', 'Legacy', '2026-01-01 00:00:00');
    sqlite
      .prepare(
        `
          INSERT INTO academic_year (id, school_id, label, is_current)
          VALUES (?, ?, ?, ?)
        `
      )
      .run('33333333-3333-4333-8333-333333333333', legacySchoolId, '2026-2027', 1);
    sqlite
      .prepare(
        `
          INSERT INTO user (id, school_id, username, password_hash, role, is_active)
          VALUES (?, ?, ?, ?, ?, ?)
        `
      )
      .run(legacyUserId, legacySchoolId, 'directeur', 'legacy-hash', 'school_master', 1);

    applyMigration(sqlite, '0001_aspiring_fixer.sql');

    const migratedSchool = sqlite
      .prepare(
        `
          SELECT code, country, timezone, record_version
          FROM school
          WHERE id = ?
        `
      )
      .get(legacySchoolId) as {
      code: string;
      country: string;
      timezone: string;
      record_version: number;
    };
    const migratedUser = sqlite
      .prepare(
        `
          SELECT role, failed_login_attempts, record_version
          FROM user
          WHERE id = ?
        `
      )
      .get(legacyUserId) as {
      role: string;
      failed_login_attempts: number;
      record_version: number;
    };

    expect(migratedSchool).toEqual({
      code: legacySchoolId.replaceAll('-', ''),
      country: 'TD',
      timezone: 'Africa/Ndjamena',
      record_version: 1,
    });
    expect(migratedUser).toEqual({
      role: 'SCHOOL_MASTER',
      failed_login_attempts: 0,
      record_version: 1,
    });
  });
});

describe('tenant-scoped database primitives', () => {
  let sqlite: Database.Database;
  let db: EduTrackDatabase;

  beforeEach(() => {
    sqlite = new Database(':memory:');
    sqlite.pragma('foreign_keys = ON');
    applyAllMigrations(sqlite);
    db = drizzle(sqlite, { schema });
    seedFoundation(db);
    seedFoundation(db);
  });

  afterEach(() => {
    sqlite.close();
  });

  it('seeds deterministic foundation data idempotently', () => {
    const [schoolCount] = db.select({ value: count() }).from(schema.school).all();
    const [userCount] = db.select({ value: count() }).from(schema.user).all();
    const [seedVersion] = db
      .select()
      .from(schema.schemaMetadata)
      .where(eq(schema.schemaMetadata.key, 'seed.foundation.version'))
      .all();

    expect(schoolCount?.value).toBe(2);
    expect(userCount?.value).toBe(2);
    expect(seedVersion?.value).toBe('phase-1.3-foundation-2026-08-12');
  });

  it('isolates the first tenant-owned user query by school', () => {
    const [firstSchool, secondSchool] = foundationSeed.schools;
    const firstTenantUsers = createUserRepository(
      db,
      createTenantContext(firstSchool.id)
    ).listActiveUsers();
    const secondTenantUser = createUserRepository(
      db,
      createTenantContext(secondSchool.id)
    ).findActiveByUsername('directeur');

    expect(firstTenantUsers).toHaveLength(1);
    expect(firstTenantUsers[0]?.schoolId).toBe(firstSchool.id);
    expect(firstTenantUsers[0]?.username).toBe('directeur');
    expect(secondTenantUser?.schoolId).toBe(secondSchool.id);
    expect(secondTenantUser?.username).toBe('directeur');
  });

  it('rolls back transaction work when an operation fails', () => {
    expect(() =>
      withTransaction(db, (transaction) => {
        transaction
          .insert(schema.school)
          .values({
            id: '99999999-9999-4999-8999-999999999999',
            code: 'ROLLBACK',
            name: 'Rollback School',
          })
          .run();

        throw new Error('abort transaction');
      })
    ).toThrow('abort transaction');

    const rollbackSchool = db
      .select()
      .from(schema.school)
      .where(eq(schema.school.code, 'ROLLBACK'))
      .get();

    expect(rollbackSchool).toBeUndefined();
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
