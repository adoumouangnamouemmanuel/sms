import { and, asc, count, eq, isNull, like, or, sql } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import type { RepositoryExecutor, TenantContext } from './base.js';
import { TenantScopedRepository } from './base.js';
import { guardian } from '../schema.sqlite.js';

export interface CreateGuardianInput {
  firstName: string;
  lastName: string;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
}

export interface UpdateGuardianInput {
  firstName?: string;
  lastName?: string;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
}

export interface GuardianRecord {
  id: string;
  schoolId: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  isActive: boolean;
  deletedAt: string | null;
  recordVersion: number;
}

export interface ListGuardiansOptions {
  search?: string;
  limit?: number;
  offset?: number;
}

/** Persists tenant-scoped guardians; one guardian may be linked to several students. */
export class GuardianRepository extends TenantScopedRepository {
  create(input: CreateGuardianInput) {
    return this.db
      .insert(guardian)
      .values({
        id: randomUUID(),
        schoolId: this.schoolId,
        ...normalizeGuardianCreate(input),
      })
      .returning(guardianColumns)
      .get();
  }

  findById(id: string) {
    return this.db
      .select(guardianColumns)
      .from(guardian)
      .where(and(eq(guardian.id, id), eq(guardian.schoolId, this.schoolId)))
      .get();
  }

  listActive(options: ListGuardiansOptions = {}) {
    const search = options.search?.trim();
    const limit = options.limit ?? 50;
    const offset = options.offset ?? 0;

    return this.db
      .select(guardianColumns)
      .from(guardian)
      .where(activeGuardianWhere(this.schoolId, search))
      .orderBy(asc(guardian.lastName), asc(guardian.firstName))
      .limit(limit)
      .offset(offset)
      .all();
  }

  /** Total number of active guardians, used for stable pagination totals. */
  countActive(options: { search?: string } = {}) {
    const search = options.search?.trim();
    const row = this.db
      .select({ value: count() })
      .from(guardian)
      .where(activeGuardianWhere(this.schoolId, search))
      .get();

    return row?.value ?? 0;
  }

  update(id: string, input: UpdateGuardianInput, updatedAt: string) {
    return this.db
      .update(guardian)
      .set({
        ...pickDefinedGuardianFields(input),
        updatedAt,
        recordVersion: sql`${guardian.recordVersion} + 1`,
      })
      .where(and(eq(guardian.id, id), eq(guardian.schoolId, this.schoolId)))
      .returning(guardianColumns)
      .get();
  }

  archive(id: string, updatedAt: string) {
    return this.db
      .update(guardian)
      .set({
        isActive: false,
        deletedAt: updatedAt,
        updatedAt,
        recordVersion: sql`${guardian.recordVersion} + 1`,
      })
      .where(and(eq(guardian.id, id), eq(guardian.schoolId, this.schoolId)))
      .returning(guardianColumns)
      .get();
  }

  reactivate(id: string, updatedAt: string) {
    return this.db
      .update(guardian)
      .set({
        isActive: true,
        deletedAt: null,
        updatedAt,
        recordVersion: sql`${guardian.recordVersion} + 1`,
      })
      .where(and(eq(guardian.id, id), eq(guardian.schoolId, this.schoolId)))
      .returning(guardianColumns)
      .get();
  }
}

export function createGuardianRepository(db: RepositoryExecutor, tenant: TenantContext) {
  return new GuardianRepository(db, tenant);
}

function activeGuardianWhere(schoolId: string, search: string | undefined) {
  return and(
    eq(guardian.schoolId, schoolId),
    eq(guardian.isActive, true),
    isNull(guardian.deletedAt),
    search
      ? or(like(guardian.firstName, `%${search}%`), like(guardian.lastName, `%${search}%`))
      : undefined
  );
}

function normalizeGuardianCreate(input: CreateGuardianInput) {
  return {
    firstName: input.firstName,
    lastName: input.lastName,
    phone: input.phone ?? null,
    email: input.email ?? null,
    address: input.address ?? null,
  };
}

/** Only fields explicitly provided are updated; omitted fields stay unchanged. */
function pickDefinedGuardianFields(input: UpdateGuardianInput) {
  return {
    ...(input.firstName !== undefined ? { firstName: input.firstName } : {}),
    ...(input.lastName !== undefined ? { lastName: input.lastName } : {}),
    ...(input.phone !== undefined ? { phone: input.phone ?? null } : {}),
    ...(input.email !== undefined ? { email: input.email ?? null } : {}),
    ...(input.address !== undefined ? { address: input.address ?? null } : {}),
  };
}

const guardianColumns = {
  id: guardian.id,
  schoolId: guardian.schoolId,
  firstName: guardian.firstName,
  lastName: guardian.lastName,
  phone: guardian.phone,
  email: guardian.email,
  address: guardian.address,
  isActive: guardian.isActive,
  deletedAt: guardian.deletedAt,
  recordVersion: guardian.recordVersion,
};
