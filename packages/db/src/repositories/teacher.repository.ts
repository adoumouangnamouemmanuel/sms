import { and, asc, count, eq, isNotNull, isNull, like, or, sql, inArray } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import type { RepositoryExecutor, TenantContext } from './base.js';
import { TenantScopedRepository } from './base.js';
import { teacher, classSubject, classroom } from '../schema.sqlite.js';

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
  /** 'archived' lists archived records; omitted or 'active' lists active ones. */
  status?: 'active' | 'archived';
  limit?: number;
  offset?: number;
}

export interface CountTeachersOptions {
  search?: string;
  status?: 'active' | 'archived';
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

  findByIdWithClassrooms(id: string) {
    const teacherRow = this.findById(id);
    if (!teacherRow) return undefined;

    const classroomsRows = this.db
      .select({
        classroomId: classroom.id,
        classroomCode: classroom.code,
        classroomName: classroom.name,
      })
      .from(classSubject)
      .innerJoin(classroom, eq(classroom.id, classSubject.classroomId))
      .where(
        and(
          eq(classSubject.schoolId, this.schoolId),
          eq(classSubject.isActive, true),
          eq(classSubject.teacherId, id)
        )
      )
      .all();

    const uniqueClassroomsMap = new Map<string, { id: string; name: string }>();
    for (const row of classroomsRows) {
      uniqueClassroomsMap.set(row.classroomId, { id: row.classroomId, name: row.classroomName ?? row.classroomCode });
    }

    return {
      ...teacherRow,
      assignedClassrooms: Array.from(uniqueClassroomsMap.values()),
    };
  }

  findByCode(code: string) {
    return this.db
      .select(teacherColumns)
      .from(teacher)
      .where(and(eq(teacher.code, code), eq(teacher.schoolId, this.schoolId)))
      .get();
  }

  /**
   * Case-insensitive exact full-name match, including archived rows: used by the
   * import slice to block duplicate people when no code identity is available.
   */
  findByName(firstName: string, lastName: string) {
    const trimmedFirstName = firstName.trim();
    const trimmedLastName = lastName.trim();

    return this.db
      .select(teacherColumns)
      .from(teacher)
      .where(
        and(
          eq(teacher.schoolId, this.schoolId),
          sql`lower(${teacher.firstName}) = lower(${trimmedFirstName})`,
          sql`lower(${teacher.lastName}) = lower(${trimmedLastName})`
        )
      )
      .get();
  }

  /** Finds the teacher linked to a login account, regardless of record status. */
  findByUserId(userId: string) {
    return this.db
      .select(teacherColumns)
      .from(teacher)
      .where(and(eq(teacher.userId, userId), eq(teacher.schoolId, this.schoolId)))
      .get();
  }

  list(options: ListTeachersOptions = {}) {
    const search = options.search?.trim();
    const limit = options.limit ?? 50;
    const offset = options.offset ?? 0;

    return this.db
      .select(teacherColumns)
      .from(teacher)
      .where(teacherWhere(this.schoolId, search, options.status))
      .orderBy(asc(teacher.lastName), asc(teacher.firstName), asc(teacher.code))
      .limit(limit)
      .offset(offset)
      .all();
  }

  listWithAssignedClassrooms(options: ListTeachersOptions = {}) {
    const teachers = this.list(options);

    if (teachers.length === 0) return [];

    const teacherIds = teachers.map((t) => t.id);

    const classroomsRows = this.db
      .select({
        teacherId: classSubject.teacherId,
        classroomId: classroom.id,
        classroomCode: classroom.code,
        classroomName: classroom.name,
      })
      .from(classSubject)
      .innerJoin(classroom, eq(classroom.id, classSubject.classroomId))
      .where(
        and(
          eq(classSubject.schoolId, this.schoolId),
          eq(classSubject.isActive, true),
          inArray(classSubject.teacherId, teacherIds)
        )
      )
      .all();

    const classroomsByTeacher = classroomsRows.reduce((acc, row) => {
      if (!row.teacherId) return acc;
      if (!acc[row.teacherId]) {
        acc[row.teacherId] = new Map();
      }
      // Deduplicate classrooms since a teacher can teach multiple subjects in the same class
      acc[row.teacherId]!.set(row.classroomId, { id: row.classroomId, name: row.classroomName ?? row.classroomCode });
      return acc;
    }, {} as Record<string, Map<string, { id: string; name: string }>>);

    return teachers.map((teacher) => ({
      ...teacher,
      assignedClassrooms: classroomsByTeacher[teacher.id]
        ? Array.from(classroomsByTeacher[teacher.id]!.values())
        : [],
    }));
  }

  /** Total teachers matching the list filters, used for stable pagination totals. */
  count(options: CountTeachersOptions = {}) {
    const search = options.search?.trim();
    const row = this.db
      .select({ value: count() })
      .from(teacher)
      .where(teacherWhere(this.schoolId, search, options.status))
      .get();

    return row?.value ?? 0;
  }

  /**
   * Total teacher rows for the school including archived ones. Codes are
   * durable and never reused, so this drives the sequential NNI fallback.
   */
  countAll() {
    const row = this.db
      .select({ value: count() })
      .from(teacher)
      .where(eq(teacher.schoolId, this.schoolId))
      .get();

    return row?.value ?? 0;
  }

  listActive(options: ListTeachersOptions = {}) {
    return this.list({ ...options, status: 'active' });
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

function teacherWhere(
  schoolId: string,
  search: string | undefined,
  status: 'active' | 'archived' | undefined
) {
  const archived = status === 'archived';

  return and(
    eq(teacher.schoolId, schoolId),
    eq(teacher.isActive, !archived),
    archived ? isNotNull(teacher.deletedAt) : isNull(teacher.deletedAt),
    search
      ? or(
          like(teacher.firstName, `%${search}%`),
          like(teacher.lastName, `%${search}%`),
          like(teacher.code, `%${search}%`)
        )
      : undefined
  );
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
