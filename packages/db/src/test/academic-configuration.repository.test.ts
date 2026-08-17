import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { EduTrackDatabase } from '../client.js';
import { createTenantContext } from '../repositories/base.js';
import { createAcademicYearRepository } from '../repositories/academic-year.repository.js';
import { createClassLevelRepository } from '../repositories/class-level.repository.js';
import { createLevelSubjectRepository } from '../repositories/level-subject.repository.js';
import { createSubjectGroupRepository } from '../repositories/subject-group.repository.js';
import { createSubjectRepository } from '../repositories/subject.repository.js';
import { createTermRepository } from '../repositories/term.repository.js';
import * as schema from '../schema.sqlite.js';
import { foundationSeed, seedFoundation } from '../seeds.js';

const migrationsDir = fileURLToPath(new URL('../../migrations/sqlite/', import.meta.url));
const fixedAt = '2026-08-15T10:00:00.000Z';

describe('academic configuration repositories (roadmap §9.3/§9.5/§9.6)', () => {
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

  const [firstSchool, secondSchool] = foundationSeed.schools;

  function tenant(schoolId: string = firstSchool.id) {
    return createTenantContext(schoolId);
  }

  function seedLevelAndSubject() {
    const levelRepository = createClassLevelRepository(db, tenant());
    const subjectRepository = createSubjectRepository(db, tenant());
    levelRepository.replaceActive(
      [{ code: '6E', name: 'Sixième', displayOrder: 1, isExamYear: false }],
      fixedAt
    );
    const level = requireFound(levelRepository.listActive()[0], 'level');
    const math = subjectRepository.create({
      code: 'MATH',
      name: 'Mathématiques',
      category: 'MATHEMATIQUES',
    });
    const french = subjectRepository.create({ code: 'FR', name: 'Français', category: 'LANGUES' });

    return { level, math, french };
  }

  // -------------------------------------------------------------------------
  // Level curriculum (roadmap §9.5)
  // -------------------------------------------------------------------------

  it('replaces the level matrix atomically, soft-deactivating removed entries', () => {
    const { level, math, french } = seedLevelAndSubject();
    const repository = createLevelSubjectRepository(db, tenant());

    const first = repository.replaceForLevel(
      level.id,
      [
        { subjectId: math.id, coefficient: 4, isRequired: true },
        { subjectId: french.id, coefficient: 3, isRequired: false },
      ],
      fixedAt
    );
    expect(first).toHaveLength(2);

    const second = repository.replaceForLevel(
      level.id,
      [{ subjectId: french.id, coefficient: 5, isRequired: true }],
      fixedAt
    );
    expect(second).toHaveLength(1);
    expect(second[0]).toMatchObject({
      subjectId: french.id,
      coefficient: 5,
      isRequired: true,
    });

    // The removed math entry is soft-deactivated, never hard-deleted.
    const row = sqlite
      .prepare(
        `SELECT is_active AS isActive, deleted_at AS deletedAt
         FROM level_subject WHERE class_level_id = ? AND subject_id = ?`
      )
      .get(level.id, math.id) as { isActive: number; deletedAt: string };
    expect(row.isActive).toBe(0);
    expect(row.deletedAt).toBe(fixedAt);
  });

  it('never lists another school level matrix entries', () => {
    const { level, math } = seedLevelAndSubject();
    createLevelSubjectRepository(db, tenant()).replaceForLevel(
      level.id,
      [{ subjectId: math.id, coefficient: 4, isRequired: true }],
      fixedAt
    );

    const otherTenant = tenant(secondSchool.id);
    const otherLevelRepository = createClassLevelRepository(db, otherTenant);
    otherLevelRepository.replaceActive(
      [{ code: '6E', name: 'Sixième', displayOrder: 1, isExamYear: false }],
      fixedAt
    );
    const otherLevel = requireFound(otherLevelRepository.listActive()[0], 'other level');
    const otherMath = createSubjectRepository(db, otherTenant).create({
      code: 'MATH',
      name: 'Mathématiques',
      category: 'MATHEMATIQUES',
    });

    const other = createLevelSubjectRepository(db, otherTenant).replaceForLevel(
      otherLevel.id,
      [{ subjectId: otherMath.id, coefficient: 2, isRequired: true }],
      fixedAt
    );
    expect(other).toHaveLength(1);

    // The first school's matrix is untouched by the second school's writes.
    expect(createLevelSubjectRepository(db, tenant()).listForLevel(level.id)).toHaveLength(1);
  });

  // -------------------------------------------------------------------------
  // Subject groups (roadmap §9.6)
  // -------------------------------------------------------------------------

  it('creates groups with display order and bumps the record version on update', () => {
    const repository = createSubjectGroupRepository(db, tenant());
    const created = repository.create(
      { name: 'Matières scientifiques', nameEn: null, nameAr: null, displayOrder: 1 },
      fixedAt
    );
    expect(created).toMatchObject({
      schoolId: firstSchool.id,
      name: 'Matières scientifiques',
      displayOrder: 1,
      isActive: true,
      recordVersion: 1,
    });

    const updated = repository.update(created.id, { name: 'Sciences', displayOrder: 2 }, fixedAt);
    expect(updated.name).toBe('Sciences');
    expect(updated.recordVersion).toBe(2);
  });

  it('replaces membership atomically: array order becomes the display order', () => {
    const { math, french } = seedLevelAndSubject();
    const repository = createSubjectGroupRepository(db, tenant());
    const group = repository.create(
      { name: 'Matières scientifiques', nameEn: null, nameAr: null, displayOrder: 1 },
      fixedAt
    );

    const members = repository.replaceMembers(group.id, [french.id, math.id], fixedAt);
    expect(members).toHaveLength(2);
    expect(members[0]?.subjectId).toBe(french.id);
    expect(members[0]?.displayOrder).toBe(1);
    expect(members[1]?.subjectId).toBe(math.id);
    expect(members[1]?.displayOrder).toBe(2);

    // Replacing with a subset soft-deactivates the removed member.
    const pruned = repository.replaceMembers(group.id, [math.id], fixedAt);
    expect(pruned).toHaveLength(1);
    expect(pruned[0]?.subjectId).toBe(math.id);

    const row = sqlite
      .prepare(
        `SELECT is_active AS isActive FROM subject_group_member
         WHERE subject_group_id = ? AND subject_id = ?`
      )
      .get(group.id, french.id) as { isActive: number };
    expect(row.isActive).toBe(0);

    // The list count reflects only active members.
    const withCounts = repository.listWithCounts();
    expect(withCounts[0]?.subjectCount).toBe(1);
  });

  it('reorders retained members without colliding with the unique display-order index', () => {
    const { math, french } = seedLevelAndSubject();
    const repository = createSubjectGroupRepository(db, tenant());
    const group = repository.create(
      { name: 'Matières mixtes', nameEn: null, nameAr: null, displayOrder: 1 },
      fixedAt
    );

    repository.replaceMembers(group.id, [french.id, math.id], fixedAt);

    // Swapping the order must not trip the (school_id, subject_group_id,
    // display_order) unique index while the final orders are written.
    const reordered = repository.replaceMembers(group.id, [math.id, french.id], fixedAt);
    expect(reordered).toHaveLength(2);
    expect(reordered[0]?.subjectId).toBe(math.id);
    expect(reordered[0]?.displayOrder).toBe(1);
    expect(reordered[1]?.subjectId).toBe(french.id);
    expect(reordered[1]?.displayOrder).toBe(2);
  });

  it('keeps subject groups and members tenant-scoped', () => {
    const repository = createSubjectGroupRepository(db, tenant());
    repository.create(
      { name: 'Matières scientifiques', nameEn: null, nameAr: null, displayOrder: 1 },
      fixedAt
    );

    const otherTenant = tenant(secondSchool.id);
    const otherRepository = createSubjectGroupRepository(db, otherTenant);
    expect(otherRepository.listWithCounts()).toHaveLength(0);

    const group = otherRepository.create(
      { name: 'Matières littéraires', nameEn: null, nameAr: null, displayOrder: 1 },
      fixedAt
    );
    expect(otherRepository.listWithCounts()).toHaveLength(1);
    expect(repository.listWithCounts()).toHaveLength(1);
    expect(repository.findById(group.id)).toBeUndefined();
  });

  // -------------------------------------------------------------------------
  // Academic year lifecycle (roadmap §9.3)
  // -------------------------------------------------------------------------

  it('creates DRAFT years that are never current, then activates and closes them', () => {
    const repository = createAcademicYearRepository(db, tenant());
    const draft = repository.createDraft(
      { label: '2027-2028', startDate: '2027-09-01', endDate: '2028-06-30' },
      fixedAt
    );
    expect(draft.status).toBe('DRAFT');
    expect(draft.isCurrent).toBe(false);

    const activated = repository.activate(draft.id, fixedAt);
    expect(activated.status).toBe('ACTIVE');
    expect(activated.isCurrent).toBe(true);

    const closed = repository.close(draft.id, fixedAt);
    expect(closed.status).toBe('CLOSED');
    expect(closed.isCurrent).toBe(false);
  });

  it('keeps the single-active-year invariant when activating a second year', () => {
    const repository = createAcademicYearRepository(db, tenant());
    repository.createCurrent(
      { label: '2026-2027', startDate: '2026-09-01', endDate: '2027-06-30' },
      fixedAt
    );
    const second = repository.createDraft(
      { label: '2027-2028', startDate: '2027-09-01', endDate: '2028-06-30' },
      fixedAt
    );

    // The service closes the previous ACTIVE year before activating the new one.
    const active = repository.findActive();
    if (active) {
      repository.close(active.id, fixedAt);
    }
    repository.activate(second.id, fixedAt);

    expect(repository.findActive()?.id).toBe(second.id);
  });

  it('lists years with status and keeps them tenant-scoped', () => {
    const repository = createAcademicYearRepository(db, tenant());
    repository.createDraft(
      { label: '2027-2028', startDate: '2027-09-01', endDate: '2028-06-30' },
      fixedAt
    );

    expect(repository.listWithStatus()).toHaveLength(1);

    const otherTenant = tenant(secondSchool.id);
    const otherRepository = createAcademicYearRepository(db, otherTenant);
    expect(otherRepository.listWithStatus()).toHaveLength(0);
  });

  it('supports the term rollover helpers used by year activation', () => {
    const repository = createAcademicYearRepository(db, tenant());
    const termRepository = createTermRepository(db, tenant());
    const year = repository.createDraft(
      { label: '2027-2028', startDate: '2027-09-01', endDate: '2028-06-30' },
      fixedAt
    );

    const terms = termRepository.replaceForAcademicYear(
      year.id,
      [
        {
          label: 'Trimestre 1',
          termNumber: 1,
          startDate: '2027-09-01',
          endDate: '2027-12-19',
          isCurrent: false,
        },
        {
          label: 'Trimestre 2',
          termNumber: 2,
          startDate: '2028-01-04',
          endDate: '2028-03-24',
          isCurrent: false,
        },
      ],
      fixedAt
    );
    expect(terms).toHaveLength(2);

    termRepository.markFirstTermCurrent(year.id, fixedAt);
    const afterMark = termRepository.listForAcademicYear(year.id);
    expect(afterMark[0]?.isCurrent).toBe(true);
    expect(afterMark[1]?.isCurrent).toBe(false);

    termRepository.clearCurrentTerms(fixedAt);
    expect(termRepository.listForAcademicYear(year.id).some((term) => term.isCurrent)).toBe(false);
  });
});

function requireFound<T>(value: T | undefined, label: string): T {
  if (value === undefined) {
    throw new Error(`Expected ${label} to exist.`);
  }

  return value;
}

function applyAllMigrations(sqlite: Database.Database) {
  const migrationFiles = readdirSync(migrationsDir)
    .filter((file) => file.endsWith('.sql'))
    .sort();

  for (const migrationFile of migrationFiles) {
    const migrationSql = readFileSync(join(migrationsDir, migrationFile), 'utf8');
    sqlite.exec(migrationSql.replaceAll('--> statement-breakpoint', '\n'));
  }
}
