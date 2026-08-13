import Database from 'better-sqlite3';
import { count, eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  applyApplicationMigrations,
  resolveSqliteMigrationsFolder,
} from './application-migrations';
import type { EduTrackDatabase } from './client';
import { withTransaction } from './client';
import {
  createAuditLogRepository,
  createTenantContext,
  createUserRepository,
} from './repositories';
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
    expect(() =>
      sqlite
        .prepare(
          `
            INSERT INTO user (id, school_id, username, password_hash, role)
            VALUES (?, ?, ?, ?, ?)
          `
        )
        .run(
          '44444444-4444-4444-8444-444444444444',
          legacySchoolId,
          'invalid-role',
          'hash',
          'administrator'
        )
    ).toThrow();
    expect(() =>
      sqlite
        .prepare(
          `
            INSERT INTO audit_log (id, school_id, action, target_type, outcome)
            VALUES (?, ?, ?, ?, ?)
          `
        )
        .run('55555555-5555-4555-8555-555555555555', legacySchoolId, 'TEST', 'user', 'UNKNOWN')
    ).toThrow();
  });

  it('rejects unmapped legacy user roles during the 7.3 migration', () => {
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
          INSERT INTO user (id, school_id, username, password_hash, role, is_active)
          VALUES (?, ?, ?, ?, ?, ?)
        `
      )
      .run(legacyUserId, legacySchoolId, 'admin', 'legacy-hash', 'administrator', 1);

    expect(() => {
      applyMigration(sqlite, '0001_aspiring_fixer.sql');
    }).toThrow();
  });
});

describe('application migration helper', () => {
  let sqlite: Database.Database | undefined;

  afterEach(() => {
    sqlite?.close();
    sqlite = undefined;
  });

  it('resolves the repository sqlite migration folder', () => {
    expect(resolveSqliteMigrationsFolder()).toBe(resolve(migrationsDir));
  });

  it('applies committed application migrations to a sqlite database', () => {
    sqlite = new Database(':memory:');
    sqlite.close();
    sqlite = undefined;

    const status = applyApplicationMigrations(':memory:', migrationsDir);

    expect(status).toEqual({
      sqlitePath: ':memory:',
      migrationsFolder: migrationsDir,
      migrated: true,
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

  it('updates deterministic foundation rows when the seed version changes', () => {
    const [firstSchool] = foundationSeed.schools;

    db.update(schema.school)
      .set({ name: 'Outdated demo name' })
      .where(eq(schema.school.id, firstSchool.id))
      .run();
    db.update(schema.schemaMetadata)
      .set({ value: 'older-foundation-version' })
      .where(eq(schema.schemaMetadata.key, 'seed.foundation.version'))
      .run();

    seedFoundation(db);

    const upgradedSchool = db
      .select({ name: schema.school.name })
      .from(schema.school)
      .where(eq(schema.school.id, firstSchool.id))
      .get();
    const upgradedSeedVersion = db
      .select({ value: schema.schemaMetadata.value })
      .from(schema.schemaMetadata)
      .where(eq(schema.schemaMetadata.key, 'seed.foundation.version'))
      .get();

    expect(upgradedSchool?.name).toBe(firstSchool.name);
    expect(upgradedSeedVersion?.value).toBe('phase-1.3-foundation-2026-08-12');
  });

  it('isolates the first tenant-owned user query by school', () => {
    const [firstSchool, secondSchool] = foundationSeed.schools;
    const firstTenantUsers = createUserRepository(
      db,
      createTenantContext(` ${firstSchool.id} `)
    ).listActiveUsers();
    const secondTenantUser = createUserRepository(
      db,
      createTenantContext(secondSchool.id)
    ).findActiveByUsername('directeur');

    expect(firstTenantUsers).toHaveLength(1);
    expect(firstTenantUsers[0]?.schoolId).toBe(firstSchool.id);
    expect(firstTenantUsers[0]?.username).toBe('directeur');
    expect(firstTenantUsers[0]).not.toHaveProperty('passwordHash');
    expect(secondTenantUser?.schoolId).toBe(secondSchool.id);
    expect(secondTenantUser?.username).toBe('directeur');
    expect(secondTenantUser).not.toHaveProperty('passwordHash');
  });

  it('returns non-sensitive user columns when creating a user', () => {
    const [firstSchool] = foundationSeed.schools;
    const repository = createUserRepository(db, createTenantContext(firstSchool.id));

    const createdUser = repository.createUser({
      id: '66666666-6666-4666-8666-666666666666',
      username: 'enseignant',
      passwordHash: 'stored-hash',
      role: 'TEACHER',
    });

    expect(createdUser).toMatchObject({
      id: '66666666-6666-4666-8666-666666666666',
      schoolId: firstSchool.id,
      username: 'enseignant',
      role: 'TEACHER',
    });
    expect(createdUser).not.toHaveProperty('passwordHash');
  });

  it('serializes audit metadata defensively', () => {
    const [firstSchool] = foundationSeed.schools;
    const repository = createAuditLogRepository(db, createTenantContext(firstSchool.id));
    const metadata: Record<string, unknown> = { count: 1n };
    metadata.self = metadata;

    const event = repository.createEvent({
      action: 'TEST',
      targetType: 'school',
      targetId: firstSchool.id,
      metadata,
    });

    expect(JSON.parse(event.metadataJson)).toEqual({
      count: '1',
      self: '[Circular]',
    });
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
