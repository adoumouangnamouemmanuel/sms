import {
  createAuditLogRepository,
  createImportBatchRepository,
  createStudentRepository,
  createTeacherRepository,
  createTenantContext,
  withTransaction,
  type EduTrackDatabase,
} from '@edutrack/db';
import {
  IMPORT_COLUMNS_BY_KIND,
  IMPORT_KINDS,
  type ConfirmImportRequest,
  type ConfirmImportResponse,
  type ImportKind,
  type ImportPreviewResponse,
  type ImportPreviewRow,
} from '@edutrack/shared';
import * as XLSX from 'xlsx';
import type { AuthenticatedUser, RequestAuditContext } from '../auth/index.js';
import { generatePeopleCode, normalizePeopleCode } from '../people/people.codes.js';
import {
  emptyImportFile,
  importFileTooLarge,
  importPreviewNotFound,
  importsForbidden,
  invalidImportFile,
} from './imports.errors.js';
import { csvSafeCell, parseImportWorkbook, type ParsedImportRow } from './imports.parser.js';
import { IMPORT_PREVIEW_ROW_LIMIT, importPreviewStore } from './imports.preview-store.js';

export interface ImportsServiceOptions {
  now?: () => Date;
}

const MAX_IMPORT_FILE_BYTES = 10 * 1024 * 1024;
const MIN_IDENTIFIER_LENGTH = 1;
const MAX_IDENTIFIER_LENGTH = 80;

/**
 * Application service for the Phase 3.4 import slice: upload -> parse ->
 * preview -> validate -> confirm -> transact -> report. Preview state lives in
 * memory only; nothing is persisted until the user confirms, and confirming
 * the same import identifier twice is a no-op.
 */
export class ImportsService {
  private readonly now: () => Date;

  constructor(
    private readonly db: EduTrackDatabase,
    options: ImportsServiceOptions = {}
  ) {
    this.now = options.now ?? (() => new Date());
  }

  preview(actor: AuthenticatedUser, kind: ImportKind, filename: string, buffer: Buffer) {
    this.assertSchoolMaster(actor);

    if (!IMPORT_KINDS.includes(kind)) {
      throw invalidImportFile("Le type d'import est inconnu.");
    }

    if (!filename.toLowerCase().endsWith('.xlsx')) {
      throw invalidImportFile('Le fichier doit etre au format .xlsx.');
    }

    if (buffer.byteLength > MAX_IMPORT_FILE_BYTES) {
      throw importFileTooLarge();
    }

    const parsed = parseImportWorkbook(kind, buffer);

    if (parsed.fileError) {
      throw invalidImportFile(parsed.fileError);
    }

    if (parsed.rows.length === 0) {
      throw emptyImportFile();
    }

    // Advisory duplicate warnings (never blocking): a row whose code — or, for
    // uncoded rows, whose exact full name — already exists in the school. Names
    // are deliberately NOT treated as identity: two real people can share an
    // exact name, so this only flags the row for the admin to double-check.
    const tenant = createTenantContext(actor.schoolId);
    const repository =
      kind === 'STUDENTS'
        ? createStudentRepository(this.db, tenant)
        : createTeacherRepository(this.db, tenant);

    for (const row of parsed.rows) {
      if (row.errors.length > 0) {
        continue;
      }

      const explicitCode = row.values.code?.trim();
      row.possibleDuplicate = explicitCode
        ? Boolean(repository.findByCode(normalizePeopleCode(explicitCode)))
        : Boolean(repository.findByName(row.values.firstName ?? '', row.values.lastName ?? ''));
    }

    const stored = importPreviewStore.create({
      kind,
      schoolId: actor.schoolId,
      filename,
      rows: parsed.rows,
    });

    return toPreviewResponse(stored.importId, stored.filename, kind, parsed.rows);
  }

