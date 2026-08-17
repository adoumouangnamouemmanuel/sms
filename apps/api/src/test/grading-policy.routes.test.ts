import type Database from 'better-sqlite3';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  openEduTrackDatabase,
  seedFoundation,
  type EduTrackDatabase,
  type EduTrackDatabaseConnection,
} from '@edutrack/db';
import type {
  AppreciationScaleView,
  AuthTokenResponse,
  GradingPoliciesResponse,
  GradingPolicyConfig,
  GradingPolicyDetailResponse,
  ResolvedPolicyResponse,
} from '@edutrack/shared';
import { buildServer } from '../server.js';
import { hashPassword } from '../modules/auth/index.js';

const migrationsDir = fileURLToPath(
  new URL('../../../../packages/db/migrations/sqlite/', import.meta.url)
);
const firstSchoolId = '00000000-0000-4000-8000-000000000101';
const schoolMasterId = '00000000-0000-4000-8000-000000000201';
const correctPassword = 'correct-password';
const accessTokenSecret = 'phase-3-grading-policy-test-secret';
const fixedNow = () => new Date('2026-08-15T10:00:00.000Z');

const levelSixId = '00000000-0000-4000-8000-00000000b101';
const levelThreeId = '00000000-0000-4000-8000-00000000b102';
const subjectMathId = '00000000-0000-4000-8000-00000000b501';
const subjectFrenchId = '00000000-0000-4000-8000-00000000b502';

let passwordHash: string;

