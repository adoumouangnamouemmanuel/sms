import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { EduTrackDatabase } from '../client.js';
import { createTenantContext } from '../repositories/base.js';
import { createImportBatchRepository } from '../repositories/import-batch.repository.js';
import * as schema from '../schema.sqlite.js';
import { foundationSeed, seedFoundation } from '../seeds.js';

const migrationsDir = fileURLToPath(new URL('../../migrations/sqlite/', import.meta.url));

describe('import batch repository', () => {
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

  it('records a confirmed import scoped to the tenant school', () => {
    const [school] = foundationSeed.schools;
    const repository = createImportBatchRepository(db, createTenantContext(school.id));

    const created = repository.create({
      kind: 'STUDENTS',
      importIdentifier: 'import-eleves-2026-09-01',
      filename: 'eleves.xlsx',
      totalRows: 12,
      validRows: 10,
      errorRows: 2,
    });

    expect(created).toMatchObject({
      schoolId: school.id,
      kind: 'STUDENTS',
      importIdentifier: 'import-eleves-2026-09-01',
      filename: 'eleves.xlsx',
      totalRows: 12,
      validRows: 10,
      errorRows: 2,
      recordVersion: 1,
    });
  });

  it('rejects a second import with the same identifier in the same school', () => {
    const [school] = foundationSeed.schools;
    const repository = createImportBatchRepository(db, createTenantContext(school.id));

    repository.create({
      kind: 'STUDENTS',
      importIdentifier: 'import-rentree',
      filename: 'eleves.xlsx',
      totalRows: 3,
      validRows: 3,
      errorRows: 0,
    });

    expect(() =>
      repository.create({
        kind: 'STUDENTS',
        importIdentifier: 'import-rentree',
        filename: 'eleves-2.xlsx',
        totalRows: 5,
        validRows: 5,
        errorRows: 0,
      })
    ).toThrow();
  });

  it('finds a previously confirmed identifier and allows it across schools', () => {
    const [firstSchool, secondSchool] = foundationSeed.schools;
    const firstRepository = createImportBatchRepository(db, createTenantContext(firstSchool.id));
    const secondRepository = createImportBatchRepository(db, createTenantContext(secondSchool.id));

    firstRepository.create({
      kind: 'TEACHERS',
      importIdentifier: 'import-professeurs',
      filename: 'professeurs.xlsx',
      totalRows: 4,
      validRows: 3,
      errorRows: 1,
    });

    const found = firstRepository.findBySchoolAndIdentifier('import-professeurs');
    expect(found?.validRows).toBe(3);

    // The same identifier is allowed in another school.
    const secondSchoolBatch = secondRepository.create({
      kind: 'TEACHERS',
      importIdentifier: 'import-professeurs',
      filename: 'professeurs.xlsx',
      totalRows: 1,
      validRows: 1,
      errorRows: 0,
    });
    expect(secondSchoolBatch.schoolId).toBe(secondSchool.id);
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
