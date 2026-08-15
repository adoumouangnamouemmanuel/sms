import { and, asc, count, desc, eq, isNotNull, isNull, sql } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import type { EnrollmentStatus } from '@edutrack/shared';
import type { RepositoryExecutor, TenantContext } from './base.js';
import { TenantScopedRepository } from './base.js';
import { classEnrollment } from '../schema.sqlite.js';

export interface CreateClassEnrollmentInput {
  studentId: string;
  classroomId: string;
  academicYearId: string;
  enrollmentDate: string;
  status?: EnrollmentStatus;
  exitDate?: string | null;
  reason?: string | null;
}

export interface UpdateClassEnrollmentInput {
  exitDate?: string | null;
  reason?: string | null;
}

export interface ClassEnrollmentRecord {
  id: string;
  schoolId: string;
  studentId: string;
  classroomId: string;
  academicYearId: string;
  status: EnrollmentStatus;
  enrollmentDate: string;
  exitDate: string | null;
  reason: string | null;
  deletedAt: string | null;
  recordVersion: number;
}

export interface ListClassEnrollmentsOptions {
  classroomId?: string;
  studentId?: string;
  academicYearId?: string;
  status?: EnrollmentStatus;
  /** 'archived' lists archived records; omitted or 'active' lists active ones. */
  recordStatus?: 'active' | 'archived';
  limit?: number;
  offset?: number;
}

export interface CountClassEnrollmentsOptions {
  classroomId?: string;
  studentId?: string;
  academicYearId?: string;
  status?: EnrollmentStatus;
  recordStatus?: 'active' | 'archived';
}

/**
 * Persists tenant-scoped class enrollments. Enrollment status is a controlled
 * domain value (AGENTS.md §9.3): transition validation lives in the service
 * layer, this repository only applies the requested change.
 */
export class ClassEnrollmentRepository extends TenantScopedRepository {
  create(input: CreateClassEnrollmentInput) {
    return this.db
      .insert(classEnrollment)
      .values({
        id: randomUUID(),
        schoolId: this.schoolId,
        ...normalizeClassEnrollmentCreate(input),
      })
      .returning(classEnrollmentColumns)
      .get();
  }

  findById(id: string) {
    return this.db
      .select(classEnrollmentColumns)
      .from(classEnrollment)
      .where(and(eq(classEnrollment.id, id), eq(classEnrollment.schoolId, this.schoolId)))
      .get();
  }

  /** The single ACTIVE enrollment for a student in an academic year, if any. */
  findActiveByStudentYear(studentId: string, academicYearId: string) {
    return this.db
      .select(classEnrollmentColumns)
      .from(classEnrollment)
      .where(
        and(
          eq(classEnrollment.schoolId, this.schoolId),
          eq(classEnrollment.studentId, studentId),
          eq(classEnrollment.academicYearId, academicYearId),
          eq(classEnrollment.status, 'ACTIVE'),
          isNull(classEnrollment.deletedAt)
        )
      )
      .get();
  }

  list(options: ListClassEnrollmentsOptions = {}) {
    const limit = options.limit ?? 50;
    const offset = options.offset ?? 0;

    return this.db
      .select(classEnrollmentColumns)
      .from(classEnrollment)
      .where(classEnrollmentWhere(this.schoolId, options))
      .orderBy(desc(classEnrollment.enrollmentDate), asc(classEnrollment.studentId))
      .limit(limit)
      .offset(offset)
      .all();
  }

  count(options: CountClassEnrollmentsOptions = {}) {
    const row = this.db
      .select({ value: count() })
      .from(classEnrollment)
      .where(classEnrollmentWhere(this.schoolId, options))
      .get();

    return row?.value ?? 0;
  }

