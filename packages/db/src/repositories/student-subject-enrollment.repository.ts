import { and, asc, count, eq, isNotNull, isNull, sql } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import type { RepositoryExecutor, TenantContext } from './base.js';
import { TenantScopedRepository } from './base.js';
import { studentSubjectEnrollment } from '../schema.sqlite.js';

export interface CreateStudentSubjectEnrollmentInput {
  classEnrollmentId: string;
  classSubjectId: string;
}

export interface StudentSubjectEnrollmentRecord {
  id: string;
  schoolId: string;
  classEnrollmentId: string;
  classSubjectId: string;
  isActive: boolean;
  deletedAt: string | null;
  recordVersion: number;
}

export interface ListStudentSubjectEnrollmentsOptions {
  classEnrollmentId?: string;
  classSubjectId?: string;
  /** 'archived' lists archived records; omitted or 'active' lists active ones. */
  status?: 'active' | 'archived';
  limit?: number;
  offset?: number;
}

export interface CountStudentSubjectEnrollmentsOptions {
  classEnrollmentId?: string;
  classSubjectId?: string;
  status?: 'active' | 'archived';
}

/**
 * Persists explicit student links to OPTIONAL class-subjects. The rule that a
 * link may only target an optional (is_required = false) class-subject lives
 * in the service layer (sms.md §11.4); this repository never interprets the
 * class-subject policy.
 */
export class StudentSubjectEnrollmentRepository extends TenantScopedRepository {
  create(input: CreateStudentSubjectEnrollmentInput) {
    return this.db
      .insert(studentSubjectEnrollment)
      .values({
        id: randomUUID(),
        schoolId: this.schoolId,
        classEnrollmentId: input.classEnrollmentId,
        classSubjectId: input.classSubjectId,
      })
      .returning(studentSubjectEnrollmentColumns)
      .get();
  }

  findById(id: string) {
    return this.db
      .select(studentSubjectEnrollmentColumns)
      .from(studentSubjectEnrollment)
      .where(
        and(
          eq(studentSubjectEnrollment.id, id),
          eq(studentSubjectEnrollment.schoolId, this.schoolId)
        )
      )
      .get();
  }

  findByEnrollmentSubject(classEnrollmentId: string, classSubjectId: string) {
    return this.db
      .select(studentSubjectEnrollmentColumns)
      .from(studentSubjectEnrollment)
      .where(
        and(
          eq(studentSubjectEnrollment.schoolId, this.schoolId),
          eq(studentSubjectEnrollment.classEnrollmentId, classEnrollmentId),
          eq(studentSubjectEnrollment.classSubjectId, classSubjectId),
          // Only live links count as duplicates: an archived link must not
          // block re-enrolling the same optional subject.
          eq(studentSubjectEnrollment.isActive, true),
          isNull(studentSubjectEnrollment.deletedAt)
        )
      )
      .get();
  }

  list(options: ListStudentSubjectEnrollmentsOptions = {}) {
    const limit = options.limit ?? 50;
    const offset = options.offset ?? 0;

    return this.db
      .select(studentSubjectEnrollmentColumns)
      .from(studentSubjectEnrollment)
      .where(studentSubjectEnrollmentWhere(this.schoolId, options))
      .orderBy(asc(studentSubjectEnrollment.classSubjectId))
      .limit(limit)
      .offset(offset)
      .all();
  }

  count(options: CountStudentSubjectEnrollmentsOptions = {}) {
    const row = this.db
      .select({ value: count() })
      .from(studentSubjectEnrollment)
      .where(studentSubjectEnrollmentWhere(this.schoolId, options))
      .get();

    return row?.value ?? 0;
  }

  archive(id: string, updatedAt: string) {
    return this.db
      .update(studentSubjectEnrollment)
      .set({
        isActive: false,
        deletedAt: updatedAt,
        updatedAt,
        recordVersion: sql`${studentSubjectEnrollment.recordVersion} + 1`,
      })
      .where(
        and(
          eq(studentSubjectEnrollment.id, id),
          eq(studentSubjectEnrollment.schoolId, this.schoolId)
        )
      )
      .returning(studentSubjectEnrollmentColumns)
      .get();
  }

  reactivate(id: string, updatedAt: string) {
    return this.db
      .update(studentSubjectEnrollment)
      .set({
        isActive: true,
        deletedAt: null,
        updatedAt,
        recordVersion: sql`${studentSubjectEnrollment.recordVersion} + 1`,
      })
      .where(
        and(
          eq(studentSubjectEnrollment.id, id),
          eq(studentSubjectEnrollment.schoolId, this.schoolId)
        )
      )
      .returning(studentSubjectEnrollmentColumns)
      .get();
  }
}

export function createStudentSubjectEnrollmentRepository(
  db: RepositoryExecutor,
  tenant: TenantContext
) {
  return new StudentSubjectEnrollmentRepository(db, tenant);
}

function studentSubjectEnrollmentWhere(
  schoolId: string,
  options: ListStudentSubjectEnrollmentsOptions | CountStudentSubjectEnrollmentsOptions
) {
  const archived = options.status === 'archived';

  return and(
    eq(studentSubjectEnrollment.schoolId, schoolId),
    eq(studentSubjectEnrollment.isActive, !archived),
    archived
      ? isNotNull(studentSubjectEnrollment.deletedAt)
      : isNull(studentSubjectEnrollment.deletedAt),
    options.classEnrollmentId
      ? eq(studentSubjectEnrollment.classEnrollmentId, options.classEnrollmentId)
      : undefined,
    options.classSubjectId
      ? eq(studentSubjectEnrollment.classSubjectId, options.classSubjectId)
      : undefined
  );
}

const studentSubjectEnrollmentColumns = {
  id: studentSubjectEnrollment.id,
  schoolId: studentSubjectEnrollment.schoolId,
  classEnrollmentId: studentSubjectEnrollment.classEnrollmentId,
  classSubjectId: studentSubjectEnrollment.classSubjectId,
  isActive: studentSubjectEnrollment.isActive,
  deletedAt: studentSubjectEnrollment.deletedAt,
  recordVersion: studentSubjectEnrollment.recordVersion,
};
