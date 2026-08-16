import type Database from 'better-sqlite3';
import { randomUUID } from 'node:crypto';
import { readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  openEduTrackDatabase,
  seedFoundation,
  type EduTrackDatabase,
  type EduTrackDatabaseConnection,
} from '@edutrack/db';
import type { AuthTokenResponse, SetupStateResponse } from '@edutrack/shared';
import { buildServer } from '../server.js';
import { hashPassword } from '../modules/auth/index.js';

const migrationsDir = fileURLToPath(
  new URL('../../../../packages/db/migrations/sqlite/', import.meta.url)
);
const firstSchoolId = '00000000-0000-4000-8000-000000000101';
const schoolMasterId = '00000000-0000-4000-8000-000000000201';
const secondSchoolMasterId = '00000000-0000-4000-8000-000000000202';
const teacherId = '00000000-0000-4000-8000-000000000301';
const correctPassword = 'correct-password';
const accessTokenSecret = 'phase-2-setup-test-secret-with-local-only-scope';

let passwordHash: string;

describe('school setup routes', () => {
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
    seedSetupFixture(sqlite);
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

  it('saves each setup step and enables only implemented modules on completion, surviving application restarts', async () => {
    // Override the in-memory server and connection with a file-backed one for this test
    // to prove that setup steps survive an application restart.
    await server.close();
    connection.close();

    const dbPath = join(tmpdir(), `edutrack-setup-test-${randomUUID()}.sqlite`);
    connection = openEduTrackDatabase(dbPath);
    sqlite = connection.sqlite;
    sqlite.pragma('foreign_keys = ON');
    applyAllMigrations(sqlite);
    db = connection.db;
    seedFoundation(db);
    seedSetupFixture(sqlite);
    server = buildServer({
      databaseStatus: {
        sqlitePath: dbPath,
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

    try {
      const accessToken = await loginAndReadAccessToken('directeur');

      const initialState = await injectSetupState(accessToken);
      expect(initialState.data.school.setupStatus).toBe('PENDING');
      expect(initialState.data.nextStep).toBe('profile');

      const profileState = await injectSetupRequest(accessToken, 'PUT', '/setup/profile', {
        name: 'Lycee Demo N Djamena',
        shortName: 'LDN',
        logoUrl: 'https://example.com/logo.png',
        address: 'Avenue Charles de Gaulle',
        city: 'N Djamena',
        phone: '+23500000001',
        email: '',
        motto: 'Travail et excellence',
        ministryCode: 'MEN-001',
      });
      expect(profileState.data.school.setupStatus).toBe('PROFILE_COMPLETED');
      expect(profileState.data.school.currency).toBe('XAF');
      expect(profileState.data.school.email).toBeNull();
      expect(profileState.data.nextStep).toBe('calendar');

      const calendarState = await injectSetupRequest(accessToken, 'PUT', '/setup/calendar', {
        academicYear: {
          label: '2026-2027',
          startDate: '2026-09-01',
          endDate: '2027-06-30',
        },
        termSystem: 'TRIMESTER',
        terms: [
          {
            label: 'Trimestre 1',
            termNumber: 1,
            startDate: '2026-09-01',
            endDate: '2026-12-20',
            isCurrent: true,
          },
          {
            label: 'Trimestre 2',
            termNumber: 2,
            startDate: '2027-01-05',
            endDate: '2027-03-31',
            isCurrent: false,
          },
          {
            label: 'Trimestre 3',
            termNumber: 3,
            startDate: '2027-04-01',
            endDate: '2027-06-30',
            isCurrent: false,
          },
        ],
      });
      expect(calendarState.data.school.setupStatus).toBe('CALENDAR_COMPLETED');
      expect(calendarState.data.terms).toHaveLength(3);
      expect(calendarState.data.terms.filter((term) => term.isCurrent)).toHaveLength(1);

      const classLevelsState = await injectSetupRequest(accessToken, 'PUT', '/setup/class-levels', {
        classLevels: [
          { code: '6e', name: 'Sixieme', displayOrder: 1, isExamYear: false },
          { code: '3e', name: 'Troisieme', displayOrder: 2, isExamYear: true },
        ],
      });
      expect(classLevelsState.data.school.setupStatus).toBe('CLASS_LEVELS_COMPLETED');
      expect(classLevelsState.data.classLevels.map((level) => level.code)).toEqual(['6E', '3E']);
      expect(classLevelsState.data.nextStep).toBe('subjects');

      // Module steps persist through their own APIs; the wizard only advances
      // the setup status once the prerequisite data exists (roadmap §9.11).
      await injectModuleRequest(accessToken, 'POST', '/subjects', {
        code: 'math',
        name: 'Mathématiques',
        category: 'MATHEMATIQUES',
      });
      const subjectsState = await injectSetupRequest(accessToken, 'PUT', '/setup/step', {
        step: 'subjects',
      });
      expect(subjectsState.data.school.setupStatus).toBe('SUBJECTS_COMPLETED');
      expect(subjectsState.data.nextStep).toBe('groups');

      await injectModuleRequest(accessToken, 'POST', '/subject-groups', {
        name: 'Matières scientifiques',
        displayOrder: 1,
      });
      const groupsState = await injectSetupRequest(accessToken, 'PUT', '/setup/step', {
        step: 'groups',
      });
      expect(groupsState.data.school.setupStatus).toBe('GROUPS_COMPLETED');
      expect(groupsState.data.nextStep).toBe('grading');

      const policyResponse = await injectModuleRequest(
        accessToken,
        'POST',
        '/grading-policies',
        validPolicyConfig()
      );
      const policyId = (policyResponse.data as { policy: { id: string } }).policy.id;
      await injectModuleRequest(accessToken, 'POST', `/grading-policies/${policyId}/publish`, {});
      const gradingState = await injectSetupRequest(accessToken, 'PUT', '/setup/step', {
        step: 'grading',
      });
      expect(gradingState.data.school.setupStatus).toBe('GRADING_COMPLETED');
      expect(gradingState.data.nextStep).toBe('appreciation');

      const scaleResponse = await injectModuleRequest(
        accessToken,
        'POST',
        '/appreciation-scales',
        validAppreciationScale()
      );
      const scaleId = (scaleResponse.data as { id: string }).id;
      await injectModuleRequest(accessToken, 'POST', `/appreciation-scales/${scaleId}/publish`, {});
      const appreciationState = await injectSetupRequest(accessToken, 'PUT', '/setup/step', {
        step: 'appreciation',
      });
      expect(appreciationState.data.school.setupStatus).toBe('APPRECIATION_COMPLETED');
      expect(appreciationState.data.nextStep).toBe('review');

      const completedState = await injectSetupRequest(accessToken, 'POST', '/setup/complete', {});
      expect(completedState.data.school.setupStatus).toBe('COMPLETED');
      expect(
        completedState.data.enabledModules.map((moduleConfig) => moduleConfig.moduleName)
      ).toEqual([
        'ACADEMIC_STRUCTURE',
        'CLASSES',
        'CONFIGURATION',
        'SCHOOL_SETUP',
        'STUDENTS',
        'TEACHERS',
      ]);

      expect(readCount('academic_year', 'is_current = 1')).toBe(1);
      expect(readCount('term', 'is_current = 1')).toBe(1);
      expect(readCount('school_module_config', 'is_enabled = 1')).toBe(6);
      expect(readLatestAuditAction()).toBe('SETUP_COMPLETE');
      expect(readCount('subject', 'is_active = 1')).toBe(1);
      expect(readCount('subject_group', 'is_active = 1')).toBe(1);
      expect(readCount('grading_policy', "status = 'PUBLISHED'")).toBe(1);
      expect(readCount('appreciation_scale', "status = 'PUBLISHED'")).toBe(1);

      // Simulate application restart
      await server.close();
      connection.close();

      connection = openEduTrackDatabase(dbPath);
      sqlite = connection.sqlite;
      db = connection.db;

      server = buildServer({
        databaseStatus: {
          sqlitePath: dbPath,
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

      const newAccessToken = await loginAndReadAccessToken('directeur');
      const restartedState = await injectSetupState(newAccessToken);

      expect(restartedState.data.school.setupStatus).toBe('COMPLETED');
      expect(restartedState.data.school.name).toBe('Lycee Demo N Djamena');
      expect(restartedState.data.terms).toHaveLength(3);
      expect(restartedState.data.classLevels).toHaveLength(2);
    } finally {
      try {
        await server.close();
        connection.close();
        rmSync(dbPath, { force: true });
      } catch {
        // ignore cleanup errors
      }

      // Restore dummy in-memory connection so afterEach doesn't fail
      connection = openEduTrackDatabase(':memory:');
      server = buildServer({
        databaseStatus: { sqlitePath: ':memory:', migrated: true, migrationId: 'x' },
        database: connection.db,
        logger: false,
        auth: { accessTokenSecret },
        security: { allowedOrigins: [] },
      });
    }
  });

  it('refuses to advance a module step before its prerequisites exist', async () => {
    const accessToken = await loginAndReadAccessToken('directeur');

    // No profile yet: advancing subjects is an out-of-order step.
    const tooEarly = await server.inject({
      method: 'PUT',
      url: '/setup/step',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { step: 'subjects' },
    });
    expect(tooEarly.statusCode).toBe(409);
    expect(readJson(tooEarly) as ApiError).toMatchObject({
      success: false,
      error: { code: 'INVALID_SETUP_STEP' },
    });

    await injectSetupRequest(accessToken, 'PUT', '/setup/profile', {
      name: 'Lycee Demo',
      city: 'N Djamena',
    });
    await injectSetupRequest(accessToken, 'PUT', '/setup/calendar', {
      academicYear: {
        label: '2026-2027',
        startDate: '2026-09-01',
        endDate: '2027-06-30',
      },
      termSystem: 'TRIMESTER',
      terms: [
        {
          label: 'Trimestre 1',
          termNumber: 1,
          startDate: '2026-09-01',
          endDate: '2026-12-20',
          isCurrent: true,
        },
        {
          label: 'Trimestre 2',
          termNumber: 2,
          startDate: '2027-01-05',
          endDate: '2027-03-31',
          isCurrent: false,
        },
        {
          label: 'Trimestre 3',
          termNumber: 3,
          startDate: '2027-04-01',
          endDate: '2027-06-30',
          isCurrent: false,
        },
      ],
    });
    await injectSetupRequest(accessToken, 'PUT', '/setup/class-levels', {
      classLevels: [{ code: '6e', name: 'Sixieme', displayOrder: 1, isExamYear: false }],
    });

    // No subject exists: advancing subjects is rejected with the module-step error.
    const missingData = await server.inject({
      method: 'PUT',
      url: '/setup/step',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { step: 'subjects' },
    });
    expect(missingData.statusCode).toBe(409);
    expect(readJson(missingData) as ApiError).toMatchObject({
      success: false,
      error: { code: 'MODULE_STEP_DATA_REQUIRED' },
    });

    // Skipping the subjects step to jump to grading is out of order.
    const skipped = await server.inject({
      method: 'PUT',
      url: '/setup/step',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { step: 'grading' },
    });
    expect(skipped.statusCode).toBe(409);
    expect(readJson(skipped) as ApiError).toMatchObject({
      success: false,
      error: { code: 'INVALID_SETUP_STEP' },
    });
  });

  it('denies setup access to teachers', async () => {
    const teacherAccessToken = await loginAndReadAccessToken('enseignant');
    const response = await server.inject({
      method: 'GET',
      url: '/setup/state',
      headers: {
        authorization: `Bearer ${teacherAccessToken}`,
      },
    });

    expect(response.statusCode).toBe(403);
    expect(readJson(response) as ApiError).toMatchObject({
      success: false,
      error: {
        code: 'FORBIDDEN',
      },
    });
  });

  it('isolates setup state between different schools', async () => {
    const school1Token = await loginAndReadAccessToken('directeur', 'NDS-DEMO');
    const school2Token = await loginAndReadAccessToken('directeur', 'MND-DEMO');

    // School 1 sets up profile
    await injectSetupRequest(school1Token, 'PUT', '/setup/profile', {
      name: 'School One',
      shortName: 'S1',
      city: 'City One',
    });

    // School 2 fetches state, should still be PENDING
    const school2State = await injectSetupState(school2Token);
    expect(school2State.data.school.setupStatus).toBe('PENDING');
    expect(school2State.data.school.name).not.toBe('School One');

    // School 1 fetches state, should be PROFILE_COMPLETED
    const school1State = await injectSetupState(school1Token);
    expect(school1State.data.school.setupStatus).toBe('PROFILE_COMPLETED');
    expect(school1State.data.school.name).toBe('School One');
  });

  it('rejects overlapping setup terms before persistence', async () => {
    const accessToken = await loginAndReadAccessToken('directeur');

    await injectSetupRequest(accessToken, 'PUT', '/setup/profile', {
      name: 'Lycee Demo',
      city: 'N Djamena',
    });

    const response = await server.inject({
      method: 'PUT',
      url: '/setup/calendar',
      headers: {
        authorization: `Bearer ${accessToken}`,
      },
      payload: {
        academicYear: {
          label: '2026-2027',
          startDate: '2026-09-01',
          endDate: '2027-06-30',
        },
        termSystem: 'SEMESTER',
        terms: [
          {
            label: 'Semestre 1',
            termNumber: 1,
            startDate: '2026-09-01',
            endDate: '2027-01-31',
            isCurrent: true,
          },
          {
            label: 'Semestre 2',
            termNumber: 2,
            startDate: '2027-01-15',
            endDate: '2027-06-30',
            isCurrent: false,
          },
        ],
      },
    });

    expect(response.statusCode).toBe(400);
    expect(readJson(response) as ApiError).toMatchObject({
      success: false,
      error: {
        code: 'INVALID_TERMS',
      },
    });
    expect(readCount('term')).toBe(0);
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

  async function injectSetupState(accessToken: string) {
    const response = await server.inject({
      method: 'GET',
      url: '/setup/state',
      headers: {
        authorization: `Bearer ${accessToken}`,
      },
    });

    expect(response.statusCode).toBe(200);
    return readJson(response) as ApiSuccess<SetupStateResponse>;
  }

  /** Calls a non-setup module endpoint (subjects, groups, policies, scales). */
  async function injectModuleRequest(
    accessToken: string,
    method: 'POST',
    url: string,
    payload: Record<string, unknown>
  ) {
    const response = await server.inject({
      method,
      url,
      headers: {
        authorization: `Bearer ${accessToken}`,
      },
      payload,
    });

    expect(response.statusCode).toBe(200);
    return readJson(response) as ApiSuccess<unknown>;
  }

  async function injectSetupRequest(
    accessToken: string,
    method: 'POST' | 'PUT',
    url: string,
    payload: Record<string, unknown>
  ) {
    const response = await server.inject({
      method,
      url,
      headers: {
        authorization: `Bearer ${accessToken}`,
      },
      payload,
    });

    expect(response.statusCode).toBe(200);
    return readJson(response) as ApiSuccess<SetupStateResponse>;
  }

  function readCount(
    tableName:
      | 'academic_year'
      | 'appreciation_scale'
      | 'grading_policy'
      | 'school_module_config'
      | 'subject'
      | 'subject_group'
      | 'term',
    where = '1 = 1'
  ) {
    const row = sqlite
      .prepare(`SELECT COUNT(*) AS value FROM ${tableName} WHERE ${where}`)
      .get() as {
      value: number;
    };

    return row.value;
  }

  function readLatestAuditAction() {
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

function seedSetupFixture(sqlite: Database.Database) {
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

function readJson(response: { body: string }) {
  const parsed: unknown = JSON.parse(response.body);

  return parsed;
}

function validPolicyConfig() {
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

interface ApiSuccess<T> {
  success: true;
  data: T;
}

interface ApiError {
  success: false;
  error: {
    code: string;
  };
}
