import { and, asc, count, eq, isNotNull, isNull, sql } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import type { RepositoryExecutor, TenantContext } from './base.js';
import { TenantScopedRepository } from './base.js';
import { classSubject } from '../schema.sqlite.js';

export interface CreateClassSubjectInput {
  classroomId: string;
  subjectId: string;
  coefficient: number;
  isRequired?: boolean;
  teacherId?: string | null;
}

export interface UpdateClassSubjectInput {
  coefficient?: number;
  isRequired?: boolean;
  teacherId?: string | null;
}

export interface ClassSubjectRecord {
  id: string;
  schoolId: string;
  classroomId: string;
  subjectId: string;
  coefficient: number;
  isRequired: boolean;
  teacherId: string | null;
  isActive: boolean;
  deletedAt: string | null;
  recordVersion: number;
}

export interface ListClassSubjectsOptions {
  classroomId?: string;
  teacherId?: string;
  /** 'archived' lists archived records; omitted or 'active' lists active ones. */
  status?: 'active' | 'archived';
  limit?: number;
  offset?: number;
}

export interface CountClassSubjectsOptions {
  classroomId?: string;
  teacherId?: string;
  status?: 'active' | 'archived';
}

/** Persists subject/coefficient/teacher assignments for a classroom. */
export class ClassSubjectRepository extends TenantScopedRepository {
  create(input: CreateClassSubjectInput) {
    return this.db
      .insert(classSubject)
      .values({
        id: randomUUID(),
        schoolId: this.schoolId,
        ...normalizeClassSubjectCreate(input),
      })
      .returning(classSubjectColumns)
      .get();
  }

  findById(id: string) {
    return this.db
      .select(classSubjectColumns)
      .from(classSubject)
      .where(and(eq(classSubject.id, id), eq(classSubject.schoolId, this.schoolId)))
      .get();
  }

  findByClassroomSubject(classroomId: string, subjectId: string) {
    return this.db
      .select(classSubjectColumns)
      .from(classSubject)
      .where(
        and(
          eq(classSubject.schoolId, this.schoolId),
          eq(classSubject.classroomId, classroomId),
          eq(classSubject.subjectId, subjectId)
        )
      )
      .get();
  }

  list(options: ListClassSubjectsOptions = {}) {
    const limit = options.limit ?? 50;
    const offset = options.offset ?? 0;

    return this.db
      .select(classSubjectColumns)
      .from(classSubject)
      .where(classSubjectWhere(this.schoolId, options))
      .orderBy(asc(classSubject.subjectId))
      .limit(limit)
      .offset(offset)
      .all();
  }

  count(options: CountClassSubjectsOptions = {}) {
    const row = this.db
      .select({ value: count() })
      .from(classSubject)
      .where(classSubjectWhere(this.schoolId, options))
      .get();

    return row?.value ?? 0;
  }

  update(id: string, input: UpdateClassSubjectInput, updatedAt: string) {
    return this.db
      .update(classSubject)
      .set({
        ...pickDefinedClassSubjectFields(input),
        updatedAt,
        recordVersion: sql`${classSubject.recordVersion} + 1`,
      })
      .where(and(eq(classSubject.id, id), eq(classSubject.schoolId, this.schoolId)))
      .returning(classSubjectColumns)
      .get();
  }

  archive(id: string, updatedAt: string) {
    return this.db
      .update(classSubject)
      .set({
        isActive: false,
        deletedAt: updatedAt,
        updatedAt,
        recordVersion: sql`${classSubject.recordVersion} + 1`,
      })
      .where(and(eq(classSubject.id, id), eq(classSubject.schoolId, this.schoolId)))
      .returning(classSubjectColumns)
      .get();
  }

  reactivate(id: string, updatedAt: string) {
    return this.db
      .update(classSubject)
      .set({
        isActive: true,
        deletedAt: null,
        updatedAt,
        recordVersion: sql`${classSubject.recordVersion} + 1`,
      })
      .where(and(eq(classSubject.id, id), eq(classSubject.schoolId, this.schoolId)))
      .returning(classSubjectColumns)
      .get();
  }
}

export function createClassSubjectRepository(db: RepositoryExecutor, tenant: TenantContext) {
  return new ClassSubjectRepository(db, tenant);
}

function classSubjectWhere(
  schoolId: string,
  options: ListClassSubjectsOptions | CountClassSubjectsOptions
) {
  const archived = options.status === 'archived';

  return and(
    eq(classSubject.schoolId, schoolId),
    eq(classSubject.isActive, !archived),
    archived ? isNotNull(classSubject.deletedAt) : isNull(classSubject.deletedAt),
    options.classroomId ? eq(classSubject.classroomId, options.classroomId) : undefined,
    options.teacherId ? eq(classSubject.teacherId, options.teacherId) : undefined
  );
}

function normalizeClassSubjectCreate(input: CreateClassSubjectInput) {
  return {
    classroomId: input.classroomId,
    subjectId: input.subjectId,
    coefficient: input.coefficient,
    isRequired: input.isRequired ?? true,
    teacherId: input.teacherId ?? null,
  };
}

/** Only fields explicitly provided are updated; omitted fields stay unchanged. */
function pickDefinedClassSubjectFields(input: UpdateClassSubjectInput) {
  return {
    ...(input.coefficient !== undefined ? { coefficient: input.coefficient } : {}),
    ...(input.isRequired !== undefined ? { isRequired: input.isRequired } : {}),
    ...(input.teacherId !== undefined ? { teacherId: input.teacherId ?? null } : {}),
  };
}

const classSubjectColumns = {
  id: classSubject.id,
  schoolId: classSubject.schoolId,
  classroomId: classSubject.classroomId,
  subjectId: classSubject.subjectId,
  coefficient: classSubject.coefficient,
  isRequired: classSubject.isRequired,
  teacherId: classSubject.teacherId,
  isActive: classSubject.isActive,
  deletedAt: classSubject.deletedAt,
  recordVersion: classSubject.recordVersion,
};
