import { and, eq, isNull, sql } from 'drizzle-orm';
import type { RepositoryExecutor, TenantContext } from './base.js';
import { TenantScopedRepository } from './base.js';
import { school } from '../schema.sqlite.js';
import type { SchoolSetupStatus } from '@edutrack/shared';

export interface SafeSchoolRecord {
  id: string;
  code: string;
  name: string;
  shortName: string | null;
  logoUrl: string | null;
  address: string | null;
  city: string | null;
  country: string;
  phone: string | null;
  email: string | null;
  motto: string | null;
  ministryCode: string | null;
  locale: string;
  timezone: string;
  currency: string;
  setupStatus: SchoolSetupStatus;
}

export interface UpdateSchoolProfileInput {
  name: string;
  shortName: string | null;
  logoUrl: string | null;
  address: string | null;
  city: string;
  phone: string | null;
  email: string | null;
  motto: string | null;
  ministryCode: string | null;
}

/** Reads active school records needed before tenant context exists. */
export class SchoolRepository {
  constructor(private readonly db: RepositoryExecutor) {}

  findActiveByCode(code: string) {
    return this.db
      .select(safeSchoolColumns)
      .from(school)
      .where(and(eq(school.code, code), isNull(school.deletedAt)))
      .get();
  }
}

/** Owns updates to the authenticated school's local profile and setup status. */
export class TenantSchoolRepository extends TenantScopedRepository {
  findActive() {
    return this.db
      .select(safeSchoolColumns)
      .from(school)
      .where(and(eq(school.id, this.schoolId), isNull(school.deletedAt)))
      .get();
  }

  updateProfile(input: UpdateSchoolProfileInput, updatedAt: string) {
    return this.db
      .update(school)
      .set({
        ...input,
        country: 'TD',
        locale: 'fr',
        timezone: 'Africa/Ndjamena',
        currency: 'XAF',
        updatedAt,
        recordVersion: sql`${school.recordVersion} + 1`,
      })
      .where(and(eq(school.id, this.schoolId), isNull(school.deletedAt)))
      .returning(safeSchoolColumns)
      .get();
  }

  updateSetupStatus(setupStatus: SchoolSetupStatus, updatedAt: string) {
    return this.db
      .update(school)
      .set({
        setupStatus,
        updatedAt,
        recordVersion: sql`${school.recordVersion} + 1`,
      })
      .where(and(eq(school.id, this.schoolId), isNull(school.deletedAt)))
      .returning(safeSchoolColumns)
      .get();
  }
}

export function createSchoolRepository(db: RepositoryExecutor) {
  return new SchoolRepository(db);
}

export function createTenantSchoolRepository(db: RepositoryExecutor, tenant: TenantContext) {
  return new TenantSchoolRepository(db, tenant);
}

const safeSchoolColumns = {
  id: school.id,
  code: school.code,
  name: school.name,
  shortName: school.shortName,
  logoUrl: school.logoUrl,
  address: school.address,
  city: school.city,
  country: school.country,
  phone: school.phone,
  email: school.email,
  motto: school.motto,
  ministryCode: school.ministryCode,
  locale: school.locale,
  timezone: school.timezone,
  currency: school.currency,
  setupStatus: school.setupStatus,
};
