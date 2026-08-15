import { and, eq, isNull, ne, sql } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import type { GuardianRelationshipType } from '@edutrack/shared';
import type { RepositoryExecutor, TenantContext } from './base.js';
import { TenantScopedRepository } from './base.js';
import { studentGuardian } from '../schema.sqlite.js';

export interface LinkStudentGuardianInput {
  studentId: string;
  guardianId: string;
  relationshipType: GuardianRelationshipType;
  isPrimary?: boolean;
  isEmergency?: boolean;
  notes?: string | null;
}

export interface UpdateStudentGuardianInput {
  relationshipType?: GuardianRelationshipType;
  isPrimary?: boolean;
  isEmergency?: boolean;
  notes?: string | null;
}

export interface StudentGuardianLinkRecord {
  id: string;
  schoolId: string;
  studentId: string;
  guardianId: string;
  relationshipType: GuardianRelationshipType;
  isPrimary: boolean;
  isEmergency: boolean;
  notes: string | null;
  deletedAt: string | null;
  recordVersion: number;
}

/**
 * Persists tenant-scoped student-guardian links. A guardian may link to several students
 * (siblings) and a student to several guardians, with at most one primary per student.
 * Unlinking soft-archives the link so the pair can be re-linked later.
 */
export class StudentGuardianRepository extends TenantScopedRepository {
  link(input: LinkStudentGuardianInput) {
    return this.db
      .insert(studentGuardian)
      .values({
        id: randomUUID(),
        schoolId: this.schoolId,
        studentId: input.studentId,
        guardianId: input.guardianId,
        relationshipType: input.relationshipType,
        isPrimary: input.isPrimary ?? false,
        isEmergency: input.isEmergency ?? false,
        notes: input.notes ?? null,
      })
      .returning(studentGuardianColumns)
      .get();
  }

  findById(id: string) {
    return this.db
      .select(studentGuardianColumns)
      .from(studentGuardian)
      .where(and(eq(studentGuardian.id, id), eq(studentGuardian.schoolId, this.schoolId)))
      .get();
  }

  listForStudent(studentId: string) {
    return this.db
      .select(studentGuardianColumns)
      .from(studentGuardian)
      .where(
        and(
          eq(studentGuardian.schoolId, this.schoolId),
          eq(studentGuardian.studentId, studentId),
          isNull(studentGuardian.deletedAt)
        )
      )
      .all();
  }

  listForGuardian(guardianId: string) {
    return this.db
      .select(studentGuardianColumns)
      .from(studentGuardian)
      .where(
        and(
          eq(studentGuardian.schoolId, this.schoolId),
          eq(studentGuardian.guardianId, guardianId),
          isNull(studentGuardian.deletedAt)
        )
      )
      .all();
  }

  update(id: string, input: UpdateStudentGuardianInput, updatedAt: string) {
    return this.db
      .update(studentGuardian)
      .set({
        ...pickDefinedLinkFields(input),
        updatedAt,
        recordVersion: sql`${studentGuardian.recordVersion} + 1`,
      })
      .where(and(eq(studentGuardian.id, id), eq(studentGuardian.schoolId, this.schoolId)))
      .returning(studentGuardianColumns)
      .get();
  }

  unlink(id: string, updatedAt: string) {
    return this.db
      .update(studentGuardian)
      .set({
        deletedAt: updatedAt,
        updatedAt,
        recordVersion: sql`${studentGuardian.recordVersion} + 1`,
      })
      .where(and(eq(studentGuardian.id, id), eq(studentGuardian.schoolId, this.schoolId)))
      .returning(studentGuardianColumns)
      .get();
  }

  /**
   * Clears the primary flag on every active link of a student, optionally
   * keeping one link untouched. Used to keep the at-most-one-primary invariant
   * when a new primary is chosen.
   */
  demotePrimary(studentId: string, exceptLinkId: string | undefined, updatedAt: string) {
    this.db
      .update(studentGuardian)
      .set({
        isPrimary: false,
        updatedAt,
        recordVersion: sql`${studentGuardian.recordVersion} + 1`,
      })
      .where(
        and(
          eq(studentGuardian.schoolId, this.schoolId),
          eq(studentGuardian.studentId, studentId),
          isNull(studentGuardian.deletedAt),
          exceptLinkId ? ne(studentGuardian.id, exceptLinkId) : undefined
        )
      )
      .run();
  }
}

export function createStudentGuardianRepository(db: RepositoryExecutor, tenant: TenantContext) {
  return new StudentGuardianRepository(db, tenant);
}

/** Only fields explicitly provided are updated; omitted fields stay unchanged. */
function pickDefinedLinkFields(input: UpdateStudentGuardianInput) {
  return {
    ...(input.relationshipType !== undefined ? { relationshipType: input.relationshipType } : {}),
    ...(input.isPrimary !== undefined ? { isPrimary: input.isPrimary } : {}),
    ...(input.isEmergency !== undefined ? { isEmergency: input.isEmergency } : {}),
    ...(input.notes !== undefined ? { notes: input.notes ?? null } : {}),
  };
}

const studentGuardianColumns = {
  id: studentGuardian.id,
  schoolId: studentGuardian.schoolId,
  studentId: studentGuardian.studentId,
  guardianId: studentGuardian.guardianId,
  relationshipType: studentGuardian.relationshipType,
  isPrimary: studentGuardian.isPrimary,
  isEmergency: studentGuardian.isEmergency,
  notes: studentGuardian.notes,
  deletedAt: studentGuardian.deletedAt,
  recordVersion: studentGuardian.recordVersion,
};