  /**
   * Applies a status transition plus optional exit metadata. The service layer
   * validates the transition (e.g. ACTIVE -> TRANSFERRED requires a reason and
   * an effective date); the repository never interprets the status value.
   */
  updateStatus(
    id: string,
    status: EnrollmentStatus,
    updatedAt: string,
    metadata: { exitDate?: string | null; reason?: string | null } = {}
  ) {
    return this.db
      .update(classEnrollment)
      .set({
        status,
        ...(metadata.exitDate !== undefined ? { exitDate: metadata.exitDate ?? null } : {}),
        ...(metadata.reason !== undefined ? { reason: metadata.reason ?? null } : {}),
        updatedAt,
        recordVersion: sql`${classEnrollment.recordVersion} + 1`,
      })
      .where(and(eq(classEnrollment.id, id), eq(classEnrollment.schoolId, this.schoolId)))
      .returning(classEnrollmentColumns)
      .get();
  }

  update(id: string, input: UpdateClassEnrollmentInput, updatedAt: string) {
    return this.db
      .update(classEnrollment)
      .set({
        ...pickDefinedClassEnrollmentFields(input),
        updatedAt,
        recordVersion: sql`${classEnrollment.recordVersion} + 1`,
      })
      .where(and(eq(classEnrollment.id, id), eq(classEnrollment.schoolId, this.schoolId)))
      .returning(classEnrollmentColumns)
      .get();
  }

  archive(id: string, updatedAt: string) {
    return this.db
      .update(classEnrollment)
      .set({
        deletedAt: updatedAt,
        updatedAt,
        recordVersion: sql`${classEnrollment.recordVersion} + 1`,
      })
      .where(and(eq(classEnrollment.id, id), eq(classEnrollment.schoolId, this.schoolId)))
      .returning(classEnrollmentColumns)
      .get();
  }
}

export function createClassEnrollmentRepository(db: RepositoryExecutor, tenant: TenantContext) {
  return new ClassEnrollmentRepository(db, tenant);
}

function classEnrollmentWhere(
  schoolId: string,
  options: ListClassEnrollmentsOptions | CountClassEnrollmentsOptions
) {
  const archived = options.recordStatus === 'archived';

  return and(
    eq(classEnrollment.schoolId, schoolId),
    archived ? isNotNull(classEnrollment.deletedAt) : isNull(classEnrollment.deletedAt),
    options.classroomId ? eq(classEnrollment.classroomId, options.classroomId) : undefined,
    options.studentId ? eq(classEnrollment.studentId, options.studentId) : undefined,
    options.academicYearId ? eq(classEnrollment.academicYearId, options.academicYearId) : undefined,
    options.status ? eq(classEnrollment.status, options.status) : undefined
  );
}

function normalizeClassEnrollmentCreate(input: CreateClassEnrollmentInput) {
  return {
    studentId: input.studentId,
    classroomId: input.classroomId,
    academicYearId: input.academicYearId,
    status: input.status ?? 'ACTIVE',
    enrollmentDate: input.enrollmentDate,
    exitDate: input.exitDate ?? null,
    reason: input.reason ?? null,
  };
}

/** Only fields explicitly provided are updated; omitted fields stay unchanged. */
function pickDefinedClassEnrollmentFields(input: UpdateClassEnrollmentInput) {
  return {
    ...(input.exitDate !== undefined ? { exitDate: input.exitDate ?? null } : {}),
    ...(input.reason !== undefined ? { reason: input.reason ?? null } : {}),
  };
}

const classEnrollmentColumns = {
  id: classEnrollment.id,
  schoolId: classEnrollment.schoolId,
  studentId: classEnrollment.studentId,
  classroomId: classEnrollment.classroomId,
  academicYearId: classEnrollment.academicYearId,
  status: classEnrollment.status,
  enrollmentDate: classEnrollment.enrollmentDate,
  exitDate: classEnrollment.exitDate,
  reason: classEnrollment.reason,
  deletedAt: classEnrollment.deletedAt,
  recordVersion: classEnrollment.recordVersion,
};
