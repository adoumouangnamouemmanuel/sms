import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { EduTrackDatabase } from '../client.js';
import { createTenantContext } from '../repositories/base.js';
import { createSubjectRepository } from '../repositories/subject.repository.js';
import * as schema from '../schema.sqlite.js';
import { foundationSeed, seedFoundation } from '../seeds.js';

const migrationsDir = fileURLToPath(new URL('../../migrations/sqlite/', import.meta.url));
const fixedAt = '2026-08-15T10:00:00.000Z';

describe('subject repository', () => {
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

  it('creates a subject scoped to the tenant school', () => {
    const [school] = foundationSeed.schools;
    const repository = createSubjectRepository(db, createTenantContext(school.id));

    const created = repository.create({
      code: 'MATH',
      name: 'Mathématiques',
      category: 'MATHEMATIQUES',
      shortLabel: 'Maths',
      nameEn: 'Mathematics',
    });

    expect(created).toMatchObject({
      schoolId: school.id,
      code: 'MATH',
      name: 'Mathématiques',
      nameEn: 'Mathematics',
      nameAr: null,
      shortLabel: 'Maths',
      category: 'MATHEMATIQUES',
      isActive: true,
    });
    expect(created.id).toHaveLength(36);
    expect(created.recordVersion).toBe(1);
  });

  it('rejects a duplicate code in the same school and frees it after archive', () => {
    const [school] = foundationSeed.schools;
    const repository = createSubjectRepository(db, createTenantContext(school.id));

    const created = repository.create({ code: 'FR', name: 'Français', category: 'LANGUES' });
    expect(() =>
      repository.create({ code: 'FR', name: 'Français 2', category: 'LANGUES' })
    ).toThrow();

    repository.archive(created.id, fixedAt);

    // The catalogue frees archived codes: a soft-deleted subject may be re-added.
    const recreated = repository.create({ code: 'FR', name: 'Français', category: 'LANGUES' });
    expect(recreated.isActive).toBe(true);
  });

  it('allows the same code in a different school', () => {
    const [firstSchool, secondSchool] = foundationSeed.schools;
    const code = 'HIST';

    createSubjectRepository(db, createTenantContext(firstSchool.id)).create({
      code,
      name: 'Histoire',
      category: 'SCIENCES_SOCIALES',
    });
    const second = createSubjectRepository(db, createTenantContext(secondSchool.id)).create({
      code,
      name: 'Histoire-Géo',
      category: 'SCIENCES_SOCIALES',
    });

    expect(second.code).toBe(code);
    expect(second.schoolId).toBe(secondSchool.id);
  });

  it('rejects an unknown category at the database level', () => {
    const [school] = foundationSeed.schools;
    expect(() =>
      sqlite
        .prepare(
          `INSERT INTO subject (id, school_id, code, name, category)
           VALUES (?, ?, ?, ?, ?)`
        )
        .run('00000000-0000-4000-8000-000000000a01', school.id, 'ALCH', 'Alchimie', 'MYSTIQUE')
    ).toThrow(/CHECK/i);
  });

  it('lists and filters subjects by search, category and status', () => {
    const [school] = foundationSeed.schools;
    const tenant = createTenantContext(school.id);
    const repository = createSubjectRepository(db, tenant);

    repository.create({ code: 'MATH', name: 'Mathématiques', category: 'MATHEMATIQUES' });
    repository.create({ code: 'PC', name: 'Physique-Chimie', category: 'SCIENCES' });
    const english = repository.create({ code: 'ANG', name: 'Anglais', category: 'LANGUES' });
    repository.archive(english.id, fixedAt);

    // count() and list() default to active rows; archived rows stay reachable.
    expect(repository.count()).toBe(2);
    expect(repository.list({ search: 'Math' })).toHaveLength(1);
    expect(repository.list({ category: 'MATHEMATIQUES' })).toHaveLength(1);
    expect(repository.list({ status: 'active' })).toHaveLength(2);
    expect(repository.list({ status: 'archived' })).toHaveLength(1);
    expect(repository.list({ category: 'LANGUES', status: 'archived' })).toHaveLength(1);
  });

  it('updates fields and bumps the record version; archive keeps the row reachable', () => {
    const [school] = foundationSeed.schools;
    const repository = createSubjectRepository(db, createTenantContext(school.id));
    const created = repository.create({
      code: 'SVT',
      name: 'Sciences de la Vie',
      category: 'SCIENCES',
    });

    const updated = repository.update(
      created.id,
      { name: 'Sciences de la Vie et de la Terre', category: 'SCIENCES' },
      fixedAt
    );
    expect(updated.name).toBe('Sciences de la Vie et de la Terre');
    expect(updated.recordVersion).toBe(2);

    const archived = repository.archive(created.id, fixedAt);
    expect(archived.isActive).toBe(false);
    expect(archived.deletedAt).toBe(fixedAt);
    expect(repository.findById(created.id)).toBeDefined();

    const reactivated = repository.reactivate(created.id, fixedAt);
    expect(reactivated.isActive).toBe(true);
    expect(reactivated.deletedAt).toBeNull();
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
