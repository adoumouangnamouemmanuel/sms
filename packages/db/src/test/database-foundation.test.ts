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
} from '../application-migrations.js';
import type { EduTrackDatabase } from '../client.js';
import { withTransaction } from '../client.js';
import {
  createAuditLogRepository,
  createTenantContext,
  createUserRepository,
} from '../repositories.js';
import * as schema from '../schema.sqlite.js';
import {
  foundationSeed,
  foundationSeedVersion,
  resolveSeedPasswordHash,
  seedFoundation,
} from '../seeds.js';

const migrationsDir = fileURLToPath(new URL('../../migrations/sqlite/', import.meta.url));
const legacySchoolId = '11111111-1111-4111-8111-111111111111';
const legacyUserId = '22222222-2222-4222-8222-222222222222';

// Real bcrypt-format hashes: only the prefix and cost are validated, so the
// remainder is a stable dummy body used across the seed tests.
const cost11Hash = '$2b$11$C6UzMDM.H6dfI/f/IKcEeOq8GmUiZ6ztp7Z8VsYzHf5fQK1x6ZVdW';
const cost12Hash = '$2b$12$C6UzMDM.H6dfI/f/IKcEeOq8GmUiZ6ztp7Z8VsYzHf5fQK1x6ZVdW';

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

  it('applies the 3.2 migration to a non-empty database', () => {
    sqlite = new Database(':memory:');
    sqlite.pragma('foreign_keys = ON');
    applyMigration(sqlite, '0000_public_mongu.sql');
    applyMigration(sqlite, '0001_aspiring_fixer.sql');
    applyMigration(sqlite, '0002_glorious_lizard.sql');
    applyMigration(sqlite, '0003_old_sumo.sql');

    sqlite
      .prepare(
        `
          INSERT INTO school (id, code, name, short_name, created_at)
          VALUES (?, ?, ?, ?, ?)
        `
      )
      .run(legacySchoolId, 'LEGACY', 'Legacy School', 'Legacy', '2026-01-01 00:00:00');
    sqlite
      .prepare(
        `
          INSERT INTO school_module_config
            (id, school_id, module_name, is_enabled, created_at, updated_at, record_version)
          VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 1)
        `
      )
      .run('66666666-6666-4666-8666-666666666666', legacySchoolId, 'SCHOOL_SETUP', 1);

    applyMigration(sqlite, '0004_students_module.sql');

    const moduleRows = sqlite
      .prepare(
        `
          SELECT module_name, is_enabled
          FROM school_module_config
          WHERE school_id = ?
          ORDER BY module_name
        `
      )
      .all(legacySchoolId) as { module_name: string; is_enabled: number }[];

    // The pre-existing row survives the rebuild and STUDENTS is backfilled enabled.
    expect(moduleRows).toEqual([
      { module_name: 'SCHOOL_SETUP', is_enabled: 1 },
      { module_name: 'STUDENTS', is_enabled: 1 },
    ]);

    // The widened CHECK still rejects unknown modules.
    expect(() =>
      sqlite
        .prepare(
          `
            INSERT INTO school_module_config
              (id, school_id, module_name, is_enabled, created_at, updated_at, record_version)
            VALUES (?, ?, 'NOT_A_MODULE', 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 1)
          `
        )
        .run('77777777-7777-4777-8777-777777777777', legacySchoolId)
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

describe('Phase 3 people migration', () => {
  let sqlite: Database.Database;

  afterEach(() => {
    sqlite.close();
  });

  it('applies the people migration to a database with existing school and user rows', () => {
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
      .run(legacyUserId, legacySchoolId, 'directeur', 'legacy-hash', 'school_master', 1);

    applyMigration(sqlite, '0001_aspiring_fixer.sql');
    applyMigration(sqlite, '0002_glorious_lizard.sql');
    applyMigration(sqlite, '0003_old_sumo.sql');

    const studentId = '77777777-7777-4777-8777-777777777777';
    const studentCode = 'LEGACY-2026-000000001';
    sqlite
      .prepare(
        `
          INSERT INTO student (id, school_id, code, first_name, last_name, sex)
          VALUES (?, ?, ?, ?, ?, ?)
        `
      )
      .run(studentId, legacySchoolId, studentCode, 'Aminata', 'Mahamat', 'F');

    // Strict code uniqueness: the same code in the same school is rejected, even after archive.
    sqlite
      .prepare(
        `
          UPDATE student
          SET is_active = 0, deleted_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `
      )
      .run(studentId);
    expect(() =>
      sqlite
        .prepare(
          `
            INSERT INTO student (id, school_id, code, first_name, last_name)
            VALUES (?, ?, ?, ?, ?)
          `
        )
        .run(
          '88888888-8888-4888-8888-888888888888',
          legacySchoolId,
          studentCode,
          'Other',
          'Student'
        )
    ).toThrow();

    // The sex CHECK constraint rejects unmapped values at the database level.
    expect(() =>
      sqlite
        .prepare(
          `
            INSERT INTO student (id, school_id, code, first_name, last_name, sex)
            VALUES (?, ?, ?, ?, ?, ?)
          `
        )
        .run(
          '99999999-9999-4999-8999-999999999999',
          legacySchoolId,
          'LEGACY-2026-999999999',
          'X',
          'Y',
          'INCONNU'
        )
    ).toThrow();

    // The teacher login link works with the pre-existing user of the same school.
    sqlite
      .prepare(
        `
          INSERT INTO teacher (id, school_id, code, first_name, last_name, user_id)
          VALUES (?, ?, ?, ?, ?, ?)
        `
      )
      .run(
        'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        legacySchoolId,
        'LEGACY-2026-T00001',
        'Ibrahim',
        'Ousmane',
        legacyUserId
      );

    // A teacher may not link to a user of another school (composite tenant FK).
    sqlite
      .prepare(
        `
          INSERT INTO school (id, code, name, created_at)
          VALUES (?, ?, ?, ?)
        `
      )
      .run(
        'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        'OTHER-SCHOOL',
        'Other School',
        '2026-01-01 00:00:00'
      );
    sqlite
      .prepare(
        `
          INSERT INTO user (id, school_id, username, password_hash, role, is_active)
          VALUES (?, ?, ?, ?, ?, ?)
        `
      )
      .run(
        'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
        'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        'autre',
        'hash',
        'TEACHER',
        1
      );
    expect(() =>
      sqlite
        .prepare(
          `
            INSERT INTO teacher (id, school_id, code, first_name, last_name, user_id)
            VALUES (?, ?, ?, ?, ?, ?)
          `
        )
        .run(
          'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
          legacySchoolId,
          'LEGACY-2026-T00002',
          'Ali',
          'Ahmat',
          'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
        )
    ).toThrow();
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

  it('keeps demo accounts locked when the seed password hash is unset or empty', () => {
    expect(resolveSeedPasswordHash(undefined)).toBe('!UNUSABLE_PASSWORD_HASH!');
    expect(resolveSeedPasswordHash('')).toBe('!UNUSABLE_PASSWORD_HASH!');
  });

  it('rejects invalid EDUTRACK_SEED_PASSWORD_HASH values instead of persisting a broken login', () => {
    expect(() => resolveSeedPasswordHash('plaintext-password')).toThrow(
      /EDUTRACK_SEED_PASSWORD_HASH doit être un hash bcrypt/
    );
    expect(() => resolveSeedPasswordHash('$2b$12$too-short')).toThrow(
      /EDUTRACK_SEED_PASSWORD_HASH doit être un hash bcrypt/
    );
    // Bcrypt below work factor 12 (the app's BCRYPT_COST) is rejected.
    expect(() => resolveSeedPasswordHash(cost11Hash)).toThrow(
      /EDUTRACK_SEED_PASSWORD_HASH doit être un hash bcrypt/
    );
  });

  it('accepts a valid bcrypt cost-12 EDUTRACK_SEED_PASSWORD_HASH', () => {
    expect(resolveSeedPasswordHash(cost12Hash)).toBe(cost12Hash);
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
    expect(seedVersion?.value).toBe(foundationSeedVersion);
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
    expect(upgradedSeedVersion?.value).toBe(foundationSeedVersion);
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
