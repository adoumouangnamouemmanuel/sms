import { z } from 'zod';

// ---------------------------------------------------------------------------
// Import kinds and column definitions
// ---------------------------------------------------------------------------

export const IMPORT_KINDS = ['STUDENTS', 'TEACHERS'] as const;
export type ImportKind = (typeof IMPORT_KINDS)[number];

/**
 * One column of an import workbook. The `label` is the exact French header
 * written in the generated template and expected when parsing (trimmed,
 * case-insensitive). Shared by the API (template generation + parsing) and the
 * web (preview table headers).
 */
export interface ImportColumnDefinition {
  key: string;
  label: string;
  required: boolean;
  description: string;
}

export const STUDENT_IMPORT_COLUMNS: ImportColumnDefinition[] = [
  {
    key: 'code',
    label: 'Code',
    required: false,
    description:
      "Optionnel. Laissé vide, un code est généré automatiquement ({code de l'école}-{année}-{séquence}).",
  },
  { key: 'firstName', label: 'Prénom', required: true, description: 'Requis.' },
  { key: 'lastName', label: 'Nom', required: true, description: 'Requis.' },
  { key: 'sex', label: 'Sexe', required: false, description: 'M, F ou AUTRE.' },
  {
    key: 'dateOfBirth',
    label: 'Date de naissance',
    required: false,
    description: 'JJ/MM/AAAA ou AAAA-MM-JJ.',
  },
  { key: 'nationality', label: 'Nationalité', required: false, description: 'Optionnel.' },
  { key: 'phone', label: 'Téléphone', required: false, description: 'Optionnel.' },
  { key: 'email', label: 'Email', required: false, description: 'Optionnel.' },
  { key: 'address', label: 'Adresse', required: false, description: 'Optionnel.' },
];

export const TEACHER_IMPORT_COLUMNS: ImportColumnDefinition[] = [
  {
    key: 'code',
    label: 'Code',
    required: false,
    description:
      "Optionnel. Laissé vide, un code est généré automatiquement ({code de l'école}-{année}-{séquence}).",
  },
  { key: 'firstName', label: 'Prénom', required: true, description: 'Requis.' },
  { key: 'lastName', label: 'Nom', required: true, description: 'Requis.' },
  { key: 'specialization', label: 'Spécialité', required: false, description: 'Optionnel.' },
  {
    key: 'hireDate',
    label: "Date d'embauche",
    required: false,
    description: 'JJ/MM/AAAA ou AAAA-MM-JJ.',
  },
  { key: 'phone', label: 'Téléphone', required: false, description: 'Optionnel.' },
  { key: 'email', label: 'Email', required: false, description: 'Optionnel.' },
  { key: 'address', label: 'Adresse', required: false, description: 'Optionnel.' },
];

export const IMPORT_COLUMNS_BY_KIND: Record<ImportKind, ImportColumnDefinition[]> = {
  STUDENTS: STUDENT_IMPORT_COLUMNS,
  TEACHERS: TEACHER_IMPORT_COLUMNS,
};

// ---------------------------------------------------------------------------
// Preview
// ---------------------------------------------------------------------------

export const importPreviewRowSchema = z.object({
  rowNumber: z.number().int().min(1),
  code: z.string().nullable(),
  firstName: z.string(),
  lastName: z.string(),
  /** Column key -> raw cell value as a displayable string (or null). */
  values: z.record(z.string(), z.string().nullable()),
  /** French validation messages; non-empty means the row is rejected. */
  errors: z.array(z.string()),
});

export const importPreviewResponseSchema = z.object({
  importId: z.string().min(1),
  kind: z.enum(IMPORT_KINDS),
  filename: z.string().min(1),
  totalRows: z.number().int().min(0),
  validRows: z.number().int().min(0),
  errorRows: z.number().int().min(0),
  /** Preview is capped (e.g. first rows) — never the whole file for huge sheets. */
  rows: z.array(importPreviewRowSchema),
});

export const confirmImportRequestSchema = z.object({
  importId: z.string().min(1),
  importIdentifier: z.string().trim().min(1).max(80),
});

export const confirmImportResponseSchema = z.object({
  importIdentifier: z.string(),
  /** True when the same identifier was already confirmed: nothing was imported. */
  alreadyConfirmed: z.boolean(),
  imported: z.number().int().min(0),
  skippedExisting: z.number().int().min(0),
  errorRows: z.number().int().min(0),
});

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ImportPreviewRow = z.infer<typeof importPreviewRowSchema>;
export type ImportPreviewResponse = z.infer<typeof importPreviewResponseSchema>;
export type ConfirmImportRequest = z.infer<typeof confirmImportRequestSchema>;
export type ConfirmImportResponse = z.infer<typeof confirmImportResponseSchema>;
