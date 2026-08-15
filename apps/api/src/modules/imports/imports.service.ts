import {
  createAcademicYearRepository,
  createAuditLogRepository,
  createClassLevelRepository,
  createClassroomRepository,
  createClassSubjectRepository,
  createGuardianRepository,
  createImportBatchRepository,
  createStudentGuardianRepository,
  createStudentRepository,
  createSubjectRepository,
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
  type SubjectCategory,
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

    // Advisory duplicate warnings (never blocking): a row whose code - or, for
    // uncoded rows, whose exact full name - already exists in the school. Names
    // are deliberately NOT treated as identity: two real people can share an
    // exact name, so this only flags the row for the admin to double-check.
    const tenant = createTenantContext(actor.schoolId);

    for (const row of parsed.rows) {
      if (row.errors.length > 0) {
        continue;
      }

      const explicitCode = row.values.code?.trim();

      if (kind === 'GUARDIANS') {
        // Guardians carry no code, so only the advisory name check applies.
        const repository = createGuardianRepository(this.db, tenant);
        row.possibleDuplicate = Boolean(
          repository.findByName(row.values.firstName ?? '', row.values.lastName ?? '')
        );

        // Optional student code: when present, the guardian is auto-linked to
        // the matching student at confirm. An unknown code is a hard row error
        // - the admin explicitly asked for a link that cannot exist.
        const studentCode = row.values.studentCode?.trim();

        if (studentCode) {
          const student = createStudentRepository(this.db, tenant).findByCode(
            normalizePeopleCode(studentCode)
          );

          if (!student) {
            row.errors.push('Code élève inconnu dans cette école.');
          } else {
            row.linkedStudentId = student.id;
          }
        }

        continue;
      }

      if (kind === 'STUDENTS' || kind === 'TEACHERS') {
        const repository =
          kind === 'STUDENTS'
            ? createStudentRepository(this.db, tenant)
            : createTeacherRepository(this.db, tenant);
        row.possibleDuplicate = explicitCode
          ? Boolean(repository.findByCode(normalizePeopleCode(explicitCode)))
          : Boolean(repository.findByName(row.values.firstName ?? '', row.values.lastName ?? ''));
        continue;
      }

      if (kind === 'SUBJECTS') {
        row.possibleDuplicate = Boolean(
          createSubjectRepository(this.db, tenant).findByCode((explicitCode ?? '').toUpperCase())
        );
        continue;
      }

      if (kind === 'CLASSROOMS') {
        const yearLabel = row.values.academicYearLabel?.trim();
        const levelCode = row.values.classLevelCode?.trim();
        const year = yearLabel
          ? createAcademicYearRepository(this.db, tenant).findActiveByLabel(yearLabel)
          : null;
        const level = levelCode
          ? createClassLevelRepository(this.db, tenant)
              .listActive()
              .find((item) => item.code.toUpperCase() === levelCode.toUpperCase())
          : null;

        if (yearLabel && !year) {
          row.errors.push('Année scolaire inconnue dans cette école.');
        } else if (levelCode && !level) {
          row.errors.push('Code niveau inconnu dans cette école.');
        } else if (year && level) {
          row.linkedAcademicYearId = year.id;
          row.linkedClassLevelId = level.id;
          row.possibleDuplicate = Boolean(
            createClassroomRepository(this.db, tenant).findByYearCode(
              year.id,
              (explicitCode ?? '').toUpperCase()
            )
          );
        }

        continue;
      }

      // All earlier guards continued, so `kind` is CLASS_SUBJECTS here.
      {
        const currentYear = createAcademicYearRepository(this.db, tenant).findCurrent();
        const classroom = currentYear
          ? createClassroomRepository(this.db, tenant).findByYearCode(
              currentYear.id,
              (row.values.classroomCode?.trim() ?? '').toUpperCase()
            )
          : null;
        const subject = createSubjectRepository(this.db, tenant).findByCode(
          (row.values.subjectCode?.trim() ?? '').toUpperCase()
        );
        const teacherCode = row.values.teacherCode?.trim();
        const teacher = teacherCode
          ? createTeacherRepository(this.db, tenant).findByCode(normalizePeopleCode(teacherCode))
          : null;

        if (!currentYear) {
          row.errors.push('Aucune année scolaire active dans cette école.');
        } else if (!classroom) {
          row.errors.push("Code classe inconnu dans l'année active.");
        } else if (!subject) {
          row.errors.push('Code matière inconnu dans cette école.');
        } else if (teacherCode && !teacher) {
          row.errors.push('Code professeur inconnu dans cette école.');
        } else {
          row.linkedClassroomId = classroom.id;
          row.linkedSubjectId = subject.id;
          row.linkedTeacherId = teacher?.id ?? null;
          row.possibleDuplicate = Boolean(
            createClassSubjectRepository(this.db, tenant).findByClassroomSubject(
              classroom.id,
              subject.id
            )
          );
        }

        continue;
      }
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
        const validRows = preview.rows.filter((row) => row.errors.length === 0);
        let imported = 0;
        let skippedExisting = 0;
        const errored = 0;

        if (preview.kind === 'GUARDIANS') {
          // Guardians carry no code: names are not identity, so every row is
          // imported. The preview already warned about possible name matches.
          const repository = createGuardianRepository(transaction, tenant);
          const linkRepository = createStudentGuardianRepository(transaction, tenant);

          for (const row of validRows) {
            try {
              const guardian = repository.create(toGuardianCreateInput(row));

              // Optional auto-link to the student whose code was provided in
              // the workbook (resolved at preview time). The pair may already
              // exist when the same guardian links the same student twice.
              if (row.linkedStudentId) {
                try {
                  linkRepository.link({
                    studentId: row.linkedStudentId,
                    guardianId: guardian.id,
                    relationshipType: 'AUTRE',
                  });
                } catch (error) {
                  if (!isUniqueConstraintViolation(error)) {
                    throw error;
                  }
                }
              }

              imported += 1;
            } catch (error) {
              if (isUniqueConstraintViolation(error)) {
                skippedExisting += 1;
              } else {
                console.error('Unexpected error importing guardian row:', error);
                throw error;
              }
            }
          }
        } else if (preview.kind === 'SUBJECTS') {
          const repository = createSubjectRepository(transaction, tenant);

          for (const row of validRows) {
            const code = (row.values.code ?? '').trim().toUpperCase();
            const alreadyPresent = Boolean(repository.findByCode(code));

            if (alreadyPresent) {
              skippedExisting += 1;
              continue;
            }

            try {
              repository.create({
                code,
                name: row.values.name ?? '',
                nameEn: row.values.nameEn ?? null,
                nameAr: row.values.nameAr ?? null,
                shortLabel: row.values.shortLabel ?? null,
                category: (row.values.category ?? 'AUTRE') as SubjectCategory,
              });
              imported += 1;
            } catch (error) {
              if (isUniqueConstraintViolation(error)) {
                skippedExisting += 1;
              } else {
                console.error('Unexpected error importing subject row:', error);
                throw error;
              }
            }
          }
        } else if (preview.kind === 'CLASSROOMS') {
          const repository = createClassroomRepository(transaction, tenant);

          for (const row of validRows) {
            if (!row.linkedAcademicYearId || !row.linkedClassLevelId) {
              skippedExisting += 1;
              continue;
            }

            const code = (row.values.code ?? '').trim().toUpperCase();
            const alreadyPresent = Boolean(
              repository.findByYearCode(row.linkedAcademicYearId, code)
            );

            if (alreadyPresent) {
              skippedExisting += 1;
              continue;
            }

            try {
              repository.create({
                academicYearId: row.linkedAcademicYearId,
                classLevelId: row.linkedClassLevelId,
                code,
                name: row.values.name ?? null,
                capacity: row.values.capacity?.trim() ? Number(row.values.capacity) : null,
              });
              imported += 1;
            } catch (error) {
              if (isUniqueConstraintViolation(error)) {
                skippedExisting += 1;
              } else {
                console.error('Unexpected error importing classroom row:', error);
                throw error;
              }
            }
          }
        } else if (preview.kind === 'CLASS_SUBJECTS') {
          const repository = createClassSubjectRepository(transaction, tenant);

          for (const row of validRows) {
            if (!row.linkedClassroomId || !row.linkedSubjectId) {
              skippedExisting += 1;
              continue;
            }

            const alreadyPresent = Boolean(
              repository.findByClassroomSubject(row.linkedClassroomId, row.linkedSubjectId)
            );

            if (alreadyPresent) {
              skippedExisting += 1;
              continue;
            }

            try {
              repository.create({
                classroomId: row.linkedClassroomId,
                subjectId: row.linkedSubjectId,
                coefficient: Number(row.values.coefficient ?? 1),
                isRequired: (row.values.isRequired ?? '').trim().toUpperCase() !== 'NON',
                teacherId: row.linkedTeacherId ?? null,
              });
              imported += 1;
            } catch (error) {
              if (isUniqueConstraintViolation(error)) {
                skippedExisting += 1;
              } else {
                console.error('Unexpected error importing class-subject row:', error);
                throw error;
              }
            }
          }
        } else {
          const repository =
            preview.kind === 'STUDENTS'
              ? createStudentRepository(transaction, tenant)
              : createTeacherRepository(transaction, tenant);

          for (const row of validRows) {
            const explicitCode = row.values.code?.trim();

            // Codes are the ONLY identity: a code already present in the school
            // (including archived rows) is skipped. Uncoded rows are always
            // imported - the preview already warned the admin about possible
            // name matches, because two real people can share an exact name.
            const alreadyPresent = explicitCode
              ? Boolean(repository.findByCode(normalizePeopleCode(explicitCode)))
              : false;

            if (alreadyPresent) {
              skippedExisting += 1;
              continue;
            }

            for (let attempt = 0; attempt < (explicitCode ? 1 : 3); attempt++) {
              const code = explicitCode
                ? normalizePeopleCode(explicitCode)
                : generatePeopleCode(
                    transaction,
                    tenant,
                    this.now,
                    () => repository.countAll(),
                    attempt
                  );

              try {
                if (preview.kind === 'STUDENTS') {
                  repository.create(toStudentCreateInput(row, code));
                } else {
                  repository.create(toTeacherCreateInput(row, code));
                }

                imported += 1;
                break;
              } catch (error) {
                if (isUniqueConstraintViolation(error)) {
                  if (explicitCode) {
                    skippedExisting += 1;
                    break;
                  } else if (attempt === 2) {
                    console.error('Failed to generate unique code for row after 3 attempts');
                    throw error;
                  }
                  // Continue to retry generated code
                } else {
                  console.error('Unexpected error importing student/teacher row:', error);
                  throw error;
                }
              }
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

    const personLabel =
      kind === 'GUARDIANS'
        ? 'responsable'
        : kind === 'STUDENTS'
          ? 'eleve'
          : kind === 'TEACHERS'
            ? 'professeur'
            : kind === 'SUBJECTS'
              ? 'matiere'
              : kind === 'CLASSROOMS'
                ? 'classe'
                : 'affectation';
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
        `- Ajoutez une ligne par ${personLabel} a partir de la ligne 2 ; les lignes vides sont ignorees.`,
      ],
    ];

    if (kind === 'STUDENTS' || kind === 'TEACHERS') {
      readmeRows.push([
        "- Les dates s'ecrivent JJ/MM/AAAA (ex. 14/03/2012) ou AAAA-MM-JJ (ex. 2012-03-14).",
      ]);
    }

    if (kind === 'STUDENTS') {
      readmeRows.push(['- Sexe : M, F ou AUTRE.']);
    }

    if (kind === 'GUARDIANS') {
      readmeRows.push([
        "- Code eleve : optionnel. Renseigne, le responsable est automatiquement lie a l'eleve portant ce code (a importer avant ou deja present dans l'ecole). Un code inconnu bloque la ligne.",
      ]);
    }

    if (kind === 'STUDENTS' || kind === 'TEACHERS') {
      readmeRows.push(['- Code : optionnel. Laisses vide, un code est genere automatiquement.']);
      readmeRows.push([
        "- Un code utilise deux fois dans le fichier (ou deja present dans l'ecole) est refuse.",
      ]);
    }

    if (kind === 'SUBJECTS') {
      readmeRows.push(['- Codes et categories : les codes sont ecrits en majuscules.']);
      readmeRows.push([
        '- Categories : LANGUES, SCIENCES, MATHEMATIQUES, SCIENCES_SOCIALES, ARTS, SPORTS ou AUTRE.',
      ]);
    }

    if (kind === 'CLASSROOMS') {
      readmeRows.push(["- Annee scolaire : libelle exact d'une annee deja creee (ex. 2026-2027)."]);
      readmeRows.push(['- Code niveau : code exact d un niveau deja cree (ex. 6E, 3E, TLE).']);
    }

    if (kind === 'CLASS_SUBJECTS') {
      readmeRows.push([
        "- Code classe : classe deja creee dans l'annee scolaire active (ex. 3E-A).",
      ]);
      readmeRows.push(['- Code matiere : matiere deja creee (ex. MATH).']);
      readmeRows.push(['- Obligatoire : OUI ou NON (par defaut OUI).']);
      readmeRows.push([
        '- Code professeur : optionnel. Le professeur doit deja exister dans lec cole.',
      ]);
    }

    readmeRows.push(["- Ligne d'exemple : voir la feuille « Exemples » (non importee)."]);
    const readmeSheet = XLSX.utils.aoa_to_sheet(readmeRows);
    readmeSheet['!cols'] = [{ wch: 24 }, { wch: 10 }, { wch: 90 }];
    XLSX.utils.book_append_sheet(workbook, readmeSheet, 'Mode d emploi');

    const examplesRows =
      kind === 'STUDENTS'
        ? [
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
          ]
        : kind === 'GUARDIANS'
          ? [
              [
                'Fatime',
                'Abakar',
                '+23566000020',
                'fatime.abakar@exemple.td',
                'N Djamena',
                'NDS-DEMO-2026-X00001',
              ],
              ['Mahamat', 'Ousmane', '+23566000021', null, null, null],
            ]
          : kind === 'TEACHERS'
            ? [
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
              ]
            : kind === 'SUBJECTS'
              ? [
                  ['MATH', 'Mathématiques', 'Mathematics', 'Riyadiyat', 'Maths', 'MATHEMATIQUES'],
                  ['FR', 'Français', 'French', null, null, 'LANGUES'],
                  ['EPS', 'Éducation physique', null, null, null, 'SPORTS'],
                ]
              : kind === 'CLASSROOMS'
                ? [
                    ['2026-2027', '6E', '6E-A', '6e A', 45],
                    ['2026-2027', '3E', '3E-B', null, 35],
                  ]
                : [
                    ['6E-A', 'MATH', 4, 'OUI', 'NDS-DEMO-2026-T00001'],
                    ['3E-B', 'FR', 3, 'NON', null],
                  ];
    const examplesSheet = XLSX.utils.aoa_to_sheet([
      columns.map((column) => column.label),
      ...examplesRows,
    ]);
    examplesSheet['!cols'] = dataSheet['!cols'];
    XLSX.utils.book_append_sheet(workbook, examplesSheet, 'Exemples');

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
    const columns = IMPORT_COLUMNS_BY_KIND[preview.kind];
    const header = ['Ligne', ...columns.map((column) => column.label), 'Erreurs'];
    const lines = [
      header,
      ...errorRows.map((row) => [
        String(row.rowNumber),
        ...columns.map((column) => row.values[column.key] ?? ''),
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

function toGuardianCreateInput(row: ParsedImportRow) {
  return {
    firstName: row.values.firstName ?? '',
    lastName: row.values.lastName ?? '',
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
