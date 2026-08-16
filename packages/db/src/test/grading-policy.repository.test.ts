import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { EduTrackDatabase } from '../client.js';
import { createTenantContext } from '../repositories/base.js';
import { createAppreciationRepository } from '../repositories/appreciation.repository.js';
import { createClassLevelRepository } from '../repositories/class-level.repository.js';
import { createGradingPolicyRepository } from '../repositories/grading-policy.repository.js';
import { createSubjectRepository } from '../repositories/subject.repository.js';
import type { GradingPolicyConfig } from '@edutrack/shared';
import * as schema from '../schema.sqlite.js';
import { foundationSeed, seedFoundation } from '../seeds.js';

const migrationsDir = fileURLToPath(new URL('../../migrations/sqlite/', import.meta.url));
const fixedAt = '2026-08-15T10:00:00.000Z';

describe('grading-policy repositories (roadmap §9.7-§9.10)', () => {
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

  function validConfig(): GradingPolicyConfig {
    return {
      name: 'Devoirs + Composition',
      scaleMax: 20,
      passThreshold: 1000,
      decimalPrecision: 2,
      roundingMode: 'HALF_UP',
      effectiveAcademicYearId: null,
      assessmentTypes: [
        {
          name: 'Devoir',
          shortName: 'Dev.',
          scaleMax: 20,
          occurrenceMode: 'REPEATABLE',
          minOccurrences: 2,
          maxOccurrences: 6,
          required: true,
          teacherCanCreateInstances: true,
          displayOrder: 1,
        },
        {
          name: 'Composition',
          shortName: 'Comp.',
          scaleMax: 20,
          occurrenceMode: 'SINGLE',
          minOccurrences: 1,
          maxOccurrences: 1,
          required: true,
          teacherCanCreateInstances: false,
          displayOrder: 2,
        },
      ],
      derivedResults: [
        {
          id: 'derived-dev-1',
          name: 'Moyenne des devoirs',
          shortName: 'Moy. Dev.',
          operation: 'MEAN',
          sourceDefinitionIds: ['dev-1'],
          precision: 2,
          roundingMode: 'HALF_UP',
          displayOrder: 1,
        },
      ],
      subjectResult: {
        name: 'Moyenne matière',
        shortName: 'Moy. Mat.',
        precision: 2,
        roundingMode: 'HALF_UP',
        inputs: [
          { sourceDefinitionId: 'derived-dev-1', weight: 5000, displayOrder: 1 },
          { sourceDefinitionId: 'comp-1', weight: 5000, displayOrder: 2 },
        ],
      },
    };
  }

  /** Assessment-type ids are client-generated; they must be present for the graph. */
  function configWithIds(): GradingPolicyConfig {
    const config = validConfig();
    config.assessmentTypes[0] = { ...config.assessmentTypes[0]!, id: 'dev-1' };
    config.assessmentTypes[1] = { ...config.assessmentTypes[1]!, id: 'comp-1' };
    return config;
  }

  it('creates a draft document with all children and reloads it identically', () => {
    const repository = createGradingPolicyRepository(db, tenant());
    const config = configWithIds();
    const policyId = repository.createDraft(
      { logicalPolicyId: 'policy-1', version: 1, createdBy: 'user-1', config },
      fixedAt
    );

    const detail = repository.findDetail(policyId);
    expect(detail).not.toBeNull();
    expect(detail!.header).toMatchObject({
      id: policyId,
      version: 1,
      status: 'DRAFT',
      scaleMax: 20,
      passThreshold: 1000,
    });

    // The returned ids are the persisted ones; the graph references resolve
    // to them (derived sources -> assessment types, subject inputs -> both).
    const persisted = detail!.config;
    const assessmentIds = persisted.assessmentTypes.map((item) => item.id);
    expect(assessmentIds).toHaveLength(2);
    expect(assessmentIds[0]).not.toBe('dev-1');

    const derivedId = persisted.derivedResults[0]!.id;
    expect(persisted.derivedResults[0]!.sourceDefinitionIds).toEqual([assessmentIds[0]]);
    expect(persisted.subjectResult.inputs).toHaveLength(2);
    expect(persisted.subjectResult.inputs.map((input) => input.sourceDefinitionId)).toEqual([
      derivedId,
      assessmentIds[1],
    ]);
    expect(persisted.subjectResult.inputs[0]!.weight).toBe(5000);
  });

  it('replaces a draft config atomically and bumps the record version', () => {
    const repository = createGradingPolicyRepository(db, tenant());
    const policyId = repository.createDraft(
      { logicalPolicyId: 'policy-1', version: 1, createdBy: 'user-1', config: configWithIds() },
      fixedAt
    );

    const next = configWithIds();
    next.name = 'Politique révisée';
    next.derivedResults[0]!.precision = 1;
    repository.replaceDraftConfig(policyId, next, fixedAt);

    const detail = repository.findDetail(policyId);
    expect(detail!.config.name).toBe('Politique révisée');
    expect(detail!.config.derivedResults[0]!.precision).toBe(1);

    // Old children are soft-deleted, never hard-deleted.
    const oldRows = sqlite
      .prepare(
        `SELECT COUNT(*) AS value FROM assessment_type_definition
         WHERE grading_policy_id = ? AND deleted_at IS NOT NULL`
      )
      .get(policyId) as { value: number };
    expect(oldRows.value).toBe(2);

    const version = sqlite
      .prepare('SELECT record_version AS value FROM grading_policy WHERE id = ?')
      .get(policyId) as { value: number };
    expect(version.value).toBe(2);
  });

  it('keeps version numbers per logical policy', () => {
    const repository = createGradingPolicyRepository(db, tenant());
    expect(repository.maxVersion('policy-1')).toBe(0);

    repository.createDraft(
      { logicalPolicyId: 'policy-1', version: 1, createdBy: 'user-1', config: configWithIds() },
      fixedAt
    );
    expect(repository.maxVersion('policy-1')).toBe(1);
  });

  it('publishes and supersedes the previous published version', () => {
    const repository = createGradingPolicyRepository(db, tenant());
    const v1 = repository.createDraft(
      { logicalPolicyId: 'policy-1', version: 1, createdBy: 'user-1', config: configWithIds() },
      fixedAt
    );
    repository.publish(v1, 'user-1', fixedAt, null);

    const v2 = repository.createDraft(
      { logicalPolicyId: 'policy-1', version: 2, createdBy: 'user-1', config: configWithIds() },
      fixedAt
    );
    repository.publish(v2, 'user-1', fixedAt, v1);

    expect(repository.findSummary(v1)!.status).toBe('PUBLISHED');
    repository.supersede(v1, fixedAt);
    expect(repository.findSummary(v1)!.status).toBe('SUPERSEDED');
    expect(repository.findSummary(v2)!.status).toBe('PUBLISHED');
  });

  it('replaces scopes and enforces one scope slot per type', () => {
    const repository = createGradingPolicyRepository(db, tenant());
    const policyId = repository.createDraft(
      { logicalPolicyId: 'policy-1', version: 1, createdBy: 'user-1', config: configWithIds() },
      fixedAt
    );

    repository.replaceScopes(
      policyId,
      [{ scopeType: 'SCHOOL_DEFAULT', levelId: null, subjectId: null }],
      fixedAt
    );
    expect(repository.listScopes(policyId)).toHaveLength(1);

    // Replacing removes the old scope row (soft-delete) so a second assignment
    // of the same slot never violates the partial unique index.
    repository.replaceScopes(
      policyId,
      [{ scopeType: 'SCHOOL_DEFAULT', levelId: null, subjectId: null }],
      fixedAt
    );
    expect(repository.listScopes(policyId)).toHaveLength(1);
    expect(repository.listAllScopes()).toHaveLength(1);
  });

  it('assigns level and level+subject scopes with the level/subject present', () => {
    const levelRepository = createClassLevelRepository(db, tenant());
    levelRepository.replaceActive(
      [{ code: '6E', name: 'Sixième', displayOrder: 1, isExamYear: false }],
      fixedAt
    );
    const level = requireFound(levelRepository.listActive()[0], 'level');
    const math = createSubjectRepository(db, tenant()).create({
      code: 'MATH',
      name: 'Mathématiques',
      category: 'MATHEMATIQUES',
    });

    const repository = createGradingPolicyRepository(db, tenant());
    const policyId = repository.createDraft(
      { logicalPolicyId: 'policy-1', version: 1, createdBy: 'user-1', config: configWithIds() },
      fixedAt
    );

    repository.replaceScopes(
      policyId,
      [
        { scopeType: 'LEVEL', levelId: level.id, subjectId: null },
        { scopeType: 'LEVEL_SUBJECT', levelId: level.id, subjectId: math.id },
      ],
      fixedAt
    );

    const scopes = repository.listScopes(policyId);
    expect(scopes).toHaveLength(2);
    expect(scopes.find((scope) => scope.scopeType === 'LEVEL_SUBJECT')).toMatchObject({
      levelId: level.id,
      subjectId: math.id,
    });
  });

  it('never leaks another school policy data', () => {
    const repository = createGradingPolicyRepository(db, tenant());
    repository.createDraft(
      { logicalPolicyId: 'policy-1', version: 1, createdBy: 'user-1', config: configWithIds() },
      fixedAt
    );
    repository.replaceScopes(
      repository.listSummaries()[0]!.id,
      [{ scopeType: 'SCHOOL_DEFAULT', levelId: null, subjectId: null }],
      fixedAt
    );

    const otherRepository = createGradingPolicyRepository(db, tenant(secondSchool.id));
    expect(otherRepository.listSummaries()).toHaveLength(0);
    expect(otherRepository.listAllScopes()).toHaveLength(0);
  });

  // -------------------------------------------------------------------------
  // Appreciation (roadmap §9.10)
  // -------------------------------------------------------------------------

  function validScale() {
    return {
      name: 'Barème secondaire',
      scaleMax: 20,
      bands: [
        { lowerBound: 1600, upperBound: 2000, labelFr: 'Très bien', labelAr: 'جيد جداً', labelEn: 'Very good', shortLabel: 'TB', displayOrder: 1 },
        { lowerBound: 1000, upperBound: 1599, labelFr: 'Passable', labelAr: 'مقبول', labelEn: 'Passable', shortLabel: 'P', displayOrder: 2 },
        { lowerBound: 0, upperBound: 999, labelFr: 'Insuffisant', labelAr: 'غير كاف', labelEn: 'Insufficient', shortLabel: 'I', displayOrder: 3 },
      ],
    };
  }

  it('creates and reloads an appreciation draft with its bands', () => {
    const repository = createAppreciationRepository(db, tenant());
    const scaleId = repository.createDraft({
      logicalScaleId: 'scale-1',
      version: 1,
      scale: validScale(),
    });

    const loaded = repository.find(scaleId);
    expect(loaded).not.toBeNull();
    expect(loaded!.status).toBe('DRAFT');
    expect(loaded!.bands).toHaveLength(3);
    expect(loaded!.bands[0]).toMatchObject({ lowerBound: 1600, upperBound: 2000, labelFr: 'Très bien' });
  });

  it('replaces draft bands without hard-deleting history', () => {
    const repository = createAppreciationRepository(db, tenant());
    const scaleId = repository.createDraft({ logicalScaleId: 'scale-1', version: 1, scale: validScale() });

    repository.replaceDraft(scaleId, { ...validScale(), name: 'Révisé' }, fixedAt);

    const loaded = repository.find(scaleId);
    expect(loaded!.name).toBe('Révisé');
    const oldRows = sqlite
      .prepare(
        `SELECT COUNT(*) AS value FROM appreciation_band
         WHERE appreciation_scale_id = ? AND deleted_at IS NOT NULL`
      )
      .get(scaleId) as { value: number };
    expect(oldRows.value).toBe(3);
  });

  it('finds the latest published scale only', () => {
    const repository = createAppreciationRepository(db, tenant());
    const v1 = repository.createDraft({ logicalScaleId: 'scale-1', version: 1, scale: validScale() });
    const v2 = repository.createDraft({ logicalScaleId: 'scale-1', version: 2, scale: validScale() });

    repository.publish(v1, fixedAt);
    expect(repository.findLatestPublished()!.id).toBe(v1);
    repository.publish(v2, fixedAt);
    expect(repository.findLatestPublished()!.id).toBe(v2);
    expect(repository.find(v1)!.status).toBe('PUBLISHED');
  });

  it('never leaks another school appreciation data', () => {
    const repository = createAppreciationRepository(db, tenant());
    repository.createDraft({ logicalScaleId: 'scale-1', version: 1, scale: validScale() });

    expect(createAppreciationRepository(db, tenant(secondSchool.id)).list()).toHaveLength(0);
  });
});

function requireFound<T>(value: T | undefined, label: string): T {
  if (value === undefined) {
    throw new Error(`Missing fixture: ${label}`);
  }
  return value;
}

function applyAllMigrations(sqlite: Database.Database) {
  const files = readdirSync(migrationsDir)
    .filter((file) => /^\d+_.+\.sql$/.test(file))
    .sort();

  for (const file of files) {
    sqlite.exec(readFileSync(join(migrationsDir, file), 'utf8'));
  }
}
