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
import {
  assertConfigLifecycleTransition,
  canTransitionConfigLifecycle,
  ConfigLifecycleTransitionError,
  configurationRequirementMet,
  evaluateConfigurationReadiness,
} from '@edutrack/domain';
import {
  CONFIG_REQUIREMENTS,
  configurationReadinessResponseSchema,
  type AuthTokenResponse,
  type ConfigurationReadinessResponse,
  type ConfigurationSnapshot,
} from '@edutrack/shared';
import { buildServer } from '../server.js';
import { hashPassword } from '../modules/auth/index.js';
import { ConfigurationService } from '../modules/configuration/index.js';
import { ConfigurationServiceError } from '../modules/configuration/index.js';

const migrationsDir = fileURLToPath(
  new URL('../../../../packages/db/migrations/sqlite/', import.meta.url)
);
const firstSchoolId = '00000000-0000-4000-8000-000000000101';
const schoolMasterId = '00000000-0000-4000-8000-000000000201';
const secondSchoolMasterId = '00000000-0000-4000-8000-000000000202';
const teacherId = '00000000-0000-4000-8000-000000000301';
const correctPassword = 'correct-password';
const accessTokenSecret = 'phase-3-configuration-test-secret';

let passwordHash: string;

describe('configuration readiness domain rules', () => {
  const emptySnapshot: ConfigurationSnapshot = {
    schoolProfileComplete: false,
    activeAcademicYear: false,
    levelCount: 0,
    subjectCount: 0,
    curriculumClassCount: 0,
    publishedGradingPolicies: 0,
    appreciationConfigured: false,
    validatedSubmissions: 0,
    bulletinConfigured: false,
  };

  const fullSnapshot: ConfigurationSnapshot = {
    schoolProfileComplete: true,
    activeAcademicYear: true,
    levelCount: 2,
    subjectCount: 10,
    curriculumClassCount: 14,
    publishedGradingPolicies: 1,
    appreciationConfigured: true,
    validatedSubmissions: 40,
    bulletinConfigured: true,
  };

  it('marks every capability and area READY for a fully configured school', () => {
    const state = evaluateConfigurationReadiness(fullSnapshot);

    expect(state.areas.every((area) => area.status === 'READY')).toBe(true);
    expect(state.capabilities).toHaveLength(7);
    for (const capability of state.capabilities) {
      expect(capability.status).toBe('READY');
      expect(capability.missing).toEqual([]);
      expect(capability.blockedBy).toEqual([]);
    }
  });

  it('marks every capability and area NOT_READY for an empty school without throwing', () => {
    const state = evaluateConfigurationReadiness(emptySnapshot);

    expect(state.areas.every((area) => area.status === 'NOT_READY')).toBe(true);
    expect(state.capabilities.every((capability) => capability.status === 'NOT_READY')).toBe(true);
    expect(state.capabilities[0]?.missing).toEqual([
      'SCHOOL_PROFILE_COMPLETE',
      'ACTIVE_ACADEMIC_YEAR',
      'LEVELS_DEFINED',
    ]);
  });

  it('reports exactly the unmet requirements for a partially configured school', () => {
    const state = evaluateConfigurationReadiness({
      ...emptySnapshot,
      schoolProfileComplete: true,
      activeAcademicYear: true,
      levelCount: 1,
    });

    const classroomManagement = state.capabilities.find(
      (capability) => capability.capability === 'CLASSROOM_MANAGEMENT'
    );
    expect(classroomManagement?.status).toBe('READY');

    const curriculum = state.capabilities.find(
      (capability) => capability.capability === 'CURRICULUM_CONFIGURATION'
    );
    expect(curriculum?.status).toBe('NOT_READY');
    expect(curriculum?.missing).toEqual(['SUBJECTS_DEFINED']);

    const gradeEntry = state.capabilities.find(
      (capability) => capability.capability === 'GRADE_ENTRY'
    );
    expect(gradeEntry?.status).toBe('NOT_READY');
    expect(gradeEntry?.missing).toEqual(['CURRICULUM_DEFINED', 'GRADING_POLICY_PUBLISHED']);
    expect(gradeEntry?.blockedBy).toEqual(['CURRICULUM_CONFIGURATION']);
  });

  it('cascades the gate ladder: PDF stays blocked until its prerequisites are ready', () => {
    const state = evaluateConfigurationReadiness({
      ...fullSnapshot,
      bulletinConfigured: false,
    });

    const pdf = state.capabilities.find((capability) => capability.capability === 'PDF_GENERATION');
    expect(pdf?.status).toBe('NOT_READY');
    expect(pdf?.missing).toEqual(['BULLETIN_CONFIGURED']);

    const transcript = state.capabilities.find(
      (capability) => capability.capability === 'TRANSCRIPT_CALCULATION'
    );
    expect(transcript?.status).toBe('READY');
  });

  it('treats zero counts as unmet requirements without NaN or partial values', () => {
    for (const requirement of CONFIG_REQUIREMENTS) {
      expect(configurationRequirementMet(emptySnapshot, requirement)).toBe(false);
      expect(configurationRequirementMet(fullSnapshot, requirement)).toBe(true);
    }
  });

  it('enforces the DRAFT -> PUBLISHED -> SUPERSEDED lifecycle', () => {
    expect(canTransitionConfigLifecycle('DRAFT', 'PUBLISHED')).toBe(true);
    expect(canTransitionConfigLifecycle('PUBLISHED', 'SUPERSEDED')).toBe(true);
    expect(canTransitionConfigLifecycle('DRAFT', 'SUPERSEDED')).toBe(true);
    expect(canTransitionConfigLifecycle('PUBLISHED', 'DRAFT')).toBe(false);
    expect(canTransitionConfigLifecycle('SUPERSEDED', 'PUBLISHED')).toBe(false);
    expect(canTransitionConfigLifecycle('SUPERSEDED', 'DRAFT')).toBe(false);

    expect(() => {
      assertConfigLifecycleTransition('PUBLISHED', 'DRAFT');
    }).toThrow(ConfigLifecycleTransitionError);
    expect(() => {
      assertConfigLifecycleTransition('DRAFT', 'PUBLISHED');
    }).not.toThrow();
  });
});

