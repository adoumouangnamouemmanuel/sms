import {
  SIDECAR_CAPABILITY_HEADER,
  type ArchiveGuardianRequest,
  type ArchiveStudentRequest,
  type CreateGuardianRequest,
  type CreateStudentRequest,
  type GuardianListQuery,
  type GuardianProfileResponse,
  type GuardianResponse,
  type LinkStudentGuardianRequest,
  type PaginatedGuardiansResponse,
  type PaginatedStudentsResponse,
  type StudentGuardianLinkResponse,
  type StudentListQuery,
  type StudentProfileResponse,
  type StudentResponse,
  type UpdateGuardianRequest,
  type UpdateStudentGuardianLinkRequest,
  type UpdateStudentRequest,
} from '@edutrack/shared';
import { fetchWithTimeout } from '../../lib/httpClient';
import { createAuthHeaders } from '../auth';
import { StudentsApiError } from './studentsErrors';

type Fetcher = typeof fetch;

export interface StudentsRequestOptions {
  capabilityToken?: string;
  fetcher?: Fetcher;
}

// ---------------------------------------------------------------------------
// Students
// ---------------------------------------------------------------------------

export async function listStudents(
  apiBaseUrl: string,
  query: StudentListQuery,
  options: StudentsRequestOptions = {}
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

  if (query.classLevelId) {
    params.set('classLevelId', query.classLevelId);
  }

  if (query.classroomId) {
    params.set('classroomId', query.classroomId);
  }

  if (query.sex) {
    params.set('sex', query.sex);
  }

  return requestJson<PaginatedStudentsResponse>(apiBaseUrl, `/students?${params.toString()}`, {
    method: 'GET',
    options,
  });
}

export async function getStudentProfile(
  apiBaseUrl: string,
  studentId: string,
  options: StudentsRequestOptions = {}
) {
  return requestJson<StudentProfileResponse>(apiBaseUrl, `/students/${studentId}`, {
    method: 'GET',
    options,
  });
}

export async function createStudent(
  apiBaseUrl: string,
  input: CreateStudentRequest,
  options: StudentsRequestOptions = {}
) {
  return requestJson<StudentResponse>(apiBaseUrl, '/students', {
    method: 'POST',
    body: input,
    options,
  });
}

export async function updateStudent(
  apiBaseUrl: string,
  studentId: string,
  input: UpdateStudentRequest,
  options: StudentsRequestOptions = {}
) {
  return requestJson<StudentResponse>(apiBaseUrl, `/students/${studentId}`, {
    method: 'PUT',
    body: input,
    options,
  });
}

export async function archiveStudent(
  apiBaseUrl: string,
  studentId: string,
  input: ArchiveStudentRequest,
  options: StudentsRequestOptions = {}
) {
  return requestJson<StudentResponse>(apiBaseUrl, `/students/${studentId}/archive`, {
    method: 'POST',
    body: input,
    options,
  });
}

export async function reactivateStudent(
  apiBaseUrl: string,
  studentId: string,
  input: ArchiveStudentRequest,
  options: StudentsRequestOptions = {}
) {
  return requestJson<StudentResponse>(apiBaseUrl, `/students/${studentId}/reactivate`, {
    method: 'POST',
    body: input,
    options,
  });
}

// ---------------------------------------------------------------------------
// Guardians
// ---------------------------------------------------------------------------

export async function listGuardians(
  apiBaseUrl: string,
  query: GuardianListQuery,
  options: StudentsRequestOptions = {}
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

  return requestJson<PaginatedGuardiansResponse>(apiBaseUrl, `/guardians?${params.toString()}`, {
    method: 'GET',
    options,
  });
}

export async function getGuardianProfile(
  apiBaseUrl: string,
  guardianId: string,
  options: StudentsRequestOptions = {}
) {
  return requestJson<GuardianProfileResponse>(apiBaseUrl, `/guardians/${guardianId}`, {
    method: 'GET',
    options,
  });
}

export async function createGuardian(
  apiBaseUrl: string,
  input: CreateGuardianRequest,
  options: StudentsRequestOptions = {}
) {
  return requestJson<GuardianResponse>(apiBaseUrl, '/guardians', {
    method: 'POST',
    body: input,
    options,
  });
}

export async function updateGuardian(
  apiBaseUrl: string,
  guardianId: string,
  input: UpdateGuardianRequest,
  options: StudentsRequestOptions = {}
) {
  return requestJson<GuardianResponse>(apiBaseUrl, `/guardians/${guardianId}`, {
    method: 'PUT',
    body: input,
    options,
  });
}

export async function archiveGuardian(
  apiBaseUrl: string,
  guardianId: string,
  input: ArchiveGuardianRequest,
  options: StudentsRequestOptions = {}
) {
  return requestJson<GuardianResponse>(apiBaseUrl, `/guardians/${guardianId}/archive`, {
    method: 'POST',
    body: input,
    options,
  });
}

export async function reactivateGuardian(
  apiBaseUrl: string,
  guardianId: string,
  input: ArchiveGuardianRequest,
  options: StudentsRequestOptions = {}
) {
  return requestJson<GuardianResponse>(apiBaseUrl, `/guardians/${guardianId}/reactivate`, {
    method: 'POST',
    body: input,
    options,
  });
}

// ---------------------------------------------------------------------------
// Student-guardian links
// ---------------------------------------------------------------------------

export async function linkGuardian(
  apiBaseUrl: string,
  studentId: string,
  input: LinkStudentGuardianRequest,
  options: StudentsRequestOptions = {}
) {
  return requestJson<StudentGuardianLinkResponse>(apiBaseUrl, `/students/${studentId}/guardians`, {
    method: 'POST',
    body: input,
    options,
  });
}

export async function updateGuardianLink(
  apiBaseUrl: string,
  linkId: string,
  input: UpdateStudentGuardianLinkRequest,
  options: StudentsRequestOptions = {}
) {
  return requestJson<StudentGuardianLinkResponse>(apiBaseUrl, `/student-guardians/${linkId}`, {
    method: 'PUT',
    body: input,
    options,
  });
}

export async function unlinkGuardian(
  apiBaseUrl: string,
  linkId: string,
  options: StudentsRequestOptions = {}
) {
  return requestJson<StudentGuardianLinkResponse>(apiBaseUrl, `/student-guardians/${linkId}`, {
    method: 'DELETE',
    options,
  });
}

// ---------------------------------------------------------------------------
// Shared request plumbing
// ---------------------------------------------------------------------------

async function requestJson<T>(
  apiBaseUrl: string,
  path: string,
  request: {
    method: 'GET' | 'POST' | 'PUT' | 'DELETE';
    body?: unknown;
    options: StudentsRequestOptions;
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
    throw new StudentsApiError('LOCAL_SERVICE_UNAVAILABLE', 'Local service unavailable.', 0);
  }

  let payload: ApiResponse<T> | ApiErrorResponse;

  try {
    payload = (await response.json()) as ApiResponse<T> | ApiErrorResponse;
  } catch {
    throw new StudentsApiError(
      'LOCAL_SERVICE_UNAVAILABLE',
      'Local service returned an unreadable response.',
      response.status
    );
  }

  if (!response.ok || !payload.success) {
    throw new StudentsApiError(
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
