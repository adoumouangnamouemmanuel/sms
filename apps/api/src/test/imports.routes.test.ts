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
  PaginatedTeachersResponse,
} from '@edutrack/shared';
import * as XLSX from 'xlsx';
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
const accessTokenSecret = 'phase-3-imports-test-secret-with-local-only-scope';
const fixedNow = () => new Date('2026-08-15T10:00:00.000Z');

let passwordHash: string;

describe('imports routes', () => {
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
    seedImportsFixture(sqlite);
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

  it('downloads a French xlsx template with the student columns', async () => {
    const accessToken = await loginAndReadAccessToken('directeur');

    const response = await server.inject({
      method: 'GET',
      url: '/imports/templates/STUDENTS',
      headers: { authorization: `Bearer ${accessToken}` },
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toContain(
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    const workbook = XLSX.read(response.rawPayload, { type: 'buffer' });
    const dataSheet = workbook.Sheets[workbook.SheetNames[0] ?? ''];
    const rows = XLSX.utils.sheet_to_json<unknown[]>(dataSheet, { header: 1 });

    expect(rows[0]).toEqual([
      'Code',
      'Prénom',
      'Nom',
      'Sexe',
      'Date de naissance',
      'Nationalité',
      'Téléphone',
      'Email',
      'Adresse',
    ]);
    expect(workbook.SheetNames).toContain('Mode d emploi');
  });

  it('rejects a file that is not xlsx', async () => {
    const accessToken = await loginAndReadAccessToken('directeur');
    const { payload, contentType } = buildMultipart(
      studentWorkbook([[null, 'Aminata', 'Mahamat']]),
      'eleves.csv'
    );

    const response = await server.inject({
      method: 'POST',
      url: '/imports/preview/STUDENTS',
      headers: { authorization: `Bearer ${accessToken}`, 'content-type': contentType },
      payload,
    });

    expect(response.statusCode).toBe(400);
    expect(readJson(response) as ApiError).toMatchObject({
      success: false,
      error: { code: 'IMPORT_FILE_INVALID' },
    });
  });

  it('previews a workbook without persisting anything', async () => {
    const accessToken = await loginAndReadAccessToken('directeur');
    const { payload, contentType } = buildMultipart(
      studentWorkbook([
        [null, 'Aminata', 'Mahamat', 'F', '14/03/2012', 'Tchadienne', '+23566000001'],
        ['NDS-DEMO-2026-X001', 'Ibrahim', 'Ousmane', 'M'],
      ]),
      'eleves.xlsx'
    );

    const response = await server.inject({
      method: 'POST',
      url: '/imports/preview/STUDENTS',
      headers: { authorization: `Bearer ${accessToken}`, 'content-type': contentType },
      payload,
    });

    expect(response.statusCode).toBe(200);
    const body = readJson(response) as ApiSuccess<ImportPreviewResponse>;
    expect(body.data).toMatchObject({ kind: 'STUDENTS', totalRows: 2, validRows: 2, errorRows: 0 });
    expect(body.data.rows[0]).toMatchObject({
      rowNumber: 2,
      firstName: 'Aminata',
      lastName: 'Mahamat',
      errors: [],
    });
    // French dates are normalized to ISO.
    expect(body.data.rows[0]?.values.dateOfBirth).toBe('2012-03-14');
    // Preview never persists: the students table is still empty.
    expect(countRows('student')).toBe(0);
  });

  it('reports row-level French errors and duplicate codes in the preview', async () => {
    const accessToken = await loginAndReadAccessToken('directeur');
    const { payload, contentType } = buildMultipart(
      studentWorkbook([
        [null, 'Aminata', 'Mahamat', 'F'],
        [null, '', 'Ousmane'], // missing first name
        ['NDS-DEMO-2026-X002', 'Ali', 'Ahmat', 'XX'], // invalid sex
        ['NDS-DEMO-2026-X002', 'Fatime', 'Ousmane'], // duplicate code (kept after invalid sex row? no: first occurrence wins)
      ]),
      'eleves.xlsx'
    );

    const response = await server.inject({
      method: 'POST',
      url: '/imports/preview/STUDENTS',
      headers: { authorization: `Bearer ${accessToken}`, 'content-type': contentType },
      payload,
    });

    const body = readJson(response) as ApiSuccess<ImportPreviewResponse>;
    expect(body.data.validRows).toBe(1);
    expect(body.data.errorRows).toBe(3);
    const errorMessages = body.data.rows.flatMap((row) => row.errors);
    expect(errorMessages).toContain('Prénom requis.');
    expect(errorMessages).toContain('Sexe invalide (M, F ou AUTRE).');
    expect(errorMessages.some((message) => message.includes('ligne 4'))).toBe(true);
  });

  it('confirms an import, generates codes, and audits it', async () => {
    const accessToken = await loginAndReadAccessToken('directeur');
    const { payload, contentType } = buildMultipart(
      studentWorkbook([
        [null, 'Aminata', 'Mahamat', 'F', '14/03/2012'],
        [null, 'Ibrahim', 'Ousmane', 'M'],
      ]),
      'eleves.xlsx'
    );
    const previewResponse = await server.inject({
      method: 'POST',
      url: '/imports/preview/STUDENTS',
      headers: { authorization: `Bearer ${accessToken}`, 'content-type': contentType },
      payload,
    });
    const preview = (readJson(previewResponse) as ApiSuccess<ImportPreviewResponse>).data;

    const confirmResponse = await server.inject({
      method: 'POST',
      url: '/imports/confirm',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { importId: preview.importId, importIdentifier: 'rentree-2026' },
    });

    expect(confirmResponse.statusCode).toBe(200);
    expect(readJson(confirmResponse) as ApiSuccess<ConfirmImportResponse>).toMatchObject({
      success: true,
      data: { importIdentifier: 'rentree-2026', alreadyConfirmed: false, imported: 2 },
    });

    const listResponse = await server.inject({
      method: 'GET',
      url: '/students',
      headers: { authorization: `Bearer ${accessToken}` },
    });
    const list = readJson(listResponse) as ApiSuccess<PaginatedStudentsResponse>;
    expect(list.data.total).toBe(2);
    expect(list.data.items.map((student) => student.code).sort()).toEqual([
      'NDS-DEMO-2026-001',
      'NDS-DEMO-2026-002',
    ]);
    expect(findLatestAuditAction()).toBe('IMPORT_CONFIRMED');
  });

  it('is idempotent for the same import identifier', async () => {
    const accessToken = await loginAndReadAccessToken('directeur');
    const { payload, contentType } = buildMultipart(
      studentWorkbook([
        [null, 'Aminata', 'Mahamat', 'F'],
        [null, 'Ibrahim', 'Ousmane', 'M'],
      ]),
      'eleves.xlsx'
    );

    const firstPreview = await preview(accessToken, payload, contentType);
    const firstConfirm = await server.inject({
      method: 'POST',
      url: '/imports/confirm',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { importId: firstPreview.importId, importIdentifier: 'rentree-2026' },
    });
    expect((readJson(firstConfirm) as ApiSuccess<ConfirmImportResponse>).data.imported).toBe(2);

    const secondPreview = await preview(accessToken, payload, contentType);
    const secondConfirm = await server.inject({
      method: 'POST',
      url: '/imports/confirm',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { importId: secondPreview.importId, importIdentifier: 'rentree-2026' },
    });

    const secondBody = readJson(secondConfirm) as ApiSuccess<ConfirmImportResponse>;
    expect(secondBody.data).toMatchObject({
      alreadyConfirmed: true,
      imported: 0,
      skippedExisting: 2,
    });

    const listResponse = await server.inject({
      method: 'GET',
      url: '/students',
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect((readJson(listResponse) as ApiSuccess<PaginatedStudentsResponse>).data.total).toBe(2);
  });

  it('flags possible duplicates in the preview but never blocks on names', async () => {
    const accessToken = await loginAndReadAccessToken('directeur');
    const { payload, contentType } = buildMultipart(
      studentWorkbook([
        [null, 'Aminata', 'Mahamat', 'F'],
        [null, 'Ibrahim', 'Ousmane', 'M'],
      ]),
      'eleves.xlsx'
    );

    const firstPreview = await preview(accessToken, payload, contentType);
    const firstConfirm = await server.inject({
      method: 'POST',
      url: '/imports/confirm',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { importId: firstPreview.importId, importIdentifier: 'rentree-2026' },
    });
    expect((readJson(firstConfirm) as ApiSuccess<ConfirmImportResponse>).data.imported).toBe(2);

    // Same file, different identifier. The preview now warns that the names
    // already exist in the school …
    const secondPreviewData = await preview(accessToken, payload, contentType);
    expect(secondPreviewData.rows.every((row) => row.possibleDuplicate)).toBe(true);

    // … but names are NOT identity: two real people can share an exact name,
    // so confirm imports the rows anyway with fresh generated codes.
    const secondConfirm = await server.inject({
      method: 'POST',
      url: '/imports/confirm',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { importId: secondPreviewData.importId, importIdentifier: 'rentree-septembre' },
    });

    expect(readJson(secondConfirm) as ApiSuccess<ConfirmImportResponse>).toMatchObject({
      success: true,
      data: { alreadyConfirmed: false, imported: 2, skippedExisting: 0, errorRows: 0 },
    });

    const listResponse = await server.inject({
      method: 'GET',
      url: '/students',
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect((readJson(listResponse) as ApiSuccess<PaginatedStudentsResponse>).data.total).toBe(4);
  });

  it('does not block coded rows that share a name with existing students', async () => {
    const accessToken = await loginAndReadAccessToken('directeur');
    const { payload, contentType } = buildMultipart(
      studentWorkbook([
        ['NDS-DEMO-2026-A1', 'Aminata', 'Mahamat', 'F'],
        ['NDS-DEMO-2026-A2', 'Aminata', 'Mahamat', 'F'],
      ]),
      'eleves.xlsx'
    );
    const previewData = await preview(accessToken, payload, contentType);

    const confirmResponse = await server.inject({
      method: 'POST',
      url: '/imports/confirm',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { importId: previewData.importId, importIdentifier: 'jumelles-2026' },
    });

    // Names are never the sole identity when codes exist.
    expect(readJson(confirmResponse) as ApiSuccess<ConfirmImportResponse>).toMatchObject({
      success: true,
      data: { imported: 2, skippedExisting: 0, errorRows: 0 },
    });
  });

  it('skips rows whose code already exists in the school', async () => {
    const accessToken = await loginAndReadAccessToken('directeur');
    // A student with this explicit code already exists in the school.
    await server.inject({
      method: 'POST',
      url: '/students',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { code: 'NDS-DEMO-2026-X010', firstName: 'Dupont', lastName: 'Jean' },
    });

    const { payload, contentType } = buildMultipart(
      studentWorkbook([
        ['NDS-DEMO-2026-X010', 'Aminata', 'Mahamat', 'F'],
        [null, 'Ibrahim', 'Ousmane', 'M'],
      ]),
      'eleves.xlsx'
    );
    const previewData = await preview(accessToken, payload, contentType);

    const confirmResponse = await server.inject({
      method: 'POST',
      url: '/imports/confirm',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { importId: previewData.importId, importIdentifier: 'rentree-2026' },
    });

    expect(readJson(confirmResponse) as ApiSuccess<ConfirmImportResponse>).toMatchObject({
      success: true,
      data: { imported: 1, skippedExisting: 1, errorRows: 0 },
    });
  });

  it('confirms a teacher import with normalized hire dates', async () => {
    const accessToken = await loginAndReadAccessToken('directeur');
    const { payload, contentType } = buildMultipart(
      teacherWorkbook([
        [null, 'Jean', 'Nguet', 'Mathematiques', '01/09/2015'],
        ['NDS-DEMO-2026-T001', 'Fatime', 'Abakar', 'Physique', '2016-10-01'],
      ]),
      'professeurs.xlsx'
    );
    const previewData = await preview(accessToken, payload, contentType, 'TEACHERS');

    expect(previewData.kind).toBe('TEACHERS');
    expect(previewData.validRows).toBe(2);

    const confirmResponse = await server.inject({
      method: 'POST',
      url: '/imports/confirm',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { importId: previewData.importId, importIdentifier: 'professeurs-2026' },
    });

    expect((readJson(confirmResponse) as ApiSuccess<ConfirmImportResponse>).data.imported).toBe(2);

    const listResponse = await server.inject({
      method: 'GET',
      url: '/teachers',
      headers: { authorization: `Bearer ${accessToken}` },
    });
    const list = readJson(listResponse) as ApiSuccess<PaginatedTeachersResponse>;
    expect(list.data.total).toBe(2);
    const jean = list.data.items.find((teacher) => teacher.lastName === 'Nguet');
    expect(jean).toMatchObject({ specialization: 'Mathematiques', hireDate: '2015-09-01' });
  });

  it('forbids a TEACHER account from importing', async () => {
    const accessToken = await loginAndReadAccessToken('enseignant');
    const { payload, contentType } = buildMultipart(
      studentWorkbook([[null, 'Aminata', 'Mahamat']]),
      'eleves.xlsx'
    );

    const response = await server.inject({
      method: 'POST',
      url: '/imports/preview/STUDENTS',
      headers: { authorization: `Bearer ${accessToken}`, 'content-type': contentType },
      payload,
    });

    expect(response.statusCode).toBe(403);
    expect(readJson(response) as ApiError).toMatchObject({
      success: false,
      error: { code: 'FORBIDDEN' },
    });
  });

  it('isolates previews across schools', async () => {
    const accessToken = await loginAndReadAccessToken('directeur');
    const otherSchoolToken = await loginAndReadAccessToken('directeur', 'MND-DEMO');
    const { payload, contentType } = buildMultipart(
      studentWorkbook([[null, 'Aminata', 'Mahamat']]),
      'eleves.xlsx'
    );
    const previewData = await preview(accessToken, payload, contentType);

    const foreignConfirm = await server.inject({
      method: 'POST',
      url: '/imports/confirm',
      headers: { authorization: `Bearer ${otherSchoolToken}` },
      payload: { importId: previewData.importId, importIdentifier: 'rentree-2026' },
    });

    expect(foreignConfirm.statusCode).toBe(404);
    expect(readJson(foreignConfirm) as ApiError).toMatchObject({
      success: false,
      error: { code: 'IMPORT_ID_NOT_FOUND' },
    });
  });

  it('downloads rejected rows as a formula-injection-safe CSV', async () => {
    const accessToken = await loginAndReadAccessToken('directeur');
    const { payload, contentType } = buildMultipart(
      studentWorkbook([
        ['=2+2', 'Aminata', 'Mahamat'], // formula-looking code → invalid
        [null, '', 'Ousmane'], // missing first name
      ]),
      'eleves.xlsx'
    );
    const previewData = await preview(accessToken, payload, contentType);
    expect(previewData.errorRows).toBe(2);

    const response = await server.inject({
      method: 'GET',
      url: `/imports/errors/${previewData.importId}`,
      headers: { authorization: `Bearer ${accessToken}` },
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toContain('text/csv');
    const csv = response.body;
    expect(csv).toContain('Ligne;Code;Prénom;Nom;Erreurs');
    // The formula-looking code is neutralized so Excel cannot execute it.
    expect(csv).toContain("'=2+2");
    expect(csv).toContain('Prénom requis.');
  });

  async function preview(
    accessToken: string,
    payload: Buffer,
    contentType: string,
    kind = 'STUDENTS'
  ) {
    const response = await server.inject({
      method: 'POST',
      url: `/imports/preview/${kind}`,
      headers: { authorization: `Bearer ${accessToken}`, 'content-type': contentType },
      payload,
    });

    expect(response.statusCode).toBe(200);
    return (readJson(response) as ApiSuccess<ImportPreviewResponse>).data;
  }

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

  function countRows(table: string) {
    const row = sqlite.prepare(`SELECT COUNT(*) AS value FROM ${table}`).get() as {
      value: number;
    };

    return row.value;
  }
});

function seedImportsFixture(sqlite: Database.Database) {
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

function buildMultipart(buffer: Buffer, filename: string) {
  const boundary = '----vitest-imports-boundary-7d9f';
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

function teacherWorkbook(rows: (string | null)[][]) {
  const columns = [
    'Code',
    'Prénom',
    'Nom',
    'Spécialité',
    "Date d'embauche",
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

function readJson(response: { body: string }) {
  return JSON.parse(response.body) as unknown;
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