describe('configuration readiness routes', () => {
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
    seedConfigurationUsers(sqlite);
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

  it('rejects unauthenticated readiness access', async () => {
    const response = await server.inject({
      method: 'GET',
      url: '/configuration/readiness',
    });

    expect(response.statusCode).toBe(401);
  });

  it('returns a French, schema-valid readiness state for an unconfigured school', async () => {
    const accessToken = await loginAndReadAccessToken('directeur');

    const response = await server.inject({
      method: 'GET',
      url: '/configuration/readiness',
      headers: { authorization: `Bearer ${accessToken}` },
    });

    expect(response.statusCode).toBe(200);
    const body = readJson(response) as ApiSuccess<ConfigurationReadinessResponse>;
    expect(body.success).toBe(true);
    expect(configurationReadinessResponseSchema.safeParse(body.data).success).toBe(true);

    const profile = body.data.areas.find((area) => area.area === 'SCHOOL_PROFILE');
    expect(profile?.label).toBe('Configuration générale');
    expect(profile?.status).toBe('NOT_READY');

    const gradeEntry = body.data.capabilities.find(
      (capability) => capability.capability === 'GRADE_ENTRY'
    );
    expect(gradeEntry?.label).toBe('Saisir les notes');
    expect(gradeEntry?.status).toBe('NOT_READY');
  });

  it('lets a teacher read readiness too (they need the blocked-message UX)', async () => {
    const accessToken = await loginAndReadAccessToken('enseignant');

    const response = await server.inject({
      method: 'GET',
      url: '/configuration/readiness',
      headers: { authorization: `Bearer ${accessToken}` },
    });

    expect(response.statusCode).toBe(200);
    const body = readJson(response) as ApiSuccess<ConfigurationReadinessResponse>;
    expect(body.data.capabilities.length).toBeGreaterThan(0);
  });

  it('reflects live configuration: structure ready, grade entry still blocked', async () => {
    seedConfigurationFixture(sqlite, firstSchoolId);

    const accessToken = await loginAndReadAccessToken('directeur');
    const response = await server.inject({
      method: 'GET',
      url: '/configuration/readiness',
      headers: { authorization: `Bearer ${accessToken}` },
    });

    const body = readJson(response) as ApiSuccess<ConfigurationReadinessResponse>;
    const classroomManagement = body.data.capabilities.find(
      (capability) => capability.capability === 'CLASSROOM_MANAGEMENT'
    );
    expect(classroomManagement?.status).toBe('READY');

    const gradeEntry = body.data.capabilities.find(
      (capability) => capability.capability === 'GRADE_ENTRY'
    );
    expect(gradeEntry?.status).toBe('NOT_READY');
    expect(gradeEntry?.missing).toContain('GRADING_POLICY_PUBLISHED');
  });

  it('never leaks another school configuration into the tenant readiness', async () => {
    seedConfigurationFixture(sqlite, firstSchoolId);

    const accessToken = await loginAndReadAccessToken('directeur', 'MND-DEMO');
    const response = await server.inject({
      method: 'GET',
      url: '/configuration/readiness',
      headers: { authorization: `Bearer ${accessToken}` },
    });

    expect(response.statusCode).toBe(200);
    const body = readJson(response) as ApiSuccess<ConfigurationReadinessResponse>;
    const classroomManagement = body.data.capabilities.find(
      (capability) => capability.capability === 'CLASSROOM_MANAGEMENT'
    );
    expect(classroomManagement?.status).toBe('NOT_READY');
    expect(classroomManagement?.missing).toContain('LEVELS_DEFINED');
  });

  it('enforces the backend capability gate with actionable missing requirements', () => {
    const service = new ConfigurationService(db);
    const emptyActor = {
      schoolId: firstSchoolId,
      id: schoolMasterId,
      username: 'directeur',
      role: 'SCHOOL_MASTER' as const,
    };

    let caught: unknown;

    try {
      service.assertCapability(emptyActor, 'GRADE_ENTRY');
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(ConfigurationServiceError);
    if (caught instanceof ConfigurationServiceError) {
      expect(caught.code).toBe('CONFIGURATION_NOT_READY');
      expect(caught.statusCode).toBe(409);
      expect(caught.fields?.missing).toContain('GRADING_POLICY_PUBLISHED');
    }

    seedConfigurationFixture(sqlite, firstSchoolId);
    expect(() => {
      service.assertCapability(emptyActor, 'CLASSROOM_MANAGEMENT');
    }).not.toThrow();
    expect(() => {
      service.assertCapability(emptyActor, 'GRADE_ENTRY');
    }).toThrow(ConfigurationServiceError);
  });

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
});

function seedConfigurationUsers(sqlite: Database.Database) {
  sqlite
    .prepare(
      `
        UPDATE user
        SET password_hash = ?, failed_login_attempts = 0, locked_until = NULL
        WHERE id = ? OR id = ?
      `
    )
    .run(passwordHash, schoolMasterId, secondSchoolMasterId);

  sqlite
    .prepare(
      `
        INSERT INTO user (id, school_id, username, password_hash, role)
        VALUES (?, ?, ?, ?, ?)
      `
    )
    .run(teacherId, firstSchoolId, 'enseignant', passwordHash, 'TEACHER');
}

/** One level, one subject and one active class-subject for the given school. */
function seedConfigurationFixture(sqlite: Database.Database, schoolId: string) {
  const yearId = `${schoolId.slice(0, 8)}-0000-4000-8000-00000000a101`;
  const levelId = `${schoolId.slice(0, 8)}-0000-4000-8000-00000000a102`;
  const subjectId = `${schoolId.slice(0, 8)}-0000-4000-8000-00000000a103`;
  const classroomId = `${schoolId.slice(0, 8)}-0000-4000-8000-00000000a104`;
  const classSubjectId = `${schoolId.slice(0, 8)}-0000-4000-8000-00000000a105`;

  sqlite.prepare(`UPDATE school SET setup_status = 'COMPLETED' WHERE id = ?`).run(schoolId);
  sqlite
    .prepare(
      `
        INSERT INTO academic_year (id, school_id, label, start_date, end_date, is_current)
        VALUES (?, ?, '2026-2027', '2026-09-01', '2027-06-30', 1)
      `
    )
    .run(yearId, schoolId);
  sqlite
    .prepare(
      `
        INSERT INTO class_level (id, school_id, code, name, display_order, is_exam_year)
        VALUES (?, ?, '6E', 'Sixième', 1, 0)
      `
    )
    .run(levelId, schoolId);
  sqlite
    .prepare(
      `
        INSERT INTO subject (id, school_id, code, name, category)
        VALUES (?, ?, 'MATH', 'Mathématiques', 'MATHEMATIQUES')
      `
    )
    .run(subjectId, schoolId);
  sqlite
    .prepare(
      `
        INSERT INTO classroom (id, school_id, academic_year_id, class_level_id, code, name)
        VALUES (?, ?, ?, ?, '6E-A', 'Sixième A')
      `
    )
    .run(classroomId, schoolId, yearId, levelId);
  sqlite
    .prepare(
      `
        INSERT INTO class_subject (id, school_id, classroom_id, subject_id, coefficient)
        VALUES (?, ?, ?, ?, 3)
      `
    )
    .run(classSubjectId, schoolId, classroomId, subjectId);
}

function readJson(response: { body: string }) {
  const parsed: unknown = JSON.parse(response.body);

  return parsed;
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