  confirm(
    actor: AuthenticatedUser,
    input: ConfirmImportRequest,
    requestContext: RequestAuditContext = {}
  ): ConfirmImportResponse {
    this.assertSchoolMaster(actor);

    const identifier = input.importIdentifier.trim();

    if (identifier.length < MIN_IDENTIFIER_LENGTH || identifier.length > MAX_IDENTIFIER_LENGTH) {
      throw invalidImportFile(
        `L'identifiant d'import doit contenir entre ${String(MIN_IDENTIFIER_LENGTH)} et ${String(MAX_IDENTIFIER_LENGTH)} caracteres.`
      );
    }

    const preview = importPreviewStore.get(input.importId);

    if (preview?.schoolId !== actor.schoolId) {
      throw importPreviewNotFound();
    }

    const tenant = createTenantContext(actor.schoolId);
    const existing = createImportBatchRepository(this.db, tenant).findBySchoolAndIdentifier(
      identifier
    );

    if (existing) {
      // Idempotent re-submission: nothing new is imported.
      return {
        importIdentifier: identifier,
        alreadyConfirmed: true,
        imported: 0,
        skippedExisting: existing.validRows,
        errorRows: 0,
      };
    }

    try {
      const report = withTransaction(this.db, (transaction) => {
        const repository =
          preview.kind === 'STUDENTS'
            ? createStudentRepository(transaction, tenant)
            : createTeacherRepository(transaction, tenant);
        const validRows = preview.rows.filter((row) => row.errors.length === 0);
        let imported = 0;
        let skippedExisting = 0;
        let errored = 0;

        for (const row of validRows) {
          const explicitCode = row.values.code?.trim();

          // Codes are the ONLY identity: a code already present in the school
          // (including archived rows) is skipped. Uncoded rows are always
          // imported — the preview already warned the admin about possible
          // name matches, because two real people can share an exact name.
          const alreadyPresent = explicitCode
            ? Boolean(repository.findByCode(normalizePeopleCode(explicitCode)))
            : false;

          if (alreadyPresent) {
            skippedExisting += 1;
            continue;
          }

          const code = explicitCode
            ? normalizePeopleCode(explicitCode)
            : generatePeopleCode(transaction, tenant, this.now, () => repository.countAll());

          try {
            if (preview.kind === 'STUDENTS') {
              repository.create(toStudentCreateInput(row, code));
            } else {
              repository.create(toTeacherCreateInput(row, code));
            }

            imported += 1;
          } catch (error) {
            if (isUniqueConstraintViolation(error)) {
              skippedExisting += 1;
            } else {
              errored += 1;
            }
          }
        }

        const batch = createImportBatchRepository(transaction, tenant).create({
          kind: preview.kind,
          importIdentifier: identifier,
          filename: preview.filename,
          totalRows: preview.rows.length,
          validRows: imported + skippedExisting,
          errorRows: errored,
        });

        createAuditLogRepository(transaction, tenant).createEvent({
          actorUserId: actor.id,
          action: 'IMPORT_CONFIRMED',
          targetType: 'import_batch',
          targetId: batch.id,
          correlationId: requestContext.correlationId ?? null,
          metadata: {
            importIdentifier: identifier,
            kind: preview.kind,
            filename: preview.filename,
            imported,
            skippedExisting,
            errorRows: errored,
          },
        });

        return { imported, skippedExisting, errorRows: errored };
      });

      return { importIdentifier: identifier, alreadyConfirmed: false, ...report };
    } catch (error) {
      if (isUniqueConstraintViolation(error)) {
        // A concurrent confirm with the same identifier won the race.
        return {
          importIdentifier: identifier,
          alreadyConfirmed: true,
          imported: 0,
          skippedExisting: 0,
          errorRows: 0,
        };
      }

      throw error;
    }
  }

