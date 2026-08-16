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
const accessTokenSecret = 'phase-4-imports-test-secret-with-local-only-scope';
const fixedNow = () => new Date('2026-08-15T10:00:00.000Z');

const academicYearId = '00000000-0000-4000-8000-00000000a001';
const levelSixId = '00000000-0000-4000-8000-00000000a101';
const classroomSixA = '00000000-0000-4000-8000-00000000a401';
const subjectMathId = '00000000-0000-4000-8000-00000000a501';
const teacherOneId = '00000000-0000-4000-8000-00000000a301';

let passwordHash: string;

describe('classes imports', () => {
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
    seedFixture(sqlite);
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

  it('downloads the SUBJECTS, CLASSROOMS and CLASS_SUBJECTS templates with the right columns', async () => {
    const accessToken = await loginAndReadAccessToken('directeur');
    const cases = [
      ['SUBJECTS', ['Code', 'Nom', 'Nom (anglais)', 'Nom (arabe)', 'Libellé court', 'Catégorie']],
      ['CLASSROOMS', ['Année scolaire', 'Code niveau', 'Code classe', 'Nom', 'Capacité']],
      [
        'CLASS_SUBJECTS',
        ['Code classe', 'Code matière', 'Coefficient', 'Obligatoire', 'Code professeur'],
      ],
    ] as const;

    for (const [kind, expectedHeaders] of cases) {
      const response = await server.inject({
        method: 'GET',
        url: `/imports/templates/${kind}`,
        headers: { authorization: `Bearer ${accessToken}` },
      });
      expect(response.statusCode).toBe(200);
      const workbook = XLSX.read(response.rawPayload, { type: 'buffer' });
      const dataSheet = workbook.Sheets.Donnees;
      const headers = dataSheet
        ? (XLSX.utils.sheet_to_json<unknown[]>(dataSheet, { header: 1 })[0] ?? [])
        : [];
      expect(headers).toEqual(expectedHeaders);
    }
  });

  it('previews and confirms a SUBJECTS import, skipping duplicate codes', async () => {
    const accessToken = await loginAndReadAccessToken('directeur');
    const { payload, contentType } = buildMultipart(
      subjectWorkbook([
        ['GEO', 'Géographie', null, null, null, 'SCIENCES_SOCIALES'],
        ['MATH', 'Mathématiques bis', null, null, null, 'MATHEMATIQUES'],
        ['EPS', 'Éducation physique', null, null, null, 'SPORTS'],
      ]),
      'matieres.xlsx'
    );

    const previewData = await preview(accessToken, payload, contentType, 'SUBJECTS');
    expect(previewData).toMatchObject({
      kind: 'SUBJECTS',
      totalRows: 3,
      validRows: 3,
      errorRows: 0,
    });

    const confirmResponse = await server.inject({
      method: 'POST',
      url: '/imports/confirm',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { importId: previewData.importId, importIdentifier: 'matieres-1' },
    });
    expect((readJson(confirmResponse) as ApiSuccess<ConfirmImportResponse>).data).toMatchObject({
      alreadyConfirmed: false,
      imported: 2,
      // MATH already exists in the school (fixture) - skipped, never duplicated.
      skippedExisting: 1,
    });

    // A second import of the same codes is idempotent: all skipped.
    const secondPreview = await preview(accessToken, payload, contentType, 'SUBJECTS');
    const second = await server.inject({
      method: 'POST',
      url: '/imports/confirm',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { importId: secondPreview.importId, importIdentifier: 'matieres-2' },
    });
    expect((readJson(second) as ApiSuccess<ConfirmImportResponse>).data).toMatchObject({
      imported: 0,
      skippedExisting: 3,
    });
    expect(countRows('subject')).toBe(3);
  });

  it('rejects invalid SUBJECTS rows at preview with French errors', async () => {
    const accessToken = await loginAndReadAccessToken('directeur');
    const { payload, contentType } = buildMultipart(
      subjectWorkbook([
        ['', 'Sans code', null, null, null, 'AUTRE'], // missing code
        ['XYZ', 'Sans categorie', null, null, null, 'INCONNUE'], // invalid category
      ]),
      'matieres.xlsx'
    );

    const previewData = await preview(accessToken, payload, contentType, 'SUBJECTS');
    expect(previewData).toMatchObject({ totalRows: 2, validRows: 0, errorRows: 2 });
    expect(previewData.rows[0]?.errors.join()).toContain('Code requis');
    expect(previewData.rows[1]?.errors.join()).toContain('Catégorie invalide');
  });

  it('previews and confirms a CLASSROOMS import, rejecting unknown years and levels', async () => {
    const accessToken = await loginAndReadAccessToken('directeur');
    const { payload, contentType } = buildMultipart(
      classroomWorkbook([
        ['2026-2027', '6E', '6E-A', '6e A', 45],
        ['2026-2027', '6E', '6E-B', null, null],
        ['1999-2000', '6E', '6E-X', null, null], // unknown year → error
        ['2026-2027', 'ZZ', '6E-Y', null, null], // unknown level → error
      ]),
      'classes.xlsx'
    );

    const previewData = await preview(accessToken, payload, contentType, 'CLASSROOMS');
    expect(previewData).toMatchObject({
      kind: 'CLASSROOMS',
      totalRows: 4,
      validRows: 2,
      errorRows: 2,
    });
    expect(previewData.rows[2]?.errors).toEqual(['Année scolaire inconnue dans cette école.']);
    expect(previewData.rows[3]?.errors).toEqual(['Code niveau inconnu dans cette école.']);

    const confirmResponse = await server.inject({
      method: 'POST',
      url: '/imports/confirm',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { importId: previewData.importId, importIdentifier: 'classes-1' },
    });
    expect((readJson(confirmResponse) as ApiSuccess<ConfirmImportResponse>).data).toMatchObject({
      // 6E-A already exists in the school (fixture) - skipped, never duplicated.
      imported: 1,
      skippedExisting: 1,
    });
    expect(countRows('classroom')).toBe(2); // seeded 6E-A + imported 6E-B
  });

  it('previews and confirms a CLASS_SUBJECTS import with lookups and duplicate skip', async () => {
    const accessToken = await loginAndReadAccessToken('directeur');
    const { payload, contentType } = buildMultipart(
      classSubjectWorkbook([
        ['6E-A', 'MATH', 4, 'OUI', 'NDS-DEMO-2026-T00001'],
        ['6E-A', 'MATH', 2, 'NON', null], // duplicate pair → skipped at confirm
        ['6E-A', 'INCONNU', 3, 'OUI', null], // unknown subject → preview error
      ]),
      'affectations.xlsx'
    );

    const previewData = await preview(accessToken, payload, contentType, 'CLASS_SUBJECTS');
    expect(previewData).toMatchObject({
      kind: 'CLASS_SUBJECTS',
      totalRows: 3,
      validRows: 2,
      errorRows: 1,
    });
    expect(previewData.rows[2]?.errors).toEqual(['Code matière inconnu dans cette école.']);

    const confirmResponse = await server.inject({
      method: 'POST',
      url: '/imports/confirm',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { importId: previewData.importId, importIdentifier: 'affectations-1' },
    });
    expect((readJson(confirmResponse) as ApiSuccess<ConfirmImportResponse>).data).toMatchObject({
      imported: 1,
      skippedExisting: 1,
    });

    const row = sqlite
      .prepare(
        `
          SELECT cs.coefficient AS coefficient, cs.is_required AS isRequired, cs.teacher_id AS teacherId
          FROM class_subject cs
          WHERE cs.school_id = ? AND cs.subject_id = ?
        `
      )
      .get(firstSchoolId, subjectMathId) as
      { coefficient: number; isRequired: number; teacherId: string } | undefined;
    expect(row?.coefficient).toBe(4);
    expect(row?.isRequired).toBe(1);
    expect(row?.teacherId).toBe(teacherOneId);
  });

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  async function preview(
    accessToken: string,
    payload: Buffer,
    contentType: string,
    kind: 'SUBJECTS' | 'CLASSROOMS' | 'CLASS_SUBJECTS'
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

  function countRows(table: 'subject' | 'classroom' | 'class_subject') {
    const row = sqlite
      .prepare(`SELECT COUNT(*) AS value FROM ${table} WHERE school_id = ?`)
      .get(firstSchoolId) as { value: number };

    return row.value;
  }
});

function seedFixture(sqlite: Database.Database) {
  sqlite
    .prepare(
      `
        UPDATE user
        SET password_hash = ?, failed_login_attempts = 0, locked_until = NULL
        WHERE id = ?
      `
    )
    .run(passwordHash, schoolMasterId);

  sqlite
    .prepare(
      `
        INSERT INTO academic_year (id, school_id, label, start_date, end_date, is_current)
        VALUES (?, ?, ?, ?, ?, 1)
      `
    )
    .run(academicYearId, firstSchoolId, '2026-2027', '2026-09-01', '2027-06-30');

  sqlite
    .prepare(
      `
        INSERT INTO class_level (id, school_id, code, name, display_order)
        VALUES (?, ?, ?, ?, ?)
      `
    )
    .run(levelSixId, firstSchoolId, '6E', 'Sixième', 1);

  sqlite
    .prepare(
      `
        INSERT INTO classroom (id, school_id, academic_year_id, class_level_id, code, name)
        VALUES (?, ?, ?, ?, ?, ?)
      `
    )
    .run(classroomSixA, firstSchoolId, academicYearId, levelSixId, '6E-A', '6e A');

  sqlite
    .prepare(
      `
        INSERT INTO subject (id, school_id, code, name, category)
        VALUES (?, ?, ?, ?, ?)
      `
    )
    .run(subjectMathId, firstSchoolId, 'MATH', 'Mathématiques', 'MATHEMATIQUES');

  sqlite
    .prepare(
      `
        INSERT INTO teacher (id, school_id, code, first_name, last_name)
        VALUES (?, ?, ?, ?, ?)
      `
    )
    .run(teacherOneId, firstSchoolId, 'NDS-DEMO-2026-T00001', 'Jean', 'Nguet');
}

function buildMultipart(buffer: Buffer, filename: string) {
  const boundary = '----vitest-classes-imports-boundary-7d9f';
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

function subjectWorkbook(rows: (string | number | null)[][]) {
  const columns = ['Code', 'Nom', 'Nom (anglais)', 'Nom (arabe)', 'Libellé court', 'Catégorie'];
  return workbookBuffer(columns, rows);
}

function classroomWorkbook(rows: (string | number | null)[][]) {
  const columns = ['Année scolaire', 'Code niveau', 'Code classe', 'Nom', 'Capacité'];
  return workbookBuffer(columns, rows);
}

function classSubjectWorkbook(rows: (string | number | null)[][]) {
  const columns = ['Code classe', 'Code matière', 'Coefficient', 'Obligatoire', 'Code professeur'];
  return workbookBuffer(columns, rows);
}

function workbookBuffer(columns: string[], rows: (string | number | null)[][]) {
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
    const migrationSql = readFileSync(join(migrationsDir, migrationFile), 'utf8');
    sqlite.exec(migrationSql.replaceAll('--> statement-breakpoint', '\n'));
  }
}

interface ApiSuccess<T> {
  success: true;
  data: T;
}
