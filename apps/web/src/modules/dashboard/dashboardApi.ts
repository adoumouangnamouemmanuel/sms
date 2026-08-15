import { listGuardians, listStudents } from '../students/studentsApi';
import { listTeachers } from '../teachers/teachersApi';

/**
 * Real headcounts for the dashboard KPI cards. Each number comes from the
 * corresponding list endpoint's `total` (fetched with limit 1), so the
 * dashboard always reflects live data — never a cached snapshot.
 */
export interface DashboardCounts {
  studentsActive: number;
  studentsArchived: number;
  teachersActive: number;
  teachersArchived: number;
  guardiansActive: number;
  guardiansArchived: number;
}

export interface DashboardRequestOptions {
  capabilityToken?: string;
  fetcher?: typeof fetch;
}

export async function fetchDashboardCounts(
  apiBaseUrl: string,
  options: DashboardRequestOptions = {}
): Promise<DashboardCounts> {
  const request = { ...options };

  const [
    studentsActive,
    studentsArchived,
    teachersActive,
    teachersArchived,
    guardiansActive,
    guardiansArchived,
  ] = await Promise.all([
    listStudents(apiBaseUrl, { limit: 1, offset: 0, status: 'active' }, request),
    listStudents(apiBaseUrl, { limit: 1, offset: 0, status: 'archived' }, request),
    listTeachers(apiBaseUrl, { limit: 1, offset: 0, status: 'active' }, request),
    listTeachers(apiBaseUrl, { limit: 1, offset: 0, status: 'archived' }, request),
    listGuardians(apiBaseUrl, { limit: 1, offset: 0, status: 'active' }, request),
    listGuardians(apiBaseUrl, { limit: 1, offset: 0, status: 'archived' }, request),
  ]);

  return {
    studentsActive: studentsActive.total,
    studentsArchived: studentsArchived.total,
    teachersActive: teachersActive.total,
    teachersArchived: teachersArchived.total,
    guardiansActive: guardiansActive.total,
    guardiansArchived: guardiansArchived.total,
  };
}
