import {
  SIDECAR_CAPABILITY_HEADER,
  type RecentAuditEvent,
  type RecentAuditEventsResponse,
} from '@edutrack/shared';
import { fetchWithTimeout } from '../../httpClient';
import { createAuthHeaders } from '../auth';
import { listClassrooms } from '../classes/classesApi';
import { listGuardians, listStudents } from '../students/studentsApi';
import { listTeachers } from '../teachers/teachersApi';

/**
 * Real dashboard data - never simulated. Headcounts come from the list
 * endpoints' `total`; the class distribution is aggregated from live
 * classrooms and their enrollment counts; the activity timeline is backed by
 * the tenant audit log.
 */
export interface DashboardCounts {
  studentsActive: number;
  studentsArchived: number;
  teachersActive: number;
  teachersArchived: number;
  guardiansActive: number;
  guardiansArchived: number;
}

export interface ClassDistributionItem {
  levelCode: string;
  levelName: string;
  classes: number;
  students: number;
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

/**
 * Real per-level breakdown: active classrooms of the current academic year,
 * each carrying its live enrollment count. Levels with no classroom simply
 * don't appear, exactly like the school's actual structure.
 */
export async function fetchClassDistribution(
  apiBaseUrl: string,
  academicYearId: string | undefined,
  options: DashboardRequestOptions = {}
): Promise<ClassDistributionItem[]> {
const byLevel = new Map<string, ClassDistributionItem>();
  const pageSize = 100;
  let offset = 0;

  // Page until the list is exhausted so tenants with more than 100 classrooms
  // get complete per-level totals (the list endpoint caps a single page).
  for (;;) {
    const response = await listClassrooms(
      apiBaseUrl,
      {
        limit: pageSize,
        offset,
        status: 'active',
        ...(academicYearId ? { academicYearId } : {}),
      },
      options
    );

    for (const view of response.items) {
      const entry = byLevel.get(view.classLevelCode) ?? {
        levelCode: view.classLevelCode,
        levelName: view.classLevelName,
        classes: 0,
        students: 0,
      };
      entry.classes += 1;
      entry.students += view.activeEnrollmentCount;
      byLevel.set(view.classLevelCode, entry);
    }

    if (response.items.length < pageSize) {
      break;
    }

    offset += pageSize;
  }

  return [...byLevel.values()];
}

/** Latest tenant audit events for the dashboard activity timeline. */
export async function fetchRecentActivity(
  apiBaseUrl: string,
  options: DashboardRequestOptions = {}
): Promise<RecentAuditEvent[]> {
  const fetcher = options.fetcher ?? fetch;
  let response: Response;

  try {
    response = await fetchWithTimeout(fetcher, `${apiBaseUrl}/audit/recent?limit=10`, {
      method: 'GET',
      credentials: 'include',
      headers: {
        ...createAuthHeaders(),
        ...(options.capabilityToken
          ? { [SIDECAR_CAPABILITY_HEADER]: options.capabilityToken }
          : {}),
      },
    });
  } catch {
    throw new Error('dashboard.activity.unavailable');
  }

  if (!response.ok) {
    // Carry the API error code (e.g. INVALID_ACCESS_TOKEN) so the dashboard can
    // route the user back to login instead of showing a generic failure.
    throw await readApiError(response, 'dashboard.activity.unavailable');
  }

  let payload: { success: boolean; data?: RecentAuditEventsResponse };

  try {
    payload = (await response.json()) as { success: boolean; data?: RecentAuditEventsResponse };
  } catch {
    throw new Error('dashboard.activity.unavailable');
  }

  if (!payload.success || !payload.data) {
    throw new Error('dashboard.activity.unavailable');
  }

  return payload.data.items;
}

async function readApiError(response: Response, fallbackMessage: string) {
  try {
    const payload = (await response.json()) as { error?: { code?: string; message?: string } };
    const error = new Error(payload.error?.message ?? fallbackMessage);

    if (payload.error?.code) {
      (error as Error & { code?: string }).code = payload.error.code;
    }

    return error;
  } catch {
    return new Error(fallbackMessage);
  }
}
