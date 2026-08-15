import { and, asc, eq, isNull, like, or, sql } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import type { PersonSex } from '@edutrack/shared';
import type { RepositoryExecutor, TenantContext } from './base';
import { TenantScopedRepository } from './base';
import { student } from '../schema.sqlite';

// TODO(roadmap §9.2/9.3): the default student code is `{school.code}-{academicYear}-{NNI}`,
// generated at the service layer; an explicitly provided code (e.g. from the Excel import)
// overrides the default. The exact pattern is pending confirmation before the create/import
// slices land. Until then the repository stores whatever code the caller provides.

export interface CreateStudentInput {
  code: string;
  firstName: string;
  lastName: string;
  sex?: PersonSex | null;
  dateOfBirth?: string | null;
  placeOfBirth?: string | null;
  nationality?: string | null;
  photoUrl?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
}

export interface UpdateStudentInput {
  firstName?: string;
  lastName?: string;
  sex?: PersonSex | null;
  dateOfBirth?: string | null;
  placeOfBirth?: string | null;
  nationality?: string | null;
  photoUrl?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
}

export interface StudentRecord {
  id: string;
  schoolId: string;
  code: string;
  firstName: string;
  lastName: string;
  sex: PersonSex | null;
  dateOfBirth: string | null;
  placeOfBirth: string | null;
  nationality: string | null;
  photoUrl: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  isActive: boolean;
  deletedAt: string | null;
  recordVersion: number;
}

export interface ListStudentsOptions {
  search?: string;
  limit?: number;
  offset?: number;
}

/** Persists tenant-scoped student records; codes are durable identity and never reused. */
export class StudentRepository extends TenantScopedRepository {
  create(input: CreateStudentInput) {
    return this.db
      .insert(student)
      .values({
        id: randomUUID(),
        schoolId: this.schoolId,
        ...normalizeStudentCreate(input),
      })
      .returning(studentColumns)
      .get();
  }

  findById(id: string) {
    return this.db
      .select(studentColumns)
      .from(student)
      .where(and(eq(student.id, id), eq(student.schoolId, this.schoolId)))
      .get();
  }

  findByCode(code: string) {
    return this.db
      .select(studentColumns)
      .from(student)
      .where(and(eq(student.code, code), eq(student.schoolId, this.schoolId)))
      .get();
  }

  listActive(options: ListStudentsOptions = {}) {
    const search = options.search?.trim();
    const limit = options.limit ?? 50;
    const offset = options.offset ?? 0;

    return this.db
      .select(studentColumns)
      .from(student)
      .where(
        and(
          eq(student.schoolId, this.schoolId),
          eq(student.isActive, true),
          isNull(student.deletedAt),
          search
            ? or(like(student.firstName, `%${search}%`), like(student.lastName, `%${search}%`))
            : undefined
        )
      )
      .orderBy(asc(student.lastName), asc(student.firstName), asc(student.code))
      .limit(limit)
      .offset(offset)
      .all();
  }

  update(id: string, input: UpdateStudentInput, updatedAt: string) {
    return this.db
      .update(student)
      .set({
        ...pickDefinedStudentFields(input),
        updatedAt,
        recordVersion: sql`${student.recordVersion} + 1`,
      })
      .where(and(eq(student.id, id), eq(student.schoolId, this.schoolId)))
      .returning(studentColumns)
      .get();
  }

  archive(id: string, updatedAt: string) {
    return this.db
      .update(student)
      .set({
        isActive: false,
        deletedAt: updatedAt,
        updatedAt,
        recordVersion: sql`${student.recordVersion} + 1`,
      })
      .where(and(eq(student.id, id), eq(student.schoolId, this.schoolId)))
      .returning(studentColumns)
      .get();
  }

  reactivate(id: string, updatedAt: string) {
    return this.db
      .update(student)
      .set({
        isActive: true,
        deletedAt: null,
        updatedAt,
        recordVersion: sql`${student.recordVersion} + 1`,
      })
      .where(and(eq(student.id, id), eq(student.schoolId, this.schoolId)))
      .returning(studentColumns)
      .get();
  }
}

export function createStudentRepository(db: RepositoryExecutor, tenant: TenantContext) {
  return new StudentRepository(db, tenant);
}

function normalizeStudentCreate(input: CreateStudentInput) {
  return {
    code: input.code,
    firstName: input.firstName,
    lastName: input.lastName,
    sex: input.sex ?? null,
    dateOfBirth: input.dateOfBirth ?? null,
    placeOfBirth: input.placeOfBirth ?? null,
    nationality: input.nationality ?? null,
    photoUrl: input.photoUrl ?? null,
    phone: input.phone ?? null,
    email: input.email ?? null,
    address: input.address ?? null,
  };
}

/** Only fields explicitly provided are updated; omitted fields stay unchanged. */
function pickDefinedStudentFields(input: UpdateStudentInput) {
  return {
    ...(input.firstName !== undefined ? { firstName: input.firstName } : {}),
    ...(input.lastName !== undefined ? { lastName: input.lastName } : {}),
    ...(input.sex !== undefined ? { sex: input.sex ?? null } : {}),
    ...(input.dateOfBirth !== undefined ? { dateOfBirth: input.dateOfBirth ?? null } : {}),
    ...(input.placeOfBirth !== undefined ? { placeOfBirth: input.placeOfBirth ?? null } : {}),
    ...(input.nationality !== undefined ? { nationality: input.nationality ?? null } : {}),
    ...(input.photoUrl !== undefined ? { photoUrl: input.photoUrl ?? null } : {}),
    ...(input.phone !== undefined ? { phone: input.phone ?? null } : {}),
    ...(input.email !== undefined ? { email: input.email ?? null } : {}),
    ...(input.address !== undefined ? { address: input.address ?? null } : {}),
  };
}

const studentColumns = {
  id: student.id,
  schoolId: student.schoolId,
  code: student.code,
  firstName: student.firstName,
  lastName: student.lastName,
  sex: student.sex,
  dateOfBirth: student.dateOfBirth,
  placeOfBirth: student.placeOfBirth,
  nationality: student.nationality,
  photoUrl: student.photoUrl,
  phone: student.phone,
  email: student.email,
  address: student.address,
  isActive: student.isActive,
  deletedAt: student.deletedAt,
  recordVersion: student.recordVersion,
};
