import {
  SIDECAR_CAPABILITY_HEADER,
  type ArchiveClassroomRequest,
  type AssignClassSubjectRequest,
  type ClassRegisterExportResponse,
  type ClassroomListQuery,
  type ClassroomRosterResponse,
  type ClassroomView,
  type ClassSubjectView,
  type CreateClassroomRequest,
  type CreateSubjectRequest,
  type CurriculumCopyConfirmRequest,
  type CurriculumCopyConfirmResponse,
  type CurriculumCopyPreviewRequest,
  type CurriculumCopyPreviewResponse,
  type EnrolOptionalSubjectsRequest,
  type EnrolStudentsRequest,
  type EnrolStudentsResponse,
  type PaginatedClassroomsResponse,
  type PaginatedSubjectsResponse,
  type StudentSubjectEnrollmentResponse,
  type StudentsMissingClassResponse,
  type SubjectListQuery,
  type SubjectResponse,
  type TransferStudentRequest,
  type UpdateClassroomRequest,
  type UpdateClassSubjectRequest,
  type UpdateSubjectRequest,
} from '@edutrack/shared';
import { createAuthHeaders } from '../auth';
import { ClassesApiError } from './classesErrors';

type Fetcher = typeof fetch;

export interface ClassesRequestOptions {
  capabilityToken?: string;
  fetcher?: Fetcher;
}

// ---- Subjects --------------------------------------------------------------

export async function listSubjects(
  apiBaseUrl: string,
  query: SubjectListQuery,
  options: ClassesRequestOptions = {}
) {
  const params = new URLSearchParams();
  params.set('limit', String(query.limit));
  params.set('offset', String(query.offset));

  if (query.search) params.set('search', query.search);
  if (query.category) params.set('category', query.category);
  if (query.status) params.set('status', query.status);

  return requestJson<PaginatedSubjectsResponse>(apiBaseUrl, `/subjects?${params.toString()}`, {
    method: 'GET',
    options,
  });
}

export async function createSubject(
  apiBaseUrl: string,
  input: CreateSubjectRequest,
  options: ClassesRequestOptions = {}
) {
  return requestJson<SubjectResponse>(apiBaseUrl, '/subjects', {
    method: 'POST',
    body: input,
    options,
  });
}

export async function updateSubject(
  apiBaseUrl: string,
  subjectId: string,
  input: UpdateSubjectRequest,
  options: ClassesRequestOptions = {}
) {
  return requestJson<SubjectResponse>(apiBaseUrl, `/subjects/${subjectId}`, {
    method: 'PUT',
    body: input,
    options,
  });
}

export async function archiveSubject(
  apiBaseUrl: string,
  subjectId: string,
  input: ArchiveClassroomRequest,
  options: ClassesRequestOptions = {}
) {
  return requestJson<SubjectResponse>(apiBaseUrl, `/subjects/${subjectId}/archive`, {
    method: 'POST',
    body: input,
    options,
  });
}

export async function reactivateSubject(
  apiBaseUrl: string,
  subjectId: string,
  input: ArchiveClassroomRequest,
  options: ClassesRequestOptions = {}
) {
  return requestJson<SubjectResponse>(apiBaseUrl, `/subjects/${subjectId}/reactivate`, {
    method: 'POST',
    body: input,
    options,
  });
}

// ---- Classrooms ------------------------------------------------------------

export async function listClassrooms(
  apiBaseUrl: string,
  query: ClassroomListQuery,
  options: ClassesRequestOptions = {}
) {
  const params = new URLSearchParams();
  params.set('limit', String(query.limit));
  params.set('offset', String(query.offset));

  if (query.academicYearId) params.set('academicYearId', query.academicYearId);
  if (query.classLevelId) params.set('classLevelId', query.classLevelId);
  if (query.search) params.set('search', query.search);
  if (query.status) params.set('status', query.status);

  return requestJson<PaginatedClassroomsResponse>(apiBaseUrl, `/classrooms?${params.toString()}`, {
    method: 'GET',
    options,
  });
}

export async function createClassroom(
  apiBaseUrl: string,
  input: CreateClassroomRequest,
  options: ClassesRequestOptions = {}
) {
  return requestJson<ClassroomView>(apiBaseUrl, '/classrooms', {
    method: 'POST',
    body: input,
    options,
  });
}

export async function updateClassroom(
  apiBaseUrl: string,
  classroomId: string,
  input: UpdateClassroomRequest,
  options: ClassesRequestOptions = {}
) {
  return requestJson<ClassroomView>(apiBaseUrl, `/classrooms/${classroomId}`, {
    method: 'PUT',
    body: input,
    options,
  });
}

export async function archiveClassroom(
  apiBaseUrl: string,
  classroomId: string,
  input: ArchiveClassroomRequest,
  options: ClassesRequestOptions = {}
) {
  return requestJson<ClassroomView>(apiBaseUrl, `/classrooms/${classroomId}/archive`, {
    method: 'POST',
    body: input,
    options,
  });
}

export async function reactivateClassroom(
  apiBaseUrl: string,
  classroomId: string,
  input: ArchiveClassroomRequest,
  options: ClassesRequestOptions = {}
) {
  return requestJson<ClassroomView>(apiBaseUrl, `/classrooms/${classroomId}/reactivate`, {
    method: 'POST',
    body: input,
    options,
  });
}