  /** Generates the French .xlsx template for the given kind (headers + README). */
  template(kind: ImportKind): Buffer {
    const columns = IMPORT_COLUMNS_BY_KIND[kind];
    const workbook = XLSX.utils.book_new();
    const dataSheet = XLSX.utils.aoa_to_sheet([columns.map((column) => column.label)]);
    dataSheet['!cols'] = columns.map((column) => ({ wch: Math.max(column.label.length + 4, 18) }));
    XLSX.utils.book_append_sheet(workbook, dataSheet, 'Donnees');

    const readmeRows: (string | number)[][] = [
      ['Colonne', 'Requis', 'Description'],
      ...columns.map((column) => [
        column.label,
        column.required ? 'Oui' : 'Non',
        column.description,
      ]),
      [],
      ['Remarques'],
      ['- Ne modifiez pas la premiere ligne : elle contient les en-tetes.'],
      [
        '- Ajoutez une ligne par eleve (ou professeur) a partir de la ligne 2 ; les lignes vides sont ignorees.',
      ],
      ["- Les dates s'ecrivent JJ/MM/AAAA (ex. 14/03/2012) ou AAAA-MM-JJ (ex. 2012-03-14)."],
      ['- Sexe : M, F ou AUTRE.'],
      ['- Code : optionnel. Laisses vide, un code est genere automatiquement.'],
      ["- Un code utilise deux fois dans le fichier (ou deja present dans l'ecole) est refuse."],
      ["- Ligne d'exemple : voir la feuille « Exemples » (non importee)."],
    ];
    const readmeSheet = XLSX.utils.aoa_to_sheet(readmeRows);
    readmeSheet['!cols'] = [{ wch: 24 }, { wch: 10 }, { wch: 90 }];
    XLSX.utils.book_append_sheet(workbook, readmeSheet, 'Mode d emploi');

    if (kind === 'STUDENTS') {
      const examplesSheet = XLSX.utils.aoa_to_sheet([
        columns.map((column) => column.label),
        [
          null,
          'Aminata',
          'Mahamat',
          'F',
          '14/03/2012',
          'Tchadienne',
          '+23566000001',
          'aminata.mahamat@exemple.td',
          'N Djamena',
        ],
        [
          'NDS-DEMO-2026-X00001',
          'Ibrahim',
          'Ousmane',
          'M',
          '2010-11-02',
          'Tchadienne',
          '+23566000002',
          null,
          null,
        ],
      ]);
      examplesSheet['!cols'] = dataSheet['!cols'];
      XLSX.utils.book_append_sheet(workbook, examplesSheet, 'Exemples');
    } else {
      const examplesSheet = XLSX.utils.aoa_to_sheet([
        columns.map((column) => column.label),
        [
          null,
          'Jean',
          'Nguet',
          'Mathematiques',
          '01/09/2015',
          '+23566000010',
          'j.nguet@exemple.td',
          null,
        ],
        [
          'NDS-DEMO-2026-T00001',
          'Fatime',
          'Abakar',
          'Physique',
          '2016-10-01',
          '+23566000011',
          null,
          null,
        ],
      ]);
      examplesSheet['!cols'] = dataSheet['!cols'];
      XLSX.utils.book_append_sheet(workbook, examplesSheet, 'Exemples');
    }

    return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
  }

  /** CSV of rejected rows for the given preview, with formula-injection protection. */
  errorsCsv(actor: AuthenticatedUser, importId: string): string {
    this.assertSchoolMaster(actor);
    const preview = importPreviewStore.get(importId);

    if (preview?.schoolId !== actor.schoolId) {
      throw importPreviewNotFound();
    }

    const errorRows = preview.rows.filter((row) => row.errors.length > 0);
    const header = ['Ligne', 'Code', 'Prénom', 'Nom', 'Erreurs'];
    const lines = [
      header,
      ...errorRows.map((row) => [
        row.rowNumber,
        row.values.code ?? '',
        row.values.firstName ?? '',
        row.values.lastName ?? '',
        row.errors.join(' ; '),
      ]),
    ];

    return lines.map((cells) => cells.map(csvSafeCell).join(';')).join('\r\n');
  }

  private assertSchoolMaster(actor: AuthenticatedUser) {
    if (actor.role !== 'SCHOOL_MASTER') {
      throw importsForbidden();
    }
  }
}

function toPreviewResponse(
  importId: string,
  filename: string,
  kind: ImportKind,
  rows: ParsedImportRow[]
): ImportPreviewResponse {
  const validRows = rows.filter((row) => row.errors.length === 0).length;

  return {
    importId,
    kind,
    filename,
    totalRows: rows.length,
    validRows,
    errorRows: rows.length - validRows,
    rows: rows.slice(0, IMPORT_PREVIEW_ROW_LIMIT).map(toPreviewRow),
  };
}

function toPreviewRow(row: ParsedImportRow): ImportPreviewRow {
  return {
    rowNumber: row.rowNumber,
    code: row.values.code ?? null,
    firstName: row.values.firstName ?? '',
    lastName: row.values.lastName ?? '',
    values: row.values,
    errors: row.errors,
    possibleDuplicate: row.possibleDuplicate,
  };
}

function toStudentCreateInput(row: ParsedImportRow, code: string) {
  return {
    code,
    firstName: row.values.firstName ?? '',
    lastName: row.values.lastName ?? '',
    sex: (row.values.sex as 'M' | 'F' | 'AUTRE' | null) ?? null,
    dateOfBirth: row.values.dateOfBirth ?? null,
    nationality: row.values.nationality ?? null,
    phone: row.values.phone ?? null,
    email: row.values.email ?? null,
    address: row.values.address ?? null,
  };
}

function toTeacherCreateInput(row: ParsedImportRow, code: string) {
  return {
    code,
    firstName: row.values.firstName ?? '',
    lastName: row.values.lastName ?? '',
    specialization: row.values.specialization ?? null,
    hireDate: row.values.hireDate ?? null,
    phone: row.values.phone ?? null,
    email: row.values.email ?? null,
    address: row.values.address ?? null,
  };
}

function isUniqueConstraintViolation(error: unknown) {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === 'SQLITE_CONSTRAINT_UNIQUE'
  );
}
