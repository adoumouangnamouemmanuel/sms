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
  AuthTokenResponse,
  ConfirmImportResponse,
  ImportPreviewResponse,
  PaginatedStudentsResponse,
} from '@edutrack/shared';
import * as XLSX from 'xlsx';
import { buildServer } from '../server.js';
import { hashPassword } from '../modules/auth/index.js';

const migrationsDir = fileURLToPath(
  new URL('../../../../packages/db/migrations/sqlite/', import.meta.url)
);
const firstSchoolId = '00000000-0000-4000-8000-000000000101';
const schoolMasterId = '00000000-0000-4000-8000-000000000201';
const correctPassword = 'correct-password';
const accessTokenSecret = 'phase-3-gate-test-secret-with-local-only-scope';
const fixedNow = () => new Date('2026-08-15T10:00:00.000Z');

// Phase 3 §9.5 gate fixture: 1,000 representative student rows.
//  - 300 explicit codes (NDS-DEMO-2026-E0001..E0300)
//  - 680 blank-code rows, including 10 pairs with identical first+last names
//  - 20 invalid rows (missing first name / invalid sex) to prove rejection
//    never corrupts the valid rows
const TOTAL_ROWS = 1000;
const EXPLICIT_CODES = 300;
const DUPLICATE_NAME_PAIRS = 10;
const INVALID_ROWS = 20;
const VALID_ROWS = TOTAL_ROWS - INVALID_ROWS;

const FIRST_NAMES = [
  'Aminata',
  'Ibrahim',
  'Fatime',
  'Mahamat',
  'Aicha',
  'Ali',
  'Hawa',
  'Ousmane',
  'Khadidja',
  'Abakar',
  'Mariam',
  'Brahim',
  'Halime',
  'Issa',
  'Zara',
  'Adoum',
] as const;
const LAST_NAMES = [
  'Mahamat',
  'Abakar',
  'Ousmane',
  'Issa',
  'Brahim',
  'Ahmat',
  'Djaou',
  'Nguet',
  'Nadjita',
  'Adam',
  'Saleh',
  'Kodjim',
] as const;
const SEXES = ['M', 'F', 'AUTRE'] as const;

let passwordHash: string;

