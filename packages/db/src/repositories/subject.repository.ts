import { and, asc, count, eq, isNotNull, isNull, like, or, sql } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import type { SubjectCategory } from '@edutrack/shared';
import type { RepositoryExecutor, TenantContext } from './base.js';
import { TenantScopedRepository } from './base.js';
import { subject } from '../schema.sqlite.js';

export interface CreateSubjectInput {
  code: string;
  name: string;
  category: SubjectCategory;
  nameEn?: string | null;
  nameAr?: string | null;
  shortLabel?: string | null;
}

export interface UpdateSubjectInput {
  name?: string;
  category?: SubjectCategory;
  nameEn?: string | null;
  nameAr?: string | null;
  shortLabel?: string | null;
}

export interface SubjectRecord {
  id: string;
  schoolId: string;
  code: string;
  name: string;
  nameEn: string | null;
  nameAr: string | null;
  shortLabel: string | null;
  category: SubjectCategory;
  isActive: boolean;
  deletedAt: string | null;
  recordVersion: number;
}

export interface ListSubjectsOptions {
  search?: string;
  category?: SubjectCategory;
  /** 'archived' lists archived records; omitted or 'active' lists active ones. */
  status?: 'active' | 'archived';
  limit?: number;
  offset?: number;
}

export interface CountSubjectsOptions {
  search?: string;
  category?: SubjectCategory;
  status?: 'active' | 'archived';
}

/** Persists the tenant-scoped school subject catalogue. */
export class SubjectRepository extends TenantScopedRepository {
  create(input: CreateSubjectInput) {
    return this.db
      .insert(subject)
      .values({
        id: randomUUID(),
        schoolId: this.schoolId,
        ...normalizeSubjectCreate(input),
      })
      .returning(subjectColumns)
      .get();
  }

  findById(id: string) {
    return this.db
      .select(subjectColumns)
      .from(subject)
      .where(and(eq(subject.id, id), eq(subject.schoolId, this.schoolId)))
      .get();
  }

  findByCode(code: string) {
    return this.db
      .select(subjectColumns)
      .from(subject)
      .where(and(eq(subject.code, code), eq(subject.schoolId, this.schoolId)))
      .get();
  }

  list(options: ListSubjectsOptions = {}) {
    const search = options.search?.trim();
    const limit = options.limit ?? 50;
    const offset = options.offset ?? 0;

    return this.db
      .select(subjectColumns)
      .from(subject)
      .where(subjectWhere(this.schoolId, search, options.category, options.status))
      .orderBy(asc(subject.name), asc(subject.code))
      .limit(limit)
      .offset(offset)
      .all();
  }

  count(options: CountSubjectsOptions = {}) {
    const search = options.search?.trim();
    const row = this.db
      .select({ value: count() })
      .from(subject)
      .where(subjectWhere(this.schoolId, search, options.category, options.status))
      .get();

    return row?.value ?? 0;
  }

  update(id: string, input: UpdateSubjectInput, updatedAt: string) {
    return this.db
      .update(subject)
      .set({
        ...pickDefinedSubjectFields(input),
        updatedAt,
        recordVersion: sql`${subject.recordVersion} + 1`,
      })
      .where(and(eq(subject.id, id), eq(subject.schoolId, this.schoolId)))
      .returning(subjectColumns)
      .get();
  }

  archive(id: string, updatedAt: string) {
    return this.db
      .update(subject)
      .set({
        isActive: false,
        deletedAt: updatedAt,
        updatedAt,
        recordVersion: sql`${subject.recordVersion} + 1`,
      })
      .where(and(eq(subject.id, id), eq(subject.schoolId, this.schoolId)))
      .returning(subjectColumns)
      .get();
  }

  reactivate(id: string, updatedAt: string) {
    return this.db
      .update(subject)
      .set({
        isActive: true,
        deletedAt: null,
        updatedAt,
        recordVersion: sql`${subject.recordVersion} + 1`,
      })
      .where(and(eq(subject.id, id), eq(subject.schoolId, this.schoolId)))
      .returning(subjectColumns)
      .get();
  }
}

export function createSubjectRepository(db: RepositoryExecutor, tenant: TenantContext) {
  return new SubjectRepository(db, tenant);
}

function subjectWhere(
  schoolId: string,
  search: string | undefined,
  category: SubjectCategory | undefined,
  status: 'active' | 'archived' | undefined
) {
  const archived = status === 'archived';

  return and(
    eq(subject.schoolId, schoolId),
    eq(subject.isActive, !archived),
    archived ? isNotNull(subject.deletedAt) : isNull(subject.deletedAt),
    category ? eq(subject.category, category) : undefined,
    search ? or(like(subject.name, `%${search}%`), like(subject.code, `%${search}%`)) : undefined
  );
}

function normalizeSubjectCreate(input: CreateSubjectInput) {
  return {
    code: input.code,
    name: input.name,
    nameEn: input.nameEn ?? null,
    nameAr: input.nameAr ?? null,
    shortLabel: input.shortLabel ?? null,
    category: input.category,
  };
}

/** Only fields explicitly provided are updated; omitted fields stay unchanged. */
function pickDefinedSubjectFields(input: UpdateSubjectInput) {
  return {
    ...(input.name !== undefined ? { name: input.name } : {}),
    ...(input.category !== undefined ? { category: input.category } : {}),
    ...(input.nameEn !== undefined ? { nameEn: input.nameEn ?? null } : {}),
    ...(input.nameAr !== undefined ? { nameAr: input.nameAr ?? null } : {}),
    ...(input.shortLabel !== undefined ? { shortLabel: input.shortLabel ?? null } : {}),
  };
}

const subjectColumns = {
  id: subject.id,
  schoolId: subject.schoolId,
  code: subject.code,
  name: subject.name,
  nameEn: subject.nameEn,
  nameAr: subject.nameAr,
  shortLabel: subject.shortLabel,
  category: subject.category,
  isActive: subject.isActive,
  deletedAt: subject.deletedAt,
  recordVersion: subject.recordVersion,
};
