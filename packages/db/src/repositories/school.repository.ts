import { and, eq, isNull } from 'drizzle-orm';
import type { RepositoryExecutor } from './base';
import { school } from '../schema.sqlite';

export interface SafeSchoolRecord {
  id: string;
  code: string;
  name: string;
  shortName: string | null;
  setupStatus: string;
  locale: string;
  timezone: string;
  currency: string;
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

export function createSchoolRepository(db: RepositoryExecutor) {
  return new SchoolRepository(db);
}

const safeSchoolColumns = {
  id: school.id,
  code: school.code,
  name: school.name,
  shortName: school.shortName,
  setupStatus: school.setupStatus,
  locale: school.locale,
  timezone: school.timezone,
  currency: school.currency,
};