describe('grading-policy routes (roadmap §9.7-§9.10)', () => {
  let sqlite: Database.Database;
  let db: EduTrackDatabase;
  let connection: EduTrackDatabaseConnection;
  let server: ReturnType<typeof buildServer>;

  beforeAll(async () => {
    passwordHash = await hashPassword(correctPassword);
  });

  beforeEach(() => {
    connection = openEduTrackDatabase(':memory:');
    sqlite = connection.sqlite;
    sqlite.pragma('foreign_keys = ON');
    applyAllMigrations(sqlite);
    db = connection.db;
    seedFoundation(db);
    seedAcademicFixture(sqlite);
    server = buildServer({
      databaseStatus: {
        sqlitePath: ':memory:',
        migrated: true,
        migrationId: 'deployment-probe-0001',
      },
      database: db,
      logger: false,
      auth: {
        accessTokenSecret,
        now: fixedNow,
      },
      security: {
        allowedOrigins: ['tauri://localhost'],
      },
    });
  });

  afterEach(async () => {
    await server.close();
    connection.close();
  });

  afterAll(() => {
    passwordHash = '';
  });

  // -------------------------------------------------------------------------
  // Policy lifecycle (roadmap §9.7)
  // -------------------------------------------------------------------------

  it('creates a DRAFT policy, reloads it and audits the event', async () => {
    const accessToken = await loginAndReadAccessToken('directeur');

    const response = await server.inject({
      method: 'POST',
      url: '/grading-policies',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: validPolicyConfig(),
    });

    expect(response.statusCode).toBe(200);
    const body = readJson(response) as ApiSuccess<GradingPolicyDetailResponse>;
    expect(body.data.policy).toMatchObject({
      status: 'DRAFT',
      version: 1,
      scaleMax: 20,
      passThreshold: 1000,
    });
    expect(body.data.policy.assessmentTypes).toHaveLength(2);
    expect(body.data.policy.subjectResult.inputs).toHaveLength(2);
    expect(findLatestAuditAction()).toBe('CONFIG_POLICY_CREATE');
  });

  it('rejects writes for teachers with GRADING_POLICY_FORBIDDEN', async () => {
    const accessToken = await loginAndReadAccessToken('enseignant');

    const response = await server.inject({
      method: 'POST',
      url: '/grading-policies',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: validPolicyConfig(),
    });

    expect(response.statusCode).toBe(403);
    expect(readFailure(response).error.code).toBe('GRADING_POLICY_FORBIDDEN');
  });

  it('updates a DRAFT and audits CONFIG_POLICY_UPDATE', async () => {
    const accessToken = await loginAndReadAccessToken('directeur');
    const policyId = await createDraftPolicy(accessToken);

    const next = validPolicyConfig();
    next.name = 'Politique révisée';
    const response = await server.inject({
      method: 'PUT',
      url: `/grading-policies/${policyId}`,
      headers: { authorization: `Bearer ${accessToken}` },
      payload: next,
    });

    expect(response.statusCode).toBe(200);
    const body = readJson(response) as ApiSuccess<GradingPolicyDetailResponse>;
    expect(body.data.policy.name).toBe('Politique révisée');
    expect(findLatestAuditAction()).toBe('CONFIG_POLICY_UPDATE');
  });

  it('publishes a valid policy and flips the readiness gate', async () => {
    const accessToken = await loginAndReadAccessToken('directeur');
    const policyId = await createDraftPolicy(accessToken);

    const response = await server.inject({
      method: 'POST',
      url: `/grading-policies/${policyId}/publish`,
      headers: { authorization: `Bearer ${accessToken}` },
    });

    expect(response.statusCode).toBe(200);
    const body = readJson(response) as ApiSuccess<GradingPolicyDetailResponse>;
    expect(body.data.policy.status).toBe('PUBLISHED');
    expect(body.data.policy.publishedAt).toBe(fixedNow().toISOString());
    expect(findLatestAuditAction()).toBe('CONFIG_POLICY_PUBLISH');

    // The readiness evaluator no longer reports GRADING_POLICY_PUBLISHED missing.
    const readiness = await server.inject({
      method: 'GET',
      url: '/configuration/readiness',
      headers: { authorization: `Bearer ${accessToken}` },
    });
    const readinessBody = readJson(readiness) as ApiSuccess<{
      capabilities: { capability: string; missing: string[] }[];
    }>;
    const gradeEntry = readinessBody.data.capabilities.find(
      (capability) => capability.capability === 'GRADE_ENTRY'
    );
    expect(gradeEntry?.missing).not.toContain('GRADING_POLICY_PUBLISHED');
  });

  it('rejects publication with GRADING_POLICY_INVALID when weights do not total 100%', async () => {
    const accessToken = await loginAndReadAccessToken('directeur');
    const policyId = await createDraftPolicy(accessToken);

    const bad = validPolicyConfig();
    const firstInput = bad.subjectResult.inputs[0];
    if (firstInput) {
      bad.subjectResult.inputs[0] = { ...firstInput, weight: 3000 };
    }
    await server.inject({
      method: 'PUT',
      url: `/grading-policies/${policyId}`,
      headers: { authorization: `Bearer ${accessToken}` },
      payload: bad,
    });

    const response = await server.inject({
      method: 'POST',
      url: `/grading-policies/${policyId}/publish`,
      headers: { authorization: `Bearer ${accessToken}` },
    });

    expect(response.statusCode).toBe(422);
    const failure = readFailure(response);
    expect(failure.error.code).toBe('GRADING_POLICY_INVALID');
    expect(failure.error.fields?.WEIGHT_TOTAL).toMatch(/100 %/);
  });

  it('rejects publication when an assessment type uses a different scale than the policy', async () => {
    const accessToken = await loginAndReadAccessToken('directeur');
    const policyId = await createDraftPolicy(accessToken);

    const mismatched = validPolicyConfig();
    const firstType = mismatched.assessmentTypes[0];
    if (firstType) {
      mismatched.assessmentTypes[0] = { ...firstType, scaleMax: 10 };
    }
    await server.inject({
      method: 'PUT',
      url: `/grading-policies/${policyId}`,
      headers: { authorization: `Bearer ${accessToken}` },
      payload: mismatched,
    });

    const response = await server.inject({
      method: 'POST',
      url: `/grading-policies/${policyId}/publish`,
      headers: { authorization: `Bearer ${accessToken}` },
    });

    expect(response.statusCode).toBe(422);
    const failure = readFailure(response);
    expect(failure.error.code).toBe('GRADING_POLICY_INVALID');
    expect(failure.error.fields?.SCALE_MISMATCH).toMatch(/même barème/);
  });

  it('rejects publication with a cyclic derived-result graph', async () => {
    const accessToken = await loginAndReadAccessToken('directeur');
    const policyId = await createDraftPolicy(accessToken);

    const cyclic = validPolicyConfig();
    cyclic.derivedResults = [
      {
        id: 'derived-a',
        name: 'Moyenne A',
        shortName: 'A',
        operation: 'MEAN',
        sourceDefinitionIds: ['derived-b'],
        precision: 2,
        roundingMode: 'HALF_UP',
        displayOrder: 1,
      },
      {
        id: 'derived-b',
        name: 'Moyenne B',
        shortName: 'B',
        operation: 'MEAN',
        sourceDefinitionIds: ['derived-a'],
        precision: 2,
        roundingMode: 'HALF_UP',
        displayOrder: 2,
      },
    ];
    cyclic.subjectResult.inputs = [
      { sourceDefinitionId: 'derived-a', weight: 10000, displayOrder: 1 },
    ];
    await server.inject({
      method: 'PUT',
      url: `/grading-policies/${policyId}`,
      headers: { authorization: `Bearer ${accessToken}` },
      payload: cyclic,
    });

    const response = await server.inject({
      method: 'POST',
      url: `/grading-policies/${policyId}/publish`,
      headers: { authorization: `Bearer ${accessToken}` },
    });

    expect(response.statusCode).toBe(422);
    expect(readFailure(response).error.fields?.CYCLE_DETECTED).toMatch(/circulaire/i);
  });

  it('treats a published policy as immutable (409) and duplicates it as the next version', async () => {
    const accessToken = await loginAndReadAccessToken('directeur');
    const policyId = await createDraftPolicy(accessToken);

    const publish = await server.inject({
      method: 'POST',
      url: `/grading-policies/${policyId}/publish`,
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(publish.statusCode).toBe(200);

    const update = await server.inject({
      method: 'PUT',
      url: `/grading-policies/${policyId}`,
      headers: { authorization: `Bearer ${accessToken}` },
      payload: validPolicyConfig(),
    });
    expect(update.statusCode).toBe(409);
    expect(readFailure(update).error.code).toBe('GRADING_POLICY_IMMUTABLE');

    const duplicate = await server.inject({
      method: 'POST',
      url: `/grading-policies/${policyId}/duplicate`,
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(duplicate.statusCode).toBe(200);
    const body = readJson(duplicate) as ApiSuccess<GradingPolicyDetailResponse>;
    expect(body.data.policy).toMatchObject({ version: 2, status: 'DRAFT' });
  });

  // -------------------------------------------------------------------------
  // Scope assignment and resolution (roadmap §9.9)
  // -------------------------------------------------------------------------

  it('assigns scopes and resolves school default -> level -> level + subject', async () => {
    const accessToken = await loginAndReadAccessToken('directeur');

    const schoolDefaultId = await createDraftPolicy(accessToken);
    await server.inject({
      method: 'PUT',
      url: `/grading-policies/${schoolDefaultId}/scopes`,
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { scopes: [{ scopeType: 'SCHOOL_DEFAULT', levelId: null, subjectId: null }] },
    });

    const levelPolicyId = await createDraftPolicy(accessToken);
    await server.inject({
      method: 'PUT',
      url: `/grading-policies/${levelPolicyId}/scopes`,
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { scopes: [{ scopeType: 'LEVEL', levelId: levelThreeId, subjectId: null }] },
    });

    const subjectPolicyId = await createDraftPolicy(accessToken);
    await server.inject({
      method: 'PUT',
      url: `/grading-policies/${subjectPolicyId}/scopes`,
      headers: { authorization: `Bearer ${accessToken}` },
      payload: {
        scopes: [{ scopeType: 'LEVEL_SUBJECT', levelId: levelThreeId, subjectId: subjectMathId }],
      },
    });

    for (const id of [schoolDefaultId, levelPolicyId, subjectPolicyId]) {
      const publish = await server.inject({
        method: 'POST',
        url: `/grading-policies/${id}/publish`,
        headers: { authorization: `Bearer ${accessToken}` },
      });
      expect(publish.statusCode).toBe(200);
    }

    // Most specific wins: math in Troisieme -> the subject policy.
    const math = await resolve(accessToken, levelThreeId, subjectMathId);
    expect(math.resolved?.policyId).toBe(subjectPolicyId);
    expect(math.resolved?.matchedScope).toBe('LEVEL_SUBJECT');

    // French in Troisieme -> the level policy.
    const french = await resolve(accessToken, levelThreeId, subjectFrenchId);
    expect(french.resolved?.policyId).toBe(levelPolicyId);
    expect(french.resolved?.matchedScope).toBe('LEVEL');

    // Any subject in Sixieme -> the school default.
    const sixieme = await resolve(accessToken, levelSixId, subjectMathId);
    expect(sixieme.resolved?.policyId).toBe(schoolDefaultId);
    expect(sixieme.resolved?.matchedScope).toBe('SCHOOL_DEFAULT');
  });

  it('returns a null resolution when no published policy covers the scope', async () => {
    const accessToken = await loginAndReadAccessToken('directeur');

    const response = await server.inject({
      method: 'GET',
      url: `/grading-policies/resolved?levelId=${levelThreeId}&subjectId=${subjectMathId}`,
      headers: { authorization: `Bearer ${accessToken}` },
    });

    expect(response.statusCode).toBe(200);
    const body = readJson(response) as ApiSuccess<ResolvedPolicyResponse>;
    expect(body.data.resolved).toBeNull();
  });

  it('rejects a scope already owned by a published policy (409)', async () => {
    const accessToken = await loginAndReadAccessToken('directeur');

    const first = await createDraftPolicy(accessToken);
    await server.inject({
      method: 'PUT',
      url: `/grading-policies/${first}/scopes`,
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { scopes: [{ scopeType: 'SCHOOL_DEFAULT', levelId: null, subjectId: null }] },
    });
    const publish = await server.inject({
      method: 'POST',
      url: `/grading-policies/${first}/publish`,
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(publish.statusCode).toBe(200);

    const second = await createDraftPolicy(accessToken);
    const conflict = await server.inject({
      method: 'PUT',
      url: `/grading-policies/${second}/scopes`,
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { scopes: [{ scopeType: 'SCHOOL_DEFAULT', levelId: null, subjectId: null }] },
    });

    expect(conflict.statusCode).toBe(409);
    expect(readFailure(conflict).error.code).toBe('GRADING_POLICY_SCOPE_CONFLICT');
  });

  it('never leaks policies or scopes across schools and lets the other school own its scope', async () => {
    const accessToken = await loginAndReadAccessToken('directeur');
    const policyId = await createDraftPolicy(accessToken);
    await server.inject({
      method: 'PUT',
      url: `/grading-policies/${policyId}/scopes`,
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { scopes: [{ scopeType: 'SCHOOL_DEFAULT', levelId: null, subjectId: null }] },
    });
    const publish = await server.inject({
      method: 'POST',
      url: `/grading-policies/${policyId}/publish`,
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(publish.statusCode).toBe(200);

    const otherToken = await loginAndReadAccessToken('directeur', 'MND-DEMO');
    const list = await server.inject({
      method: 'GET',
      url: '/grading-policies',
      headers: { authorization: `Bearer ${otherToken}` },
    });
    const body = readJson(list) as ApiSuccess<GradingPoliciesResponse>;
    expect(body.data.policies).toHaveLength(0);
    expect(body.data.scopes).toHaveLength(0);

    // The other school can freely publish its own school-default policy.
    const otherPolicyId = await createDraftPolicy(otherToken);
    const assign = await server.inject({
      method: 'PUT',
      url: `/grading-policies/${otherPolicyId}/scopes`,
      headers: { authorization: `Bearer ${otherToken}` },
      payload: { scopes: [{ scopeType: 'SCHOOL_DEFAULT', levelId: null, subjectId: null }] },
    });
    expect(assign.statusCode).toBe(200);
  });

  // -------------------------------------------------------------------------
  // Appreciation (roadmap §9.10)
  // -------------------------------------------------------------------------

  it('creates, validates and publishes an appreciation scale', async () => {
    const accessToken = await loginAndReadAccessToken('directeur');

    const create = await server.inject({
      method: 'POST',
      url: '/appreciation-scales',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: validAppreciationScale(),
    });
    expect(create.statusCode).toBe(200);
    const created = readJson(create) as ApiSuccess<AppreciationScaleView>;
    expect(created.data.status).toBe('DRAFT');
    expect(created.data.bands).toHaveLength(3);

    const publish = await server.inject({
      method: 'POST',
      url: `/appreciation-scales/${created.data.id}/publish`,
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(publish.statusCode).toBe(200);
    const published = readJson(publish) as ApiSuccess<AppreciationScaleView>;
    expect(published.data.status).toBe('PUBLISHED');
    expect(findLatestAuditAction()).toBe('CONFIG_APPRECIATION_PUBLISH');
  });

  it('rejects an appreciation scale with gaps or overlaps', async () => {
    const accessToken = await loginAndReadAccessToken('directeur');

    const gappy = validAppreciationScale();
    // Real gap: nothing covers 16.00-16.99 (bands jump from 15.99 to 17.00).
    gappy.bands = [
      {
        lowerBound: 1700,
        upperBound: 2000,
        labelFr: 'TB',
        labelAr: 'TB',
        labelEn: 'TB',
        shortLabel: 'TB',
        displayOrder: 1,
      },
      {
        lowerBound: 800,
        upperBound: 1599,
        labelFr: 'P',
        labelAr: 'P',
        labelEn: 'P',
        shortLabel: 'P',
        displayOrder: 2,
      },
      {
        lowerBound: 0,
        upperBound: 799,
        labelFr: 'I',
        labelAr: 'I',
        labelEn: 'I',
        shortLabel: 'I',
        displayOrder: 3,
      },
    ];

    const response = await server.inject({
      method: 'POST',
      url: '/appreciation-scales',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: gappy,
    });

    expect(response.statusCode).toBe(422);
    expect(readFailure(response).error.code).toBe('APPRECIATION_INVALID');
  });

  it('rejects appreciation writes from teachers', async () => {
    const accessToken = await loginAndReadAccessToken('enseignant');

    const response = await server.inject({
      method: 'POST',
      url: '/appreciation-scales',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: validAppreciationScale(),
    });

    expect(response.statusCode).toBe(403);
    expect(readFailure(response).error.code).toBe('APPRECIATION_FORBIDDEN');
  });

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  async function loginAndReadAccessToken(username: string, schoolCode = 'NDS-DEMO') {
    const response = await server.inject({
      method: 'POST',
      url: '/auth/login',
      payload: {
        schoolCode,
        username,
        password: correctPassword,
        deviceName: 'Vitest',
      },
    });

    expect(response.statusCode).toBe(200);
    return (readJson(response) as ApiSuccess<AuthTokenResponse>).data.accessToken;
  }

  async function createDraftPolicy(accessToken: string) {
    const response = await server.inject({
      method: 'POST',
      url: '/grading-policies',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: validPolicyConfig(),
    });
    expect(response.statusCode).toBe(200);
    return (readJson(response) as ApiSuccess<GradingPolicyDetailResponse>).data.policy.id;
  }

  async function resolve(accessToken: string, levelId: string, subjectId: string) {
    const response = await server.inject({
      method: 'GET',
      url: `/grading-policies/resolved?levelId=${levelId}&subjectId=${subjectId}`,
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(response.statusCode).toBe(200);
    return (readJson(response) as ApiSuccess<ResolvedPolicyResponse>).data;
  }

  function findLatestAuditAction() {
    const row = sqlite
      .prepare(
        `
          SELECT action
          FROM audit_log
          WHERE school_id = ?
          ORDER BY rowid DESC
          LIMIT 1
        `
      )
      .get(firstSchoolId) as { action: string } | undefined;

    return row?.action;
  }
});

function validPolicyConfig(): GradingPolicyConfig {
  return {
    name: 'Devoirs + Composition',
    scaleMax: 20,
    passThreshold: 1000,
    decimalPrecision: 2,
    roundingMode: 'HALF_UP',
    effectiveAcademicYearId: null,
    assessmentTypes: [
      {
        id: 'dev-1',
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
        id: 'comp-1',
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

function validAppreciationScale() {
  return {
    name: 'Barème secondaire',
    scaleMax: 20,
    bands: [
      {
        lowerBound: 1600,
        upperBound: 2000,
        labelFr: 'Très bien',
        labelAr: 'جيد جداً',
        labelEn: 'Very good',
        shortLabel: 'TB',
        displayOrder: 1,
      },
      {
        lowerBound: 1000,
        upperBound: 1599,
        labelFr: 'Passable',
        labelAr: 'مقبول',
        labelEn: 'Passable',
        shortLabel: 'P',
        displayOrder: 2,
      },
      {
        lowerBound: 0,
        upperBound: 999,
        labelFr: 'Insuffisant',
        labelAr: 'غير كاف',
        labelEn: 'Insufficient',
        shortLabel: 'I',
        displayOrder: 3,
      },
    ],
  };
}

function seedAcademicFixture(sqlite: Database.Database) {
  sqlite
    .prepare(
      `
        UPDATE user
        SET password_hash = ?, failed_login_attempts = 0, locked_until = NULL
        WHERE id = ? OR id = ?
      `
    )
    .run(passwordHash, schoolMasterId, '00000000-0000-4000-8000-000000000202');

  sqlite
    .prepare(
      `
        INSERT INTO user (id, school_id, username, password_hash, role)
        VALUES (?, ?, ?, ?, ?)
      `
    )
    .run(
      '00000000-0000-4000-8000-000000000302',
      firstSchoolId,
      'enseignant',
      passwordHash,
      'TEACHER'
    );

  sqlite
    .prepare(
      `
        INSERT INTO academic_year (id, school_id, label, start_date, end_date, is_current, status)
        VALUES (?, ?, '2026-2027', '2026-09-01', '2027-06-30', 1, 'ACTIVE')
      `
    )
    .run('00000000-0000-4000-8000-00000000b001', firstSchoolId);

  const levels = [
    [levelSixId, '6E', 'Sixième', 1, 0],
    [levelThreeId, '3E', 'Troisième', 2, 1],
  ] as const;

  for (const [id, code, name, order, exam] of levels) {
    sqlite
      .prepare(
        `
          INSERT INTO class_level (id, school_id, code, name, display_order, is_exam_year)
          VALUES (?, ?, ?, ?, ?, ?)
        `
      )
      .run(id, firstSchoolId, code, name, order, exam);
  }

  const subjects = [
    [subjectMathId, 'MATH', 'Mathématiques', 'MATHEMATIQUES'],
    [subjectFrenchId, 'FR', 'Français', 'LANGUES'],
  ] as const;

  for (const [id, code, name, category] of subjects) {
    sqlite
      .prepare(
        `
          INSERT INTO subject (id, school_id, code, name, category)
          VALUES (?, ?, ?, ?, ?)
        `
      )
      .run(id, firstSchoolId, code, name, category);
  }
}

function readJson(response: { body: string }) {
  return JSON.parse(response.body) as unknown;
}

function readFailure(response: { body: string }): ApiFailure {
  return readJson(response) as ApiFailure;
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

interface ApiSuccess<T> {
  success: true;
  data: T;
}

interface ApiFailure {
  success: false;
  error: { code: string; message: string; fields?: Record<string, string> };
}
