import {
  SIDECAR_CAPABILITY_HEADER,
  type ArchiveTeacherRequest,
  type CreateTeacherRequest,
  type PaginatedTeachersResponse,
  type TeacherListQuery,
  type TeacherLoginCreatedResponse,
  type TeacherProfileResponse,
  type TeacherResponse,
  type UpdateTeacherRequest,
} from '@edutrack/shared';
import { fetchWithTimeout } from '../../httpClient';
import { createAuthHeaders } from '../auth';
import { TeachersApiError } from './teachersErrors';

type Fetcher = typeof fetch;

export interface TeachersRequestOptions {
  capabilityToken?: string;
  fetcher?: Fetcher;
}

export async function listTeachers(
  apiBaseUrl: string,
  query: TeacherListQuery,
  options: TeachersRequestOptions = {}
) {
  const params = new URLSearchParams();
  params.set('limit', String(query.limit));
  params.set('offset', String(query.offset));

  if (query.search) {
    params.set('search', query.search);
  }

  if (query.status) {
    params.set('status', query.status);
  }

  return requestJson<PaginatedTeachersResponse>(apiBaseUrl, `/teachers?${params.toString()}`, {
    method: 'GET',
    options,
  });
}

export async function getTeacherProfile(
  apiBaseUrl: string,
  teacherId: string,
  options: TeachersRequestOptions = {}
) {
  return requestJson<TeacherProfileResponse>(apiBaseUrl, `/teachers/${teacherId}`, {
    method: 'GET',
    options,
  });
}

export async function createTeacher(
  apiBaseUrl: string,
  input: CreateTeacherRequest,
  options: TeachersRequestOptions = {}
) {
  return requestJson<TeacherResponse>(apiBaseUrl, '/teachers', {
    method: 'POST',
    body: input,
    options,
  });
}

export async function updateTeacher(
  apiBaseUrl: string,
  teacherId: string,
  input: UpdateTeacherRequest,
  options: TeachersRequestOptions = {}
) {
  return requestJson<TeacherResponse>(apiBaseUrl, `/teachers/${teacherId}`, {
    method: 'PUT',
    body: input,
    options,
  });
}

export async function archiveTeacher(
  apiBaseUrl: string,
  teacherId: string,
  input: ArchiveTeacherRequest,
  options: TeachersRequestOptions = {}
) {
  return requestJson<TeacherResponse>(apiBaseUrl, `/teachers/${teacherId}/archive`, {
    method: 'POST',
    body: input,
    options,
  });
}

export async function reactivateTeacher(
  apiBaseUrl: string,
  teacherId: string,
  input: ArchiveTeacherRequest,
  options: TeachersRequestOptions = {}
) {
  return requestJson<TeacherResponse>(apiBaseUrl, `/teachers/${teacherId}/reactivate`, {
    method: 'POST',
    body: input,
    options,
  });
}

export async function createTeacherLogin(
  apiBaseUrl: string,
  teacherId: string,
  options: TeachersRequestOptions = {}
) {
  return requestJson<TeacherLoginCreatedResponse>(apiBaseUrl, `/teachers/${teacherId}/login`, {
    method: 'POST',
    body: {},
    options,
  });
}

export async function deactivateTeacherLogin(
  apiBaseUrl: string,
  teacherId: string,
  input: ArchiveTeacherRequest,
  options: TeachersRequestOptions = {}
) {
  return requestJson<TeacherProfileResponse>(
    apiBaseUrl,
    `/teachers/${teacherId}/login/deactivate`,
    {
      method: 'POST',
      body: input,
      options,
    }
  );
}

export async function reactivateTeacherLogin(
  apiBaseUrl: string,
  teacherId: string,
  options: TeachersRequestOptions = {}
) {
  return requestJson<TeacherProfileResponse>(
    apiBaseUrl,
    `/teachers/${teacherId}/login/reactivate`,
    {
      method: 'POST',
      body: {},
      options,
    }
  );
}

// ---------------------------------------------------------------------------
// Shared request plumbing
// ---------------------------------------------------------------------------

async function requestJson<T>(
  apiBaseUrl: string,
  path: string,
  request: {
    method: 'GET' | 'POST' | 'PUT';
    body?: unknown;
    options: TeachersRequestOptions;
  }
) {
  const fetcher = request.options.fetcher ?? fetch;
  let response: Response;

  try {
    response = await fetchWithTimeout(fetcher, `${apiBaseUrl}${path}`, {
      method: request.method,
      credentials: 'include',
      headers: {
        ...(request.body === undefined ? {} : { 'Content-Type': 'application/json' }),
        ...createAuthHeaders(),
        ...createSidecarHeaders(request.options.capabilityToken),
      },
      ...(request.body === undefined ? {} : { body: JSON.stringify(request.body) }),
    });
  } catch {
    throw new TeachersApiError('LOCAL_SERVICE_UNAVAILABLE', 'Local service unavailable.', 0);
  }

  let payload: ApiResponse<T> | ApiErrorResponse;

  try {
    payload = (await response.json()) as ApiResponse<T> | ApiErrorResponse;
  } catch {
    throw new TeachersApiError(
      'LOCAL_SERVICE_UNAVAILABLE',
      'Local service returned an unreadable response.',
      response.status
    );
  }

  if (!response.ok || !payload.success) {
    throw new TeachersApiError(
      payload.success ? 'REQUEST_REJECTED' : payload.error.code,
      payload.success ? 'Requete locale refusee.' : payload.error.message,
      response.status
    );
  }

  return payload.data;
}

function createSidecarHeaders(capabilityToken: string | undefined): Record<string, string> {
  return capabilityToken ? { [SIDECAR_CAPABILITY_HEADER]: capabilityToken } : {};
}

interface ApiResponse<T> {
  success: true;
  data: T;
}

interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
  };
}
