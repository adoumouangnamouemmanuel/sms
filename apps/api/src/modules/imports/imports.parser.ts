import {
  IMPORT_COLUMNS_BY_KIND,
  type ImportColumnDefinition,
  type ImportKind,
} from '@edutrack/shared';
import * as XLSX from 'xlsx';
import { normalizePeopleCode } from '../people/people.codes.js';

export interface ParsedImportRow {
  /** 1-based Excel row number (the header row is 1). */
  rowNumber: number;
  /** Column key -> raw cell value as a displayable string (or null). */
  values: Record<string, string | null>;
  /** French validation messages; non-empty means the row is rejected. */
  errors: string[];
}

export interface ParsedImportWorkbook {
  fileError?: string;
  rows: ParsedImportRow[];
}

export function importFileError(fileError: string): ParsedImportWorkbook {
  return { fileError, rows: [] };
}

/**
 * Reads the first sheet of an .xlsx buffer, locates the French header row
 * (first row containing Prénom + Nom), maps the template columns, validates
 * every data row with French messages, and marks duplicate codes within the
 * batch. Never touches the database — preview-only data.
 */
export function parseImportWorkbook(kind: ImportKind, buffer: Buffer): ParsedImportWorkbook {
  const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: false });
  const sheetName = workbook.SheetNames[0];

  if (!sheetName) {
    return importFileError('Le fichier ne contient aucune feuille de calcul.');
  }

  const sheet = workbook.Sheets[sheetName];
  const rawRows = sheet
    ? XLSX.utils.sheet_to_json<unknown[]>(sheet, {
        header: 1,
        raw: false,
        defval: null,
      })
    : [];
  const headerIndex = findHeaderRow(rawRows);

  if (headerIndex === -1) {
    return importFileError(
      "La premiere ligne doit contenir les en-tetes 'Prénom' et 'Nom' (modele a telecharger)."
    );
  }

  const headerRow = rawRows[headerIndex];
  const columns = IMPORT_COLUMNS_BY_KIND[kind];
  const columnIndexByKey = headerRow ? mapHeaderColumns(headerRow, columns) : null;

  if (!columnIndexByKey) {
    return importFileError(
      `Colonne requise introuvable. Colonnes attendues : ${columns
        .filter((column) => column.required)
        .map((column) => `'${column.label}'`)
        .join(', ')}.`
    );
  }

  const rows: ParsedImportRow[] = [];

  for (let index = headerIndex + 1; index < rawRows.length; index += 1) {
    const rawRow = rawRows[index] ?? [];
    const rowNumber = index + 1;
    const values = readRowValues(rawRow, columnIndexByKey);
    const errors = validateImportRow(kind, values);

    if (isEmptyRow(values)) {
      continue;
    }

    rows.push({ rowNumber, values, errors });
  }

  markDuplicateCodes(rows);

  if (rows.length === 0) {
    return importFileError('Le fichier ne contient aucune ligne de donnees a importer.');
  }

  return { rows };
}

// ---------------------------------------------------------------------------
// Header mapping
// ---------------------------------------------------------------------------

function findHeaderRow(rawRows: unknown[][]): number {
  return rawRows.findIndex(
    (row) =>
      row.some((cell) => normalizeHeader(cell) === 'prénom') &&
      row.some((cell) => normalizeHeader(cell) === 'nom')
  );
}

function mapHeaderColumns(
  headerRow: unknown[],
  columns: ImportColumnDefinition[]
): Record<string, number> | null {
  const indexByLabel = new Map<string, number>();

  headerRow.forEach((cell, index) => {
    const normalized = normalizeHeader(cell);

    if (normalized) {
      indexByLabel.set(normalized, index);
    }
  });

  const columnIndexByKey: Record<string, number> = {};

  for (const column of columns) {
    const index = indexByLabel.get(normalizeHeader(column.label));

    if (index === undefined) {
      if (column.required) {
        return null;
      }

      continue;
    }

    columnIndexByKey[column.key] = index;
  }

  return columnIndexByKey;
}

function normalizeHeader(cell: unknown) {
  return typeof cell === 'string' ? cell.trim().toLocaleLowerCase('fr') : '';
}

// ---------------------------------------------------------------------------
// Row reading and validation
// ---------------------------------------------------------------------------

function readRowValues(
  rawRow: unknown[],
  columnIndexByKey: Record<string, number>
): Record<string, string | null> {
  const values: Record<string, string | null> = {};

  for (const [key, index] of Object.entries(columnIndexByKey)) {
    values[key] = readCell(rawRow[index]);
  }

  return values;
}

function readCell(cell: unknown): string | null {
  if (cell === null || cell === undefined) {
    return null;
  }

  if (cell instanceof Date) {
    return cell.toISOString().slice(0, 10);
  }

  if (typeof cell === 'string') {
    const value = cell.trim();
    return value.length > 0 ? value : null;
  }

  if (typeof cell === 'number' || typeof cell === 'boolean') {
    return String(cell);
  }

  return null;
}

function isEmptyRow(values: Record<string, string | null>) {
  return Object.values(values).every((value) => value === null);
}

