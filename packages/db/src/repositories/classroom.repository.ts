import { and, asc, count, eq, isNotNull, isNull, sql } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import type { RepositoryExecutor, TenantContext } from './base.js';
import { TenantScopedRepository } from './base.js';
import { classroom } from '../schema.sqlite.js';

export interface CreateClassroomInput {
  academicYearId: string;
  classLevelId: string;
  code: string;
  name?: string | null;
  capacity?: number | null;
}

export interface UpdateClassroomInput {
  classLevelId?: string;
  name?: string | null;
  capacity?: number | null;
}

export interface ClassroomRecord {
  id: string;
  schoolId: string;
  academicYearId: string;
  classLevelId: string;
  code: string;
  name: string | null;
  capacity: number | null;
  isActive: boolean;
  deletedAt: string | null;
  recordVersion: number;
}

export interface ListClassroomsOptions {
  academicYearId?: string;
  classLevelId?: string;
  /** 'archived' lists archived records; omitted or 'active' lists active ones. */
  status?: 'active' | 'archived';
  limit?: number;
  offset?: number;
}

export interface CountClassroomsOptions {
  academicYearId?: string;
  classLevelId?: string;
  status?: 'active' | 'archived';
}

/** Persists tenant-scoped cohorts/sections within an academic year. */
export class ClassroomRepository extends TenantScopedRepository {
  create(input: CreateClassroomInput) {
    return this.db
      .insert(classroom)
      .values({
        id: randomUUID(),
        schoolId: this.schoolId,
        ...normalizeClassroomCreate(input),
      })
      .returning(classroomColumns)
      .get();
  }

  findById(id: string) {
    return this.db
      .select(classroomColumns)
      .from(classroom)
      .where(and(eq(classroom.id, id), eq(classroom.schoolId, this.schoolId)))
      .get();
  }

  findByYearCode(academicYearId: string, code: string) {
    return this.db
      .select(classroomColumns)
      .from(classroom)
      .where(
        and(
          eq(classroom.schoolId, this.schoolId),
          eq(classroom.academicYearId, academicYearId),
          eq(classroom.code, code)
        )
      )
      .get();
  }

  list(options: ListClassroomsOptions = {}) {
    const limit = options.limit ?? 50;
    const offset = options.offset ?? 0;

    return this.db
      .select(classroomColumns)
      .from(classroom)
      .where(classroomWhere(this.schoolId, options))
      .orderBy(asc(classroom.code))
      .limit(limit)
      .offset(offset)
      .all();
  }

  count(options: CountClassroomsOptions = {}) {
    const row = this.db
      .select({ value: count() })
      .from(classroom)
      .where(classroomWhere(this.schoolId, options))
      .get();

    return row?.value ?? 0;
  }

  update(id: string, input: UpdateClassroomInput, updatedAt: string) {
    return this.db
      .update(classroom)
      .set({
        ...pickDefinedClassroomFields(input),
        updatedAt,
        recordVersion: sql`${classroom.recordVersion} + 1`,
      })
      .where(and(eq(classroom.id, id), eq(classroom.schoolId, this.schoolId)))
      .returning(classroomColumns)
      .get();
  }

  archive(id: string, updatedAt: string) {
    return this.db
      .update(classroom)
      .set({
        isActive: false,
        deletedAt: updatedAt,
        updatedAt,
        recordVersion: sql`${classroom.recordVersion} + 1`,
      })
      .where(and(eq(classroom.id, id), eq(classroom.schoolId, this.schoolId)))
      .returning(classroomColumns)
      .get();
  }

  reactivate(id: string, updatedAt: string) {
    return this.db
      .update(classroom)
      .set({
        isActive: true,
        deletedAt: null,
        updatedAt,
        recordVersion: sql`${classroom.recordVersion} + 1`,
      })
      .where(and(eq(classroom.id, id), eq(classroom.schoolId, this.schoolId)))
      .returning(classroomColumns)
      .get();
  }
}

export function createClassroomRepository(db: RepositoryExecutor, tenant: TenantContext) {
  return new ClassroomRepository(db, tenant);
}

function classroomWhere(schoolId: string, options: ListClassroomsOptions | CountClassroomsOptions) {
  const archived = options.status === 'archived';

  return and(
    eq(classroom.schoolId, schoolId),
    eq(classroom.isActive, !archived),
    archived ? isNotNull(classroom.deletedAt) : isNull(classroom.deletedAt),
    options.academicYearId ? eq(classroom.academicYearId, options.academicYearId) : undefined,
    options.classLevelId ? eq(classroom.classLevelId, options.classLevelId) : undefined
  );
}

function normalizeClassroomCreate(input: CreateClassroomInput) {
  return {
    academicYearId: input.academicYearId,
    classLevelId: input.classLevelId,
    code: input.code,
    name: input.name ?? null,
    capacity: input.capacity ?? null,
  };
}

/** Only fields explicitly provided are updated; omitted fields stay unchanged. */
function pickDefinedClassroomFields(input: UpdateClassroomInput) {
  return {
    ...(input.classLevelId !== undefined ? { classLevelId: input.classLevelId } : {}),
    ...(input.name !== undefined ? { name: input.name ?? null } : {}),
    ...(input.capacity !== undefined ? { capacity: input.capacity ?? null } : {}),
  };
}

const classroomColumns = {
  id: classroom.id,
  schoolId: classroom.schoolId,
  academicYearId: classroom.academicYearId,
  classLevelId: classroom.classLevelId,
  code: classroom.code,
  name: classroom.name,
  capacity: classroom.capacity,
  isActive: classroom.isActive,
  deletedAt: classroom.deletedAt,
  recordVersion: classroom.recordVersion,
};
