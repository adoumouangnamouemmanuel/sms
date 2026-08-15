import { and, asc, eq, isNull, like, or, sql } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import type { RepositoryExecutor, TenantContext } from './base.js';
import { TenantScopedRepository } from './base.js';
import { teacher } from '../schema.sqlite.js';

// TODO(roadmap §9.2/9.3): the default teacher code follows the student pattern
// `{school.code}-{academicYear}-{NNI}`, generated at the service layer; an explicitly
// provided code (e.g. from the Excel import) overrides the default. The exact pattern
// is pending confirmation before the create/import slices land.

export interface CreateTeacherInput {
  code: string;
  firstName: string;
  lastName: string;
  specialization?: string | null;
  hireDate?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  userId?: string | null;
}

export interface UpdateTeacherInput {
  firstName?: string;
  lastName?: string;
  specialization?: string | null;
  hireDate?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  userId?: string | null;
}

export interface TeacherRecord {
  id: string;
  schoolId: string;
  code: string;
  firstName: string;
  lastName: string;
  specialization: string | null;
  hireDate: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  userId: string | null;
  isActive: boolean;
  deletedAt: string | null;
  recordVersion: number;
}

export interface ListTeachersOptions {
  search?: string;
  limit?: number;
  offset?: number;
}

/**
 * Persists tenant-scoped teacher records. Record status (is_active) is independent from
 * the linked login account status; codes are durable identity and never reused.
 */
export class TeacherRepository extends TenantScopedRepository {
  create(input: CreateTeacherInput) {
    return this.db
      .insert(teacher)
      .values({
        id: randomUUID(),
        schoolId: this.schoolId,
        ...normalizeTeacherCreate(input),
      })
      .returning(teacherColumns)
      .get();
  }

  findById(id: string) {
    return this.db
      .select(teacherColumns)
      .from(teacher)
      .where(and(eq(teacher.id, id), eq(teacher.schoolId, this.schoolId)))
      .get();
  }

  findByCode(code: string) {
    return this.db
      .select(teacherColumns)
      .from(teacher)
      .where(and(eq(teacher.code, code), eq(teacher.schoolId, this.schoolId)))
      .get();
  }

  listActive(options: ListTeachersOptions = {}) {
    const search = options.search?.trim();
    const limit = options.limit ?? 50;
    const offset = options.offset ?? 0;

    return this.db
      .select(teacherColumns)
      .from(teacher)
      .where(
        and(
          eq(teacher.schoolId, this.schoolId),
          eq(teacher.isActive, true),
          isNull(teacher.deletedAt),
          search
            ? or(like(teacher.firstName, `%${search}%`), like(teacher.lastName, `%${search}%`))
            : undefined
        )
      )
      .orderBy(asc(teacher.lastName), asc(teacher.firstName), asc(teacher.code))
      .limit(limit)
      .offset(offset)
      .all();
  }

  update(id: string, input: UpdateTeacherInput, updatedAt: string) {
    return this.db
      .update(teacher)
      .set({
        ...pickDefinedTeacherFields(input),
        updatedAt,
        recordVersion: sql`${teacher.recordVersion} + 1`,
      })
      .where(and(eq(teacher.id, id), eq(teacher.schoolId, this.schoolId)))
      .returning(teacherColumns)
      .get();
  }

  archive(id: string, updatedAt: string) {
    return this.db
      .update(teacher)
      .set({
        isActive: false,
        deletedAt: updatedAt,
        updatedAt,
        recordVersion: sql`${teacher.recordVersion} + 1`,
      })
      .where(and(eq(teacher.id, id), eq(teacher.schoolId, this.schoolId)))
      .returning(teacherColumns)
      .get();
  }

  reactivate(id: string, updatedAt: string) {
    return this.db
      .update(teacher)
      .set({
        isActive: true,
        deletedAt: null,
        updatedAt,
        recordVersion: sql`${teacher.recordVersion} + 1`,
      })
      .where(and(eq(teacher.id, id), eq(teacher.schoolId, this.schoolId)))
      .returning(teacherColumns)
      .get();
  }
}

export function createTeacherRepository(db: RepositoryExecutor, tenant: TenantContext) {
  return new TeacherRepository(db, tenant);
}

function normalizeTeacherCreate(input: CreateTeacherInput) {
  return {
    code: input.code,
    firstName: input.firstName,
    lastName: input.lastName,
    specialization: input.specialization ?? null,
    hireDate: input.hireDate ?? null,
    phone: input.phone ?? null,
    email: input.email ?? null,
    address: input.address ?? null,
    userId: input.userId ?? null,
  };
}

/** Only fields explicitly provided are updated; omitted fields stay unchanged. */
function pickDefinedTeacherFields(input: UpdateTeacherInput) {
  return {
    ...(input.firstName !== undefined ? { firstName: input.firstName } : {}),
    ...(input.lastName !== undefined ? { lastName: input.lastName } : {}),
    ...(input.specialization !== undefined ? { specialization: input.specialization ?? null } : {}),
    ...(input.hireDate !== undefined ? { hireDate: input.hireDate ?? null } : {}),
    ...(input.phone !== undefined ? { phone: input.phone ?? null } : {}),
    ...(input.email !== undefined ? { email: input.email ?? null } : {}),
    ...(input.address !== undefined ? { address: input.address ?? null } : {}),
    ...(input.userId !== undefined ? { userId: input.userId ?? null } : {}),
  };
}

const teacherColumns = {
  id: teacher.id,
  schoolId: teacher.schoolId,
  code: teacher.code,
  firstName: teacher.firstName,
  lastName: teacher.lastName,
  specialization: teacher.specialization,
  hireDate: teacher.hireDate,
  phone: teacher.phone,
  email: teacher.email,
  address: teacher.address,
  userId: teacher.userId,
  isActive: teacher.isActive,
  deletedAt: teacher.deletedAt,
  recordVersion: teacher.recordVersion,
};