function validateImportRow(kind: ImportKind, values: Record<string, string | null>): string[] {
  const errors: string[] = [];
  const firstName = values.firstName?.trim();
  const lastName = values.lastName?.trim();

  if (!firstName) {
    errors.push('Prénom requis.');
  } else if (firstName.length > 120) {
    errors.push('Prénom trop long (120 caractères maximum).');
  }

  if (!lastName) {
    errors.push('Nom requis.');
  } else if (lastName.length > 120) {
    errors.push('Nom trop long (120 caractères maximum).');
  }

  const code = values.code?.trim();

  if (code) {
    if (code.length > 64) {
      errors.push('Code trop long (64 caractères maximum).');
    }

    if (!/^[A-Za-z0-9._-]+$/.test(code)) {
      errors.push("Code invalide (lettres, chiffres, '.', '_' ou '-' uniquement).");
    }
  }

  if (kind === 'STUDENTS') {
    validateStudentFields(values, errors);
  } else {
    validateTeacherFields(values, errors);
  }

  const email = values.email?.trim();

  if (email && !isValidEmail(email)) {
    errors.push('Adresse email invalide.');
  }

  return errors;
}

function validateStudentFields(values: Record<string, string | null>, errors: string[]) {
  const sex = values.sex?.trim();

  if (sex) {
    const normalizedSex = normalizeSex(sex);

    if (!normalizedSex) {
      errors.push('Sexe invalide (M, F ou AUTRE).');
    } else {
      values.sex = normalizedSex;
    }
  }

  const dateOfBirth = values.dateOfBirth?.trim();

  if (dateOfBirth) {
    const normalizedDate = normalizeDate(dateOfBirth);

    if (!normalizedDate) {
      errors.push('Date de naissance invalide (JJ/MM/AAAA ou AAAA-MM-JJ).');
    } else {
      values.dateOfBirth = normalizedDate;
    }
  }
}

function validateTeacherFields(values: Record<string, string | null>, errors: string[]) {
  const hireDate = values.hireDate?.trim();

  if (hireDate) {
    const normalizedDate = normalizeDate(hireDate);

    if (!normalizedDate) {
      errors.push("Date d'embauche invalide (JJ/MM/AAAA ou AAAA-MM-JJ).");
    } else {
      values.hireDate = normalizedDate;
    }
  }
}

/** Accepts M/F/AUTRE (case-insensitive) and the French long forms. */
function normalizeSex(rawSex: string) {
  const normalized = rawSex.trim().toUpperCase();

  if (normalized === 'M' || normalized === 'MASCULIN') {
    return 'M';
  }

  if (normalized === 'F' || normalized === 'FEMININ' || normalized === 'FÉMININ') {
    return 'F';
  }

  if (normalized === 'AUTRE') {
    return 'AUTRE';
  }

  return null;
}

/** Normalizes JJ/MM/AAAA or AAAA-MM-JJ into AAAA-MM-JJ with real calendar validation. */
function normalizeDate(rawDate: string) {
  const trimmed = rawDate.trim();
  const isoMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  const frenchMatch = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(trimmed);

  let year: number;
  let month: number;
  let day: number;

  if (isoMatch) {
    year = Number(isoMatch[1]);
    month = Number(isoMatch[2]);
    day = Number(isoMatch[3]);
  } else if (frenchMatch) {
    day = Number(frenchMatch[1]);
    month = Number(frenchMatch[2]);
    year = Number(frenchMatch[3]);
  } else {
    return null;
  }

  return isValidCalendarDate(year, month, day) ? padDate(year, month, day) : null;
}

function isValidCalendarDate(year: number, month: number, day: number) {
  if (month < 1 || month > 12 || day < 1 || day > 31) {
    return false;
  }

  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  );
}

function padDate(year: number, month: number, day: number) {
  return `${String(year)}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
}

/**
 * Codes are durable identity: a code used twice inside one file is an error on
 * the second occurrence (the first occurrence wins, mirroring the DB rule).
 */
function markDuplicateCodes(rows: ParsedImportRow[]) {
  const firstRowByCode = new Map<string, number>();

  for (const row of rows) {
    const code = row.values.code?.trim();

    if (!code) {
      continue;
    }

    const normalizedCode = normalizePeopleCode(code);
    const firstRowNumber = firstRowByCode.get(normalizedCode);

    if (firstRowNumber !== undefined) {
      row.errors.push(`Code deja utilise dans le fichier (ligne ${String(firstRowNumber)}).`);
    } else {
      firstRowByCode.set(normalizedCode, row.rowNumber);
    }
  }
}

// ---------------------------------------------------------------------------
// CSV export (rejected rows) — formula-injection safe
// ---------------------------------------------------------------------------

/** Quotes CSV cells and neutralizes spreadsheet formula injection. */
export function csvSafeCell(value: string | number) {
  const raw = String(value);
  // Cells starting with =, +, -, @ or tab/CR are prefixed with ' so Excel
  // treats them as text instead of executing them.
  const guarded = /^[=+\-@\t\r]/.test(raw) ? `'${raw}` : raw;

  return /[";\r\n]/.test(guarded) ? `"${guarded.replaceAll('"', '""')}"` : guarded;
}
