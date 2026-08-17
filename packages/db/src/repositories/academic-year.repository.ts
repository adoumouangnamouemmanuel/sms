import { and, desc, eq, isNull, sql } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import type { AcademicYearStatus } from '@edutrack/shared';
import type { RepositoryExecutor, TenantContext } from './base.js';
import { TenantScopedRepository } from './base.js';
import { academicYear } from '../schema.sqlite.js';

export interface AcademicYearRecord {
  id: string;
  schoolId: string;
  label: string;
  startDate: string | null;
  endDate: string | null;
  status: AcademicYearStatus;
  isCurrent: boolean;
}

export interface SaveAcademicYearInput {
  label: string;
  startDate: string;
  endDate: string;
}

/** Persists tenant-scoped academic years and current-year selection. */
export class AcademicYearRepository extends TenantScopedRepository {
  findById(id: string) {
    return this.db
      .select(academicYearColumns)
      .from(academicYear)
      .where(and(eq(academicYear.id, id), eq(academicYear.schoolId, this.schoolId)))
      .get();
  }

  /** Like findById but excludes archived years: validation paths must not
   * accept a soft-deleted academic year as a reference target. */
  findActiveById(id: string) {
    return this.db
      .select(academicYearColumns)
      .from(academicYear)
      .where(
        and(
          eq(academicYear.id, id),
          eq(academicYear.schoolId, this.schoolId),
          isNull(academicYear.deletedAt)
        )
      )
      .get();
  }

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

  /** The single ACTIVE year (lifecycle source of truth, roadmap §9.3). */
  findActive() {
    return this.db
      .select(academicYearColumns)
      .from(academicYear)
      .where(
        and(
          eq(academicYear.schoolId, this.schoolId),
          eq(academicYear.status, 'ACTIVE'),
          isNull(academicYear.deletedAt)
        )
      )
      .get();
  }

  listWithStatus() {
    return this.db
      .select(academicYearColumns)
      .from(academicYear)
      .where(and(eq(academicYear.schoolId, this.schoolId), isNull(academicYear.deletedAt)))
      .orderBy(desc(academicYear.startDate), desc(academicYear.createdAt))
      .all();
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
        status: 'CLOSED',
        updatedAt,
        recordVersion: sql`${academicYear.recordVersion} + 1`,
      })
      .where(
        and(
          eq(academicYear.schoolId, this.schoolId),
          eq(academicYear.isCurrent, true),
          isNull(academicYear.deletedAt)
        )
      )
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
        status: 'ACTIVE',
        isCurrent: true,
        updatedAt,
      })
      .returning(academicYearColumns)
      .get();
  }

  createDraft(input: SaveAcademicYearInput, updatedAt: string) {
    return this.db
      .insert(academicYear)
      .values({
        id: randomUUID(),
        schoolId: this.schoolId,
        label: input.label,
        startDate: input.startDate,
        endDate: input.endDate,
        status: 'DRAFT',
        isCurrent: false,
        updatedAt,
      })
      .returning(academicYearColumns)
      .get();
  }

  /** Activates a year and marks it current; callers close any previous ACTIVE first. */
  activate(id: string, updatedAt: string) {
    return this.db
      .update(academicYear)
      .set({
        status: 'ACTIVE',
        isCurrent: true,
        updatedAt,
        recordVersion: sql`${academicYear.recordVersion} + 1`,
      })
      .where(and(eq(academicYear.schoolId, this.schoolId), eq(academicYear.id, id)))
      .returning(academicYearColumns)
      .get();
  }

  close(id: string, updatedAt: string) {
    return this.db
      .update(academicYear)
      .set({
        status: 'CLOSED',
        isCurrent: false,
        updatedAt,
        recordVersion: sql`${academicYear.recordVersion} + 1`,
      })
      .where(and(eq(academicYear.schoolId, this.schoolId), eq(academicYear.id, id)))
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
        status: 'ACTIVE',
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
  status: academicYear.status,
  isCurrent: academicYear.isCurrent,
};
