import { and, asc, eq, isNull, sql } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import type { SetupTermInput } from '@edutrack/shared';
import type { RepositoryExecutor, TenantContext } from './base.js';
import { TenantScopedRepository } from './base.js';
import { term } from '../schema.sqlite.js';

export interface TermRecord {
  id: string;
  schoolId: string;
  academicYearId: string;
  label: string;
  termNumber: number;
  startDate: string;
  endDate: string;
  isCurrent: boolean;
}

/** Owns term rows for a single tenant and academic year. */
export class TermRepository extends TenantScopedRepository {
  listForAcademicYear(academicYearId: string) {
    return this.db
      .select(termColumns)
      .from(term)
      .where(
        and(
          eq(term.schoolId, this.schoolId),
          eq(term.academicYearId, academicYearId),
          isNull(term.deletedAt)
        )
      )
      .orderBy(asc(term.termNumber))
      .all();
  }

  replaceForAcademicYear(academicYearId: string, terms: SetupTermInput[], updatedAt: string) {
    const activeNumbers = new Set(terms.map((item) => item.termNumber));
    const existingTerms = this.db
      .select({ id: term.id, termNumber: term.termNumber })
      .from(term)
      .where(and(eq(term.schoolId, this.schoolId), eq(term.academicYearId, academicYearId)))
      .all();

    // Natural keys (label, termNumber) are unique per academic year, so existing rows move temporarily first.
    this.db
      .update(term)
      .set({
        termNumber: sql`${term.termNumber} + 1000`,
        label: sql`${term.label} || '-tmp-' || ${term.id}`,
        updatedAt,
      })
      .where(and(eq(term.schoolId, this.schoolId), eq(term.academicYearId, academicYearId)))
      .run();

    const hasNewCurrentTerm = terms.some((item) => item.isCurrent);
    if (hasNewCurrentTerm) {
      this.db
        .update(term)
        .set({
          isCurrent: false,
          updatedAt,
        })
        .where(and(eq(term.schoolId, this.schoolId), eq(term.isCurrent, true)))
        .run();
    } else {
      this.db
        .update(term)
        .set({
          isCurrent: false,
          updatedAt,
        })
        .where(and(eq(term.schoolId, this.schoolId), eq(term.academicYearId, academicYearId)))
        .run();
    }
    for (const existingTerm of existingTerms) {
      if (!activeNumbers.has(existingTerm.termNumber)) {
        this.db
          .update(term)
          .set({
            isCurrent: false,
            deletedAt: updatedAt,
            updatedAt,
            recordVersion: sql`${term.recordVersion} + 1`,
          })
          .where(and(eq(term.schoolId, this.schoolId), eq(term.id, existingTerm.id)))
          .run();
      }
    }

    for (const input of terms) {
      const existingTerm = existingTerms.find((item) => item.termNumber === input.termNumber);

      if (existingTerm) {
        this.db
          .update(term)
          .set({
            label: input.label,
            startDate: input.startDate,
            endDate: input.endDate,
            isCurrent: input.isCurrent,
            deletedAt: null,
            updatedAt,
            recordVersion: sql`${term.recordVersion} + 1`,
          })
          .where(and(eq(term.schoolId, this.schoolId), eq(term.id, existingTerm.id)))
          .run();
        continue;
      }

      this.db
        .insert(term)
        .values({
          id: randomUUID(),
          schoolId: this.schoolId,
          academicYearId,
          label: input.label,
          termNumber: input.termNumber,
          startDate: input.startDate,
          endDate: input.endDate,
          isCurrent: input.isCurrent,
          updatedAt,
        })
        .run();
    }

    return this.listForAcademicYear(academicYearId);
  }
}

export function createTermRepository(db: RepositoryExecutor, tenant: TenantContext) {
  return new TermRepository(db, tenant);
}

const termColumns = {
  id: term.id,
  schoolId: term.schoolId,
  academicYearId: term.academicYearId,
  label: term.label,
  termNumber: term.termNumber,
  startDate: term.startDate,
  endDate: term.endDate,
  isCurrent: term.isCurrent,
};
