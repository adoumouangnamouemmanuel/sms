import type { EduTrackDatabase, EduTrackTransaction } from '../client';

export type RepositoryExecutor = EduTrackDatabase | EduTrackTransaction;

export interface TenantContext {
  schoolId: string;
}

/** Creates the trusted tenant boundary used by all tenant-owned repositories. */
export function createTenantContext(schoolId: string): TenantContext {
  const trimmedSchoolId = schoolId.trim();

  if (!trimmedSchoolId) {
    throw new Error('Tenant context requires a non-empty schoolId.');
  }

  return { schoolId: trimmedSchoolId };
}

/** Base class for repositories that must never query outside one school. */
export class TenantScopedRepository {
  protected readonly schoolId: string;

  constructor(
    protected readonly db: RepositoryExecutor,
    tenant: TenantContext
  ) {
    this.schoolId = createTenantContext(tenant.schoolId).schoolId;
  }
}
