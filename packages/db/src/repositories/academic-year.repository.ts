import { and, eq, isNull, sql } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import type { RepositoryExecutor, TenantContext } from './base';
import { TenantScopedRepository } from './base';
import { academicYear } from '../schema.sqlite';

export interface AcademicYearRecord {
  id: string;
  schoolId: string;
  label: string;
  startDate: string | null;
  endDate: string | null;
  isCurrent: boolean;
}

export interface SaveAcademicYearInput {
  label: string;
  startDate: string;
  endDate: string;
}

/** Persists tenant-scoped academic years and current-year selection. */
export class AcademicYearRepository extends TenantScopedRepository {
  findCurrent() {
    return this.db
      .select(academicYearColumns)
      .from(academicYear)
      .where(
        and(
          eq(academicYear.schoolId, this.schoolId),
          eq(academicYear.isCurrent, true),
          isNull(academicYear.deletedAt)
        )
      )
      .get();
  }

  findActiveByLabel(label: string) {
    return this.db
      .select(academicYearColumns)
      .from(academicYear)
      .where(
        and(
          eq(academicYear.schoolId, this.schoolId),
          eq(academicYear.label, label),
          isNull(academicYear.deletedAt)
        )
      )
      .get();
  }

  clearCurrent(updatedAt: string) {
    return this.db
      .update(academicYear)
      .set({
        isCurrent: false,
        updatedAt,
        recordVersion: sql`${academicYear.recordVersion} + 1`,
      })
      .where(and(eq(academicYear.schoolId, this.schoolId), eq(academicYear.isCurrent, true)))
      .run();
  }

  createCurrent(input: SaveAcademicYearInput, updatedAt: string) {
    return this.db
      .insert(academicYear)
      .values({
        id: randomUUID(),
        schoolId: this.schoolId,
        label: input.label,
        startDate: input.startDate,
        endDate: input.endDate,
        isCurrent: true,
        updatedAt,
      })
      .returning(academicYearColumns)
      .get();
  }

  updateCurrent(id: string, input: SaveAcademicYearInput, updatedAt: string) {
    return this.db
      .update(academicYear)
      .set({
        label: input.label,
        startDate: input.startDate,
        endDate: input.endDate,
        isCurrent: true,
        updatedAt,
        recordVersion: sql`${academicYear.recordVersion} + 1`,
      })
      .where(and(eq(academicYear.schoolId, this.schoolId), eq(academicYear.id, id)))
      .returning(academicYearColumns)
      .get();
  }
}

export function createAcademicYearRepository(db: RepositoryExecutor, tenant: TenantContext) {
  return new AcademicYearRepository(db, tenant);
}

const academicYearColumns = {
  id: academicYear.id,
  schoolId: academicYear.schoolId,
  label: academicYear.label,
  startDate: academicYear.startDate,
  endDate: academicYear.endDate,
  isCurrent: academicYear.isCurrent,
};
