import { and, eq } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import type { ImportKind } from '@edutrack/shared';
import type { RepositoryExecutor, TenantContext } from './base.js';
import { TenantScopedRepository } from './base.js';
import { importBatch } from '../schema.sqlite.js';

export interface CreateImportBatchInput {
  kind: ImportKind;
  importIdentifier: string;
  filename: string;
  totalRows: number;
  validRows: number;
  errorRows: number;
}

export interface ImportBatchRecord {
  id: string;
  schoolId: string;
  kind: ImportKind;
  importIdentifier: string;
  filename: string;
  totalRows: number;
  validRows: number;
  errorRows: number;
  createdAt: string;
  updatedAt: string;
  recordVersion: number;
  deletedAt: string | null;
}

/**
 * Records confirmed imports. The (school, import_identifier) unique index
 * makes re-confirming the same identifier a no-op instead of a duplicate.
 */
export class ImportBatchRepository extends TenantScopedRepository {
  create(input: CreateImportBatchInput) {
    return this.db
      .insert(importBatch)
      .values({
        id: randomUUID(),
        schoolId: this.schoolId,
        kind: input.kind,
        importIdentifier: input.importIdentifier,
        filename: input.filename,
        totalRows: input.totalRows,
        validRows: input.validRows,
        errorRows: input.errorRows,
      })
      .returning(importBatchColumns)
      .get();
  }

  /** Finds a previously confirmed import with the same identifier for this school. */
  findBySchoolAndIdentifier(importIdentifier: string) {
    return this.db
      .select(importBatchColumns)
      .from(importBatch)
      .where(
        and(
          eq(importBatch.schoolId, this.schoolId),
          eq(importBatch.importIdentifier, importIdentifier)
        )
      )
      .get();
  }
}

export function createImportBatchRepository(db: RepositoryExecutor, tenant: TenantContext) {
  return new ImportBatchRepository(db, tenant);
}

const importBatchColumns = {
  id: importBatch.id,
  schoolId: importBatch.schoolId,
  kind: importBatch.kind,
  importIdentifier: importBatch.importIdentifier,
  filename: importBatch.filename,
  totalRows: importBatch.totalRows,
  validRows: importBatch.validRows,
  errorRows: importBatch.errorRows,
  createdAt: importBatch.createdAt,
  updatedAt: importBatch.updatedAt,
  recordVersion: importBatch.recordVersion,
  deletedAt: importBatch.deletedAt,
};