describe('Phase 3 §9.5 gate', () => {
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
    seedGateFixture(sqlite);
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

  it('imports 1,000 rows without duplicate creation or partial corruption', async () => {
    const accessToken = await loginAndReadAccessToken('directeur');
    const workbook = buildGateWorkbook();

    const previewResponse = await server.inject({
      method: 'POST',
      url: '/imports/preview/STUDENTS',
      headers: { authorization: `Bearer ${accessToken}`, 'content-type': workbook.contentType },
      payload: workbook.payload,
    });

    expect(previewResponse.statusCode).toBe(200);
    const preview = (readJson(previewResponse) as ApiSuccess<ImportPreviewResponse>).data;
    expect(preview).toMatchObject({
      totalRows: TOTAL_ROWS,
      validRows: VALID_ROWS,
      errorRows: INVALID_ROWS,
    });

    const confirmResponse = await server.inject({
      method: 'POST',
      url: '/imports/confirm',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { importId: preview.importId, importIdentifier: 'gate-1000-rows' },
    });

    expect(confirmResponse.statusCode).toBe(200);
    expect(readJson(confirmResponse) as ApiSuccess<ConfirmImportResponse>).toMatchObject({
      success: true,
      data: {
        alreadyConfirmed: false,
        imported: VALID_ROWS,
        skippedExisting: 0,
        errorRows: 0,
      },
    });

    // Every valid row was persisted — nothing was lost or partially written.
    expect(countRows('student')).toBe(VALID_ROWS);

    // No two students share a code (explicit or generated) within the school.
    expect(duplicateCodeRows()).toBe(0);

    // Every created row has a code plus both names — no partial records.
    const incomplete = sqlite
      .prepare(
        `SELECT COUNT(*) AS value
         FROM student
         WHERE school_id = ? AND (code IS NULL OR TRIM(first_name) = '' OR TRIM(last_name) = '')`
      )
      .get(firstSchoolId) as { value: number };
    expect(incomplete.value).toBe(0);

    // The 300 explicit codes were kept verbatim.
    const explicitCodes = sqlite
      .prepare(
        `SELECT COUNT(*) AS value FROM student WHERE school_id = ? AND code LIKE 'NDS-DEMO-2026-E%'`
      )
      .get(firstSchoolId) as { value: number };
    expect(explicitCodes.value).toBe(EXPLICIT_CODES);

    // Generated codes follow the {school}-{year}-{NNI} pattern.
    const malformedGeneratedCodes = sqlite
      .prepare(
        `SELECT COUNT(*) AS value
         FROM student
         WHERE school_id = ?
           AND code LIKE 'NDS-DEMO-2026-%'
           AND code NOT LIKE 'NDS-DEMO-2026-E%'
           AND code NOT GLOB 'NDS-DEMO-2026-[0-9][0-9][0-9]*'`
      )
      .get(firstSchoolId) as { value: number };
    expect(malformedGeneratedCodes.value).toBe(0);

    // The list endpoint agrees with the raw count.
    const listResponse = await server.inject({
      method: 'GET',
      url: '/students?limit=1',
      headers: { authorization: `Bearer ${accessToken}` },
    });
    const list = readJson(listResponse) as ApiSuccess<PaginatedStudentsResponse>;
    expect(list.data.total).toBe(VALID_ROWS);
  });

  it('reimporting the same confirmed file is a clearly reported no-op', async () => {
    const accessToken = await loginAndReadAccessToken('directeur');
    const workbook = buildGateWorkbook();

    const firstPreview = await preview(accessToken, workbook);
    const firstConfirm = await server.inject({
      method: 'POST',
      url: '/imports/confirm',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { importId: firstPreview.importId, importIdentifier: 'gate-reimport' },
    });
    expect((readJson(firstConfirm) as ApiSuccess<ConfirmImportResponse>).data.imported).toBe(
      VALID_ROWS
    );

    // Same file, same identifier: nothing new is imported and the report says so.
    const secondPreview = await preview(accessToken, workbook);
    const secondConfirm = await server.inject({
      method: 'POST',
      url: '/imports/confirm',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { importId: secondPreview.importId, importIdentifier: 'gate-reimport' },
    });

    expect(readJson(secondConfirm) as ApiSuccess<ConfirmImportResponse>).toMatchObject({
      success: true,
      data: { alreadyConfirmed: true, imported: 0, skippedExisting: VALID_ROWS },
    });
    expect(countRows('student')).toBe(VALID_ROWS);
  });

  it('keeps duplicate names valid and distinguishable by code', async () => {
    const accessToken = await loginAndReadAccessToken('directeur');
    const rows: (string | null)[][] = [
      ['NDS-DEMO-2026-D1', 'Aminata', 'Mahamat', 'F'],
      ['NDS-DEMO-2026-D2', 'Aminata', 'Mahamat', 'F'],
      [null, 'Fatime', 'Abakar', 'F'],
      [null, 'Fatime', 'Abakar', 'F'],
    ];
    const workbook = buildMultipart(studentWorkbook(rows), 'jumelles.xlsx');
    const previewData = await preview(accessToken, workbook);

    const confirmResponse = await server.inject({
      method: 'POST',
      url: '/imports/confirm',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { importId: previewData.importId, importIdentifier: 'doublons-noms' },
    });
    expect((readJson(confirmResponse) as ApiSuccess<ConfirmImportResponse>).data.imported).toBe(4);

    const students = sqlite
      .prepare(
        `SELECT code, first_name, last_name
         FROM student
         WHERE school_id = ? AND first_name = 'Aminata' AND last_name = 'Mahamat'
         ORDER BY code`
      )
      .all(firstSchoolId) as { code: string; first_name: string; last_name: string }[];

    expect(students).toHaveLength(2);
    expect(students.map((student) => student.code)).toEqual([
      'NDS-DEMO-2026-D1',
      'NDS-DEMO-2026-D2',
    ]);
  });

  async function preview(accessToken: string, workbook: { payload: Buffer; contentType: string }) {
    const response = await server.inject({
      method: 'POST',
      url: '/imports/preview/STUDENTS',
      headers: { authorization: `Bearer ${accessToken}`, 'content-type': workbook.contentType },
      payload: workbook.payload,
    });

    expect(response.statusCode).toBe(200);
    return (readJson(response) as ApiSuccess<ImportPreviewResponse>).data;
  }

  async function loginAndReadAccessToken(username: string) {
    const response = await server.inject({
      method: 'POST',
      url: '/auth/login',
      payload: {
        schoolCode: 'NDS-DEMO',
        username,
        password: correctPassword,
        deviceName: 'Vitest',
      },
    });

    expect(response.statusCode).toBe(200);
    return (readJson(response) as ApiSuccess<AuthTokenResponse>).data.accessToken;
  }

  function countRows(table: string) {
    const row = sqlite.prepare(`SELECT COUNT(*) AS value FROM ${table}`).get() as {
      value: number;
    };
    return row.value;
  }

  function duplicateCodeRows() {
    const row = sqlite
      .prepare(
        `SELECT COUNT(*) AS value
         FROM (SELECT code FROM student WHERE school_id = ? GROUP BY code HAVING COUNT(*) > 1)`
      )
      .get(firstSchoolId) as { value: number };
    return row.value;
  }
});

