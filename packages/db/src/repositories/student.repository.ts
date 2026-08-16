import { and, asc, count, eq, inArray, isNotNull, isNull, like, or, sql } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import type { PersonSex } from '@edutrack/shared';
import type { RepositoryExecutor, TenantContext } from './base.js';
import { TenantScopedRepository } from './base.js';
import { academicYear, classEnrollment, classroom, student } from '../schema.sqlite.js';

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
  /** 'archived' lists archived records; omitted or 'active' lists active ones. */
  status?: 'active' | 'archived';
  /** Only students with an ACTIVE enrollment this year in a classroom of this level. */
  classLevelId?: string;
  /** Only students with an ACTIVE enrollment this year in this classroom. */
  classroomId?: string;
  sex?: PersonSex;
  limit?: number;
  offset?: number;
}

export interface CountStudentsOptions {
  search?: string;
  status?: 'active' | 'archived';
  classLevelId?: string;
  classroomId?: string;
  sex?: PersonSex;
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

  /** Batch lookup so roster-style reads never issue one query per student. */
  findByIds(ids: string[]) {
    if (ids.length === 0) {
      return [];
    }

    return this.db
      .select(studentColumns)
      .from(student)
      .where(and(eq(student.schoolId, this.schoolId), inArray(student.id, ids)))
      .all();
  }

  findByIdWithClassroom(id: string) {
    const currentYearId = this.db
      .select({ id: academicYear.id })
      .from(academicYear)
      .where(
        and(
          eq(academicYear.schoolId, this.schoolId),
          eq(academicYear.isCurrent, true),
          isNull(academicYear.deletedAt)
        )
      )
      .get()?.id;

    const row = this.db
      .select({
        student: studentColumns,
        classroom: {
          id: classroom.id,
          code: classroom.code,
          name: classroom.name,
        },
      })
      .from(student)
      .leftJoin(
        classEnrollment,
        and(
          eq(classEnrollment.schoolId, this.schoolId),
          eq(classEnrollment.studentId, student.id),
          eq(classEnrollment.academicYearId, currentYearId ?? ''),
          eq(classEnrollment.status, 'ACTIVE'),
          isNull(classEnrollment.deletedAt)
        )
      )
      .leftJoin(
        classroom,
        and(
          eq(classroom.schoolId, this.schoolId),
          eq(classroom.id, classEnrollment.classroomId)
        )
      )
      .where(and(eq(student.id, id), eq(student.schoolId, this.schoolId)))
      .get();

    if (!row) return undefined;

    return {
      ...row.student,
      currentClassroom: row.classroom?.id
        ? { id: row.classroom.id, name: row.classroom.name ?? row.classroom.code }
        : null,
    };
  }

  findByCode(code: string) {
    return this.db
      .select(studentColumns)
      .from(student)
      .where(and(eq(student.code, code), eq(student.schoolId, this.schoolId)))
      .get();
  }

  /**
   * Case-insensitive exact full-name match, including archived rows: used by the
   * import slice to block duplicate people when no code identity is available
   * (codes stay the strong identity whenever they exist).
   */
  findByName(firstName: string, lastName: string) {
    const trimmedFirstName = firstName.trim();
    const trimmedLastName = lastName.trim();

    return this.db
      .select(studentColumns)
      .from(student)
      .where(
        and(
          eq(student.schoolId, this.schoolId),
          sql`lower(${student.firstName}) = lower(${trimmedFirstName})`,
          sql`lower(${student.lastName}) = lower(${trimmedLastName})`
        )
      )
      .get();
  }

  list(options: ListStudentsOptions = {}) {
    const search = options.search?.trim();
    const limit = options.limit ?? 50;
    const offset = options.offset ?? 0;

    return this.db
      .select(studentColumns)
      .from(student)
      .where(
        and(
          studentWhere(this.schoolId, search, options.status, options.sex),
          this.enrollmentFilter(options)
        )
      )
      .orderBy(asc(student.lastName), asc(student.firstName), asc(student.code))
      .limit(limit)
      .offset(offset)
      .all();
  }