export async function getClassroomRoster(
  apiBaseUrl: string,
  classroomId: string,
  options: ClassesRequestOptions = {}
) {
  return requestJson<ClassroomRosterResponse>(apiBaseUrl, `/classrooms/${classroomId}/roster`, {
    method: 'GET',
    options,
  });
}

export async function exportClassRegister(
  apiBaseUrl: string,
  classroomId: string,
  options: ClassesRequestOptions = {}
) {
  return requestJson<ClassRegisterExportResponse>(
    apiBaseUrl,
    `/classrooms/${classroomId}/register`,
    {
      method: 'GET',
      options,
    }
  );
}

// ---- Class-subjects --------------------------------------------------------

export async function listClassSubjects(
  apiBaseUrl: string,
  classroomId: string,
  options: ClassesRequestOptions = {}
) {
  return requestJson<ClassSubjectView[]>(apiBaseUrl, `/class-subjects?classroomId=${classroomId}`, {
    method: 'GET',
    options,
  });
}

export async function assignClassSubject(
  apiBaseUrl: string,
  input: AssignClassSubjectRequest,
  options: ClassesRequestOptions = {}
) {
  return requestJson<ClassSubjectView>(apiBaseUrl, '/class-subjects', {
    method: 'POST',
    body: input,
    options,
  });
}

export async function updateClassSubject(
  apiBaseUrl: string,
  classSubjectId: string,
  input: UpdateClassSubjectRequest,
  options: ClassesRequestOptions = {}
) {
  return requestJson<ClassSubjectView>(apiBaseUrl, `/class-subjects/${classSubjectId}`, {
    method: 'PUT',
    body: input,
    options,
  });
}

export async function removeClassSubject(
  apiBaseUrl: string,
  classSubjectId: string,
  options: ClassesRequestOptions = {}
) {
  return requestJson<ClassSubjectView>(apiBaseUrl, `/class-subjects/${classSubjectId}`, {
    method: 'DELETE',
    options,
  });
}

// ---- Enrolment -------------------------------------------------------------

export async function enrolStudents(
  apiBaseUrl: string,
  input: EnrolStudentsRequest,
  options: ClassesRequestOptions = {}
) {
  return requestJson<EnrolStudentsResponse>(apiBaseUrl, '/class-enrollments', {
    method: 'POST',
    body: input,
    options,
  });
}

export async function transferStudent(
  apiBaseUrl: string,
  studentId: string,
  input: TransferStudentRequest,
  options: ClassesRequestOptions = {}
) {
  return requestJson<{ closed: unknown; opened: unknown }>(
    apiBaseUrl,
    `/students/${studentId}/transfer`,
    { method: 'POST', body: input, options }
  );
}

export async function listStudentsMissingClass(
  apiBaseUrl: string,
  options: ClassesRequestOptions = {}
) {
  return requestJson<StudentsMissingClassResponse>(apiBaseUrl, '/students/missing-class', {
    method: 'GET',
    options,
  });
}

export async function enrolOptionalSubjects(
  apiBaseUrl: string,
  input: EnrolOptionalSubjectsRequest,
  options: ClassesRequestOptions = {}
) {
  return requestJson<StudentSubjectEnrollmentResponse[]>(
    apiBaseUrl,
    '/class-enrollments/optional-subjects',
    { method: 'POST', body: input, options }
  );
}

// ---- Curriculum copy -------------------------------------------------------

export async function previewCurriculumCopy(
  apiBaseUrl: string,
  input: CurriculumCopyPreviewRequest,
  options: ClassesRequestOptions = {}
) {
  return requestJson<CurriculumCopyPreviewResponse>(apiBaseUrl, '/curriculum/copy/preview', {
    method: 'POST',
    body: input,
    options,
  });
}

export async function confirmCurriculumCopy(
  apiBaseUrl: string,
  input: CurriculumCopyConfirmRequest,
  options: ClassesRequestOptions = {}
) {
  return requestJson<CurriculumCopyConfirmResponse>(apiBaseUrl, '/curriculum/copy/confirm', {
    method: 'POST',
    body: input,
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
    options: ClassesRequestOptions;
  }
) {
  const fetcher = request.options.fetcher ?? fetch;
  let response: Response;

  try {
    response = await fetcher(`${apiBaseUrl}${path}`, {
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
    throw new ClassesApiError('LOCAL_SERVICE_UNAVAILABLE', 'Local service unavailable.', 0);
  }

  let payload: ApiResponse<T> | ApiErrorResponse;

  try {
    payload = (await response.json()) as ApiResponse<T> | ApiErrorResponse;
  } catch {
    throw new ClassesApiError(
      'LOCAL_SERVICE_UNAVAILABLE',
      'Local service returned an unreadable response.',
      response.status
    );
  }

  if (!response.ok || !payload.success) {
    // Fastify's default 404 body (route not registered on the running sidecar)
    // has no `error.code` — fall back to a stable code so the UI can tell a
    // stale-service situation apart from a real application error.
    const errorBody = (payload as { error?: { code?: unknown; message?: unknown } }).error;
    const code =
      typeof errorBody?.code === 'string'
        ? errorBody.code
        : response.status === 404
          ? 'ROUTE_NOT_FOUND'
          : 'UNKNOWN_ERROR';
    const message =
      typeof errorBody?.message === 'string' ? errorBody.message : 'Requete locale refusee.';

    throw new ClassesApiError(code, message, response.status);
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