// ---------------------------------------------------------------------------
// Fixture builders
// ---------------------------------------------------------------------------

/** Deterministic pseudo-random generator so the 1,000 rows are reproducible. */
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function buildGateWorkbook() {
  const random = mulberry32(9_5);
  const rows: (string | null)[][] = [];

  // 300 explicit codes.
  for (let index = 0; index < EXPLICIT_CODES; index += 1) {
    rows.push([
      `NDS-DEMO-2026-E${String(index + 1).padStart(4, '0')}`,
      pick(FIRST_NAMES, random),
      pick(LAST_NAMES, random),
      pick(SEXES, random),
      randomDate(random),
      pick(NATIONALITIES, random),
    ]);
  }

  // 10 pairs of identical names (20 rows) with blank codes.
  for (let pair = 0; pair < DUPLICATE_NAME_PAIRS; pair += 1) {
    const firstName = pick(FIRST_NAMES, random);
    const lastName = pick(LAST_NAMES, random);
    rows.push([null, firstName, lastName, pick(SEXES, random)]);
    rows.push([null, firstName, lastName, pick(SEXES, random)]);
  }

  // Remaining blank-code rows (680 - 20 = 660).
  const remaining = TOTAL_ROWS - EXPLICIT_CODES - DUPLICATE_NAME_PAIRS * 2 - INVALID_ROWS;
  for (let index = 0; index < remaining; index += 1) {
    rows.push([
      null,
      pick(FIRST_NAMES, random),
      pick(LAST_NAMES, random),
      pick(SEXES, random),
      randomDate(random),
    ]);
  }

  // 20 invalid rows — 10 missing first names, 10 invalid sexes.
  for (let index = 0; index < 10; index += 1) {
    rows.push([null, '', pick(LAST_NAMES, random), pick(SEXES, random)]);
    rows.push([null, pick(FIRST_NAMES, random), pick(LAST_NAMES, random), 'XX']);
  }

  expect(rows).toHaveLength(TOTAL_ROWS);
  return buildMultipart(studentWorkbook(rows), 'gate-1000-eleves.xlsx');
}

const NATIONALITIES = [
  'Tchadienne',
  'Camerounaise',
  'Soudanaise',
  'Nigérienne',
  'Centrafricaine',
  'Sénégalaise',
] as const;

function pick<T>(values: readonly T[], random: () => number): T {
  return values[Math.floor(random() * values.length)] ?? values[0];
}

function randomDate(random: () => number) {
  const day = 1 + Math.floor(random() * 28);
  const month = 1 + Math.floor(random() * 12);
  const year = 2006 + Math.floor(random() * 10);
  return `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${String(year)}`;
}

function studentWorkbook(rows: (string | null)[][]) {
  const columns = [
    'Code',
    'Prénom',
    'Nom',
    'Sexe',
    'Date de naissance',
    'Nationalité',
    'Téléphone',
    'Email',
    'Adresse',
  ];
  return workbookBuffer(columns, rows);
}

function workbookBuffer(columns: string[], rows: (string | null)[][]) {
  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.aoa_to_sheet([columns, ...rows]);
  XLSX.utils.book_append_sheet(workbook, sheet, 'Donnees');

  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}

function buildMultipart(buffer: Buffer, filename: string) {
  const boundary = '----vitest-gate-boundary-9d8e';
  const head = Buffer.from(
    `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="file"; filename="${filename}"\r\n` +
      'Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet\r\n' +
      '\r\n'
  );
  const tail = Buffer.from(`\r\n--${boundary}--\r\n`);

  return {
    payload: Buffer.concat([head, buffer, tail]),
    contentType: `multipart/form-data; boundary=${boundary}`,
  };
}

function seedGateFixture(sqlite: Database.Database) {
  sqlite
    .prepare(
      `
        UPDATE user
        SET password_hash = ?, failed_login_attempts = 0, locked_until = NULL
        WHERE id = ?
      `
    )
    .run(passwordHash, schoolMasterId);
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

function readJson(response: { body: string }) {
  return JSON.parse(response.body) as unknown;
}

interface ApiSuccess<T> {
  success: true;
  data: T;
}