  listWithClassrooms(options: ListStudentsOptions = {}) {
    const search = options.search?.trim();
    const limit = options.limit ?? 50;
    const offset = options.offset ?? 0;

    const currentYearId = this.db
      .select({ id: academicYear.id })
      .from(academicYear)
      .where(
        and(
          eq(academicYear.schoolId, this.schoolId),
          eq(academicYear.isCurrent, true),
          isNull(academicYear.deletedAt)
        )
      )
      .get()?.id;

    const query = this.db
      .select({
        student: studentColumns,
        classroom: {
          id: classroom.id,
          code: classroom.code,
          name: classroom.name,
        },
      })
      .from(student)
      .leftJoin(
        classEnrollment,
        and(
          eq(classEnrollment.schoolId, this.schoolId),
          eq(classEnrollment.studentId, student.id),
          eq(classEnrollment.academicYearId, currentYearId ?? ''),
          eq(classEnrollment.status, 'ACTIVE'),
          isNull(classEnrollment.deletedAt)
        )
      )
      .leftJoin(
        classroom,
        and(
          eq(classroom.schoolId, this.schoolId),
          eq(classroom.id, classEnrollment.classroomId)
        )
      )
      .where(
        and(
          studentWhere(this.schoolId, search, options.status, options.sex),
          this.enrollmentFilter(options)
        )
      )
      .orderBy(asc(student.lastName), asc(student.firstName), asc(student.code))
      .limit(limit)
      .offset(offset);

    return query.all().map((row) => ({
      ...row.student,
      currentClassroom: row.classroom?.id
        ? { id: row.classroom.id, name: row.classroom.name ?? row.classroom.code }
        : null,
    }));
  }

  /** Total students matching the list filters, used for stable pagination totals. */
  count(options: CountStudentsOptions = {}) {
    const search = options.search?.trim();
    const row = this.db
      .select({ value: count() })
      .from(student)
      .where(
        and(
          studentWhere(this.schoolId, search, options.status, options.sex),
          this.enrollmentFilter(options)
        )
      )
      .get();

    return row?.value ?? 0;
  }

  /**
   * Restricts the list to students with an ACTIVE enrollment in the current
   * academic year, optionally narrowed to a classroom or a class level. The
   * filter queries the enrollment relationship (never a raw student field), so
   * it stays correct once transfers and year rollovers exist.
   */
  private enrollmentFilter(options: { classLevelId?: string; classroomId?: string }) {
    const { classLevelId, classroomId } = options;

    if (!classLevelId && !classroomId) {
      return undefined;
    }

    const currentYear = this.db
      .select({ id: academicYear.id })
      .from(academicYear)
      .where(
        and(
          eq(academicYear.schoolId, this.schoolId),
          eq(academicYear.isCurrent, true),
          isNull(academicYear.deletedAt)
        )
      )
      .get();

    if (!currentYear) {
      return sql`1 = 0`;
    }

    return sql`exists (
      select 1
      from ${classEnrollment} ce
      join ${classroom} cr on cr.id = ce.classroom_id
      where ce.school_id = ${this.schoolId}
        and ce.academic_year_id = ${currentYear.id}
        and ce.status = 'ACTIVE'
        and ce.deleted_at is null
        and ce.student_id = ${student.id}
        ${classLevelId ? sql`and cr.class_level_id = ${classLevelId}` : sql``}
        ${classroomId ? sql`and ce.classroom_id = ${classroomId}` : sql``}
    )`;
  }

  listActive(options: ListStudentsOptions = {}) {
    return this.list({ ...options, status: 'active' });
  }

  /** Total number of active students, used for stable pagination totals. */
  countActive(options: CountStudentsOptions = {}) {
    return this.count({ ...options, status: 'active' });
  }

  /**
   * Total student rows for the school including archived ones. Codes are
   * durable and never reused, so this drives the sequential NNI fallback.
   */
  countAll() {
    const row = this.db
      .select({ value: count() })
      .from(student)
      .where(eq(student.schoolId, this.schoolId))
      .get();

    return row?.value ?? 0;
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

function studentWhere(
  schoolId: string,
  search: string | undefined,
  status: 'active' | 'archived' | undefined,
  sex?: PersonSex
) {
  const archived = status === 'archived';

  return and(
    eq(student.schoolId, schoolId),
    eq(student.isActive, !archived),
    archived ? isNotNull(student.deletedAt) : isNull(student.deletedAt),
    sex ? eq(student.sex, sex) : undefined,
    search
      ? or(
          like(student.firstName, `%${search}%`),
          like(student.lastName, `%${search}%`),
          like(student.code, `%${search}%`)
        )
      : undefined
  );
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
