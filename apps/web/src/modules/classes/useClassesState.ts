import type {
  ArchiveClassroomRequest,
  AssignClassSubjectRequest,
  ClassRecordStatus,
  ClassRegisterExportResponse,
  ClassroomListQuery,
  ClassroomRosterResponse,
  ClassSubjectView,
  CreateClassroomRequest,
  CreateSubjectRequest,
  CurriculumCopyConfirmRequest,
  CurriculumCopyPreviewRequest,
  CurriculumCopyPreviewResponse,
  EnrolOptionalSubjectsRequest,
  EnrolStudentsRequest,
  EnrolStudentsResponse,
  PaginatedClassroomsResponse,
  PaginatedSubjectsResponse,
  RecordStatus,
  StudentSubjectEnrollmentResponse,
  StudentsMissingClassResponse,
  SubjectCategory,
  SubjectListQuery,
  SubjectResponse,
  TransferStudentRequest,
  UpdateClassroomRequest,
  UpdateSubjectRequest,
} from '@edutrack/shared';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  archiveClassroom as archiveClassroomRequest,
  archiveSubject as archiveSubjectRequest,
  assignClassSubject as assignClassSubjectRequest,
  createClassroom as createClassroomRequest,
  createSubject as createSubjectRequest,
  listClassrooms,
  listClassSubjects,
  listSubjects,
  reactivateClassroom as reactivateClassroomRequest,
  reactivateSubject as reactivateSubjectRequest,
  removeClassSubject as removeClassSubjectRequest,
  updateClassroom as updateClassroomRequest,
  updateClassSubject as updateClassSubjectRequest,
  updateSubject as updateSubjectRequest,
  type ClassesRequestOptions,
} from './classesApi';
import { resolveClassesErrorMessageKey } from './classesErrors';

export interface ClassesClient {
  assignClassSubject(
    input: AssignClassSubjectRequest,
    options?: ClassesRequestOptions
  ): Promise<ClassSubjectView>;
  confirmCurriculumCopy(
    input: CurriculumCopyConfirmRequest,
    options?: ClassesRequestOptions
  ): Promise<{ assigned: number; skipped: number }>;
  enrolOptionalSubjects(
    input: EnrolOptionalSubjectsRequest,
    options?: ClassesRequestOptions
  ): Promise<StudentSubjectEnrollmentResponse[]>;
  enrolStudents(
    input: EnrolStudentsRequest,
    options?: ClassesRequestOptions
  ): Promise<EnrolStudentsResponse>;
  exportRegister(
    classroomId: string,
    options?: ClassesRequestOptions
  ): Promise<ClassRegisterExportResponse>;
  getClassroomRoster(
    classroomId: string,
    options?: ClassesRequestOptions
  ): Promise<ClassroomRosterResponse>;
  listStudentsMissingClass(options?: ClassesRequestOptions): Promise<StudentsMissingClassResponse>;
  previewCurriculumCopy(
    input: CurriculumCopyPreviewRequest,
    options?: ClassesRequestOptions
  ): Promise<CurriculumCopyPreviewResponse>;
  transferStudent(
    studentId: string,
    input: TransferStudentRequest,
    options?: ClassesRequestOptions
  ): Promise<{ closed: unknown; opened: unknown }>;
  archiveClassroom(
    classroomId: string,
    input: ArchiveClassroomRequest,
    options?: ClassesRequestOptions
  ): Promise<unknown>;
  archiveSubject(
    subjectId: string,
    input: ArchiveClassroomRequest,
    options?: ClassesRequestOptions
  ): Promise<SubjectResponse>;
  createClassroom(input: CreateClassroomRequest, options?: ClassesRequestOptions): Promise<unknown>;
  createSubject(
    input: CreateSubjectRequest,
    options?: ClassesRequestOptions
  ): Promise<SubjectResponse>;
  listClassrooms(
    query: ClassroomListQuery,
    options?: ClassesRequestOptions
  ): Promise<PaginatedClassroomsResponse>;
  listClassSubjects(
    classroomId: string,
    options?: ClassesRequestOptions
  ): Promise<ClassSubjectView[]>;
  listSubjects(
    query: SubjectListQuery,
    options?: ClassesRequestOptions
  ): Promise<PaginatedSubjectsResponse>;
  reactivateClassroom(
    classroomId: string,
    input: ArchiveClassroomRequest,
    options?: ClassesRequestOptions
  ): Promise<unknown>;
  reactivateSubject(
    subjectId: string,
    input: ArchiveClassroomRequest,
    options?: ClassesRequestOptions
  ): Promise<SubjectResponse>;
  removeClassSubject(
    classSubjectId: string,
    options?: ClassesRequestOptions
  ): Promise<ClassSubjectView>;
  updateClassroom(
    classroomId: string,
    input: UpdateClassroomRequest,
    options?: ClassesRequestOptions
  ): Promise<unknown>;
  updateClassSubject(
    classSubjectId: string,
    input: Parameters<typeof updateClassSubjectRequest>[2],
    options?: ClassesRequestOptions
  ): Promise<ClassSubjectView>;
  updateSubject(
    subjectId: string,
    input: UpdateSubjectRequest,
    options?: ClassesRequestOptions
  ): Promise<SubjectResponse>;
}

export interface UseClassesModuleOptions {
  apiBaseUrl: string | null;
  capabilityToken?: string;
  client?: ClassesClient;
}

const SUBJECT_PAGE_SIZE = 50;
const CLASSROOM_PAGE_SIZE = 100;

export function useClassesModule({ apiBaseUrl, capabilityToken, client }: UseClassesModuleOptions) {
  const [subjects, setSubjects] = useState<SubjectListState>(emptySubjectListState());
  const [classrooms, setClassrooms] = useState<ClassroomListState>(emptyClassroomListState());
  const [classroomLevelFilter, setClassroomLevelFilterState] = useState<string | undefined>(
    undefined
  );
  const [mutationErrorKey, setMutationErrorKey] = useState<string | null>(null);
  const latestSubjectsRequest = useRef(0);
  const latestClassroomsRequest = useRef(0);
  const searchDebounceRef = useRef<number | null>(null);

  const requestOptions = useCallback(
    (extra?: ClassesRequestOptions): ClassesRequestOptions => ({
      ...(capabilityToken ? { capabilityToken } : {}),
      ...(extra ?? {}),
    }),
    [capabilityToken]
  );

  // ---- Subjects ------------------------------------------------------------

  const loadSubjects = useCallback(
    async (search: string, offset: number, status: RecordStatus, category?: SubjectCategory) => {
      if (!apiBaseUrl && !client) {
        return;
      }

      setSubjects((previous) => ({ ...previous, isLoading: true, errorKey: null }));
      const requestId = ++latestSubjectsRequest.current;

      try {
        const page = client
          ? await client.listSubjects(
              { search, status, category, limit: SUBJECT_PAGE_SIZE, offset },
              requestOptions()
            )
          : await listSubjects(
              apiBaseUrl ?? '',
              { search, status, category, limit: SUBJECT_PAGE_SIZE, offset },
              requestOptions()
            );

        if (latestSubjectsRequest.current !== requestId) return;

        setSubjects({
          items: page.items,
          errorKey: null,
          isLoading: false,
          limit: page.limit,
          offset: page.offset,
          pageCount: Math.max(1, Math.ceil(page.total / page.limit)),
          search,
          status,
          total: page.total,
        });
      } catch (error) {
        if (latestSubjectsRequest.current !== requestId) return;

        setSubjects((previous) => ({
          ...previous,
          errorKey: resolveClassesErrorMessageKey(error),
          isLoading: false,
        }));
      }
    },
    [apiBaseUrl, client, requestOptions]
  );

  useEffect(() => {
    if (!apiBaseUrl && !client) {
      return;
    }

    const handle = window.setTimeout(() => {
      void loadSubjects('', 0, 'active');
    }, 0);

    return () => {
      window.clearTimeout(handle);
    };
  }, [apiBaseUrl, client, loadSubjects]);

  useEffect(
    () => () => {
      if (searchDebounceRef.current !== null) {
        window.clearTimeout(searchDebounceRef.current);
        searchDebounceRef.current = null;
      }
    },
    []
  );

  const searchSubjects = useCallback(
    (query: string) => {
      if (searchDebounceRef.current !== null) {
        window.clearTimeout(searchDebounceRef.current);
      }
      searchDebounceRef.current = window.setTimeout(() => {
        void loadSubjects(query.trim(), 0, subjects.status);
      }, 300);
    },
    [loadSubjects, subjects.status]
  );

  const setSubjectsStatus = useCallback(
    (status: RecordStatus) => {
      void loadSubjects(subjects.search, 0, status);
    },
    [loadSubjects, subjects.search]
  );

  const subjectsNextPage = useCallback(() => {
    const nextOffset = subjects.offset + subjects.limit;

    if (nextOffset < subjects.total) {
      void loadSubjects(subjects.search, nextOffset, subjects.status);
    }
  }, [loadSubjects, subjects]);

  const subjectsPrevPage = useCallback(() => {
    const previousOffset = Math.max(0, subjects.offset - subjects.limit);

    if (previousOffset !== subjects.offset) {
      void loadSubjects(subjects.search, previousOffset, subjects.status);
    }
  }, [loadSubjects, subjects]);

  // ---- Classrooms ----------------------------------------------------------

  const loadClassrooms = useCallback(
    async (
      search: string,
      offset: number,
      status: ClassRecordStatus,
      academicYearId?: string,
      classLevelId?: string
    ) => {
      if (!apiBaseUrl && !client) {
        return;
      }

      setClassrooms((previous) => ({ ...previous, isLoading: true, errorKey: null }));
      const requestId = ++latestClassroomsRequest.current;

      try {
        const page = client
          ? await client.listClassrooms(
              { search, status, academicYearId, classLevelId, limit: CLASSROOM_PAGE_SIZE, offset },
              requestOptions()
            )
          : await listClassrooms(
              apiBaseUrl ?? '',
              { search, status, academicYearId, classLevelId, limit: CLASSROOM_PAGE_SIZE, offset },
              requestOptions()
            );

        if (latestClassroomsRequest.current !== requestId) return;

        setClassrooms({
          items: page.items,
          errorKey: null,
          isLoading: false,
          limit: page.limit,
          offset: page.offset,
          pageCount: Math.max(1, Math.ceil(page.total / page.limit)),
          search,
          status,
          total: page.total,
        });
      } catch (error) {
        if (latestClassroomsRequest.current !== requestId) return;

        setClassrooms((previous) => ({
          ...previous,
          errorKey: resolveClassesErrorMessageKey(error),
          isLoading: false,
        }));
      }
    },
    [apiBaseUrl, client, requestOptions]
  );

  useEffect(() => {
    if (!apiBaseUrl && !client) {
      return;
    }

    const handle = window.setTimeout(() => {
      void loadClassrooms('', 0, 'active');
    }, 0);

    return () => {
      window.clearTimeout(handle);
    };
  }, [apiBaseUrl, client, loadClassrooms]);

  const searchClassrooms = useCallback(
    (query: string) => {
      void loadClassrooms(query.trim(), 0, classrooms.status, undefined, classroomLevelFilter);
    },
    [classroomLevelFilter, classrooms.status, loadClassrooms]
  );

  const setClassroomsStatus = useCallback(
    (status: ClassRecordStatus) => {
      void loadClassrooms(classrooms.search, 0, status, undefined, classroomLevelFilter);
    },
    [classroomLevelFilter, classrooms.search, loadClassrooms]
  );

  const setClassroomLevelFilter = useCallback(
    (classLevelId?: string) => {
      setClassroomLevelFilterState(classLevelId);
      void loadClassrooms(classrooms.search, 0, classrooms.status, undefined, classLevelId);
    },
    [classrooms.search, classrooms.status, loadClassrooms]
  );

  const classroomsNextPage = useCallback(() => {
    const nextOffset = classrooms.offset + classrooms.limit;

    if (nextOffset < classrooms.total) {
      void loadClassrooms(
        classrooms.search,
        nextOffset,
        classrooms.status,
        undefined,
        classroomLevelFilter
      );
    }
  }, [classroomLevelFilter, classrooms, loadClassrooms]);

  const classroomsPrevPage = useCallback(() => {
    const previousOffset = Math.max(0, classrooms.offset - classrooms.limit);

    if (previousOffset !== classrooms.offset) {
      void loadClassrooms(
        classrooms.search,
        previousOffset,
        classrooms.status,
        undefined,
        classroomLevelFilter
      );
    }
  }, [classroomLevelFilter, classrooms, loadClassrooms]);

  const refreshClassrooms = useCallback(() => {
    return loadClassrooms(
      classrooms.search,
      classrooms.offset,
      classrooms.status,
      undefined,
      classroomLevelFilter
    );
  }, [classroomLevelFilter, classrooms, loadClassrooms]);

  // ---- Mutations -----------------------------------------------------------

  const runMutation = useCallback(
    async <T>(operation: () => Promise<T>, refresh: () => Promise<void> | void): Promise<T> => {
      setMutationErrorKey(null);

      try {
        const result = await operation();

        await refresh();
        return result;
      } catch (error) {
        setMutationErrorKey(resolveClassesErrorMessageKey(error));
        throw error;
      }
    },
    []
  );

  const refreshSubjects = useCallback(() => {
    return loadSubjects(subjects.search, subjects.offset, subjects.status);
  }, [loadSubjects, subjects]);

  const createSubject = useCallback(
    async (input: CreateSubjectRequest) =>
      runMutation(
        () =>
          client
            ? client.createSubject(input, requestOptions())
            : createSubjectRequest(apiBaseUrl ?? '', input, requestOptions()),
        refreshSubjects
      ),
    [apiBaseUrl, client, refreshSubjects, requestOptions, runMutation]
  );

  const updateSubject = useCallback(
    async (subjectId: string, input: UpdateSubjectRequest) =>
      runMutation(
        () =>
          client
            ? client.updateSubject(subjectId, input, requestOptions())
            : updateSubjectRequest(apiBaseUrl ?? '', subjectId, input, requestOptions()),
        refreshSubjects
      ),
    [apiBaseUrl, client, refreshSubjects, requestOptions, runMutation]
  );

  const archiveSubject = useCallback(
    async (subjectId: string, reason: string) =>
      runMutation(
        () =>
          client
            ? client.archiveSubject(subjectId, { reason }, requestOptions())
            : archiveSubjectRequest(apiBaseUrl ?? '', subjectId, { reason }, requestOptions()),
        refreshSubjects
      ),
    [apiBaseUrl, client, refreshSubjects, requestOptions, runMutation]
  );

  const reactivateSubject = useCallback(
    async (subjectId: string, reason: string) =>
      runMutation(
        () =>
          client
            ? client.reactivateSubject(subjectId, { reason }, requestOptions())
            : reactivateSubjectRequest(apiBaseUrl ?? '', subjectId, { reason }, requestOptions()),
        refreshSubjects
      ),
    [apiBaseUrl, client, refreshSubjects, requestOptions, runMutation]
  );

  const createClassroom = useCallback(
    async (input: CreateClassroomRequest) =>
      runMutation(
        () =>
          client
            ? client.createClassroom(input, requestOptions())
            : createClassroomRequest(apiBaseUrl ?? '', input, requestOptions()),
        refreshClassrooms
      ),
    [apiBaseUrl, client, refreshClassrooms, requestOptions, runMutation]
  );

  const updateClassroom = useCallback(
    async (classroomId: string, input: UpdateClassroomRequest) =>
      runMutation(
        () =>
          client
            ? client.updateClassroom(classroomId, input, requestOptions())
            : updateClassroomRequest(apiBaseUrl ?? '', classroomId, input, requestOptions()),
        refreshClassrooms
      ),
    [apiBaseUrl, client, refreshClassrooms, requestOptions, runMutation]
  );

  const archiveClassroom = useCallback(
    async (classroomId: string, reason: string) =>
      runMutation(
        () =>
          client
            ? client.archiveClassroom(classroomId, { reason }, requestOptions())
            : archiveClassroomRequest(apiBaseUrl ?? '', classroomId, { reason }, requestOptions()),
        refreshClassrooms
      ),
    [apiBaseUrl, client, refreshClassrooms, requestOptions, runMutation]
  );

  const reactivateClassroom = useCallback(
    async (classroomId: string, reason: string) =>
      runMutation(
        () =>
          client
            ? client.reactivateClassroom(classroomId, { reason }, requestOptions())
            : reactivateClassroomRequest(
                apiBaseUrl ?? '',
                classroomId,
                { reason },
                requestOptions()
              ),
        refreshClassrooms
      ),
    [apiBaseUrl, client, refreshClassrooms, requestOptions, runMutation]
  );

  const loadClassSubjectsForClassroom = useCallback(
    async (classroomId: string): Promise<ClassSubjectView[]> => {
      if (!apiBaseUrl && !client) {
        return [];
      }

      return client
        ? client.listClassSubjects(classroomId, requestOptions())
        : listClassSubjects(apiBaseUrl ?? '', classroomId, requestOptions());
    },
    [apiBaseUrl, client, requestOptions]
  );

  const assignSubject = useCallback(
    async (input: AssignClassSubjectRequest) =>
      runMutation(
        () =>
          client
            ? client.assignClassSubject(input, requestOptions())
            : assignClassSubjectRequest(apiBaseUrl ?? '', input, requestOptions()),
        () => Promise.resolve()
      ),
    [apiBaseUrl, client, requestOptions, runMutation]
  );

  const editClassSubject = useCallback(
    async (classSubjectId: string, input: Parameters<typeof updateClassSubjectRequest>[2]) =>
      runMutation(
        () =>
          client
            ? client.updateClassSubject(classSubjectId, input, requestOptions())
            : updateClassSubjectRequest(apiBaseUrl ?? '', classSubjectId, input, requestOptions()),
        () => Promise.resolve()
      ),
    [apiBaseUrl, client, requestOptions, runMutation]
  );

  const removeSubjectAssignment = useCallback(
    async (classSubjectId: string) =>
      runMutation(
        () =>
          client
            ? client.removeClassSubject(classSubjectId, requestOptions())
            : removeClassSubjectRequest(apiBaseUrl ?? '', classSubjectId, requestOptions()),
        () => Promise.resolve()
      ),
    [apiBaseUrl, client, requestOptions, runMutation]
  );

  return {
    archiveClassroom,
    archiveSubject,
    assignSubject,
    classroomLevelFilter,
    classrooms,
    classroomsNextPage,
    classroomsPrevPage,
    createClassroom,
    createSubject,
    editClassSubject,
    loadClassSubjectsForClassroom,
    mutationErrorKey,
    reactivateClassroom,
    reactivateSubject,
    refreshClassrooms,
    removeSubjectAssignment,
    searchClassrooms,
    searchSubjects,
    setClassroomLevelFilter,
    setClassroomsStatus,
    setSubjectsStatus,
    subjects,
    subjectsNextPage,
    subjectsPrevPage,
    updateClassroom,
    updateSubject,
  };
}

export interface SubjectListState {
  items: SubjectResponse[];
  errorKey: string | null;
  isLoading: boolean;
  limit: number;
  offset: number;
  pageCount: number;
  search: string;
  status: RecordStatus;
  total: number;
}

function emptySubjectListState(): SubjectListState {
  return {
    items: [],
    errorKey: null,
    isLoading: false,
    limit: SUBJECT_PAGE_SIZE,
    offset: 0,
    pageCount: 1,
    search: '',
    status: 'active',
    total: 0,
  };
}

export interface ClassroomListState {
  items: PaginatedClassroomsResponse['items'];
  errorKey: string | null;
  isLoading: boolean;
  limit: number;
  offset: number;
  pageCount: number;
  search: string;
  status: ClassRecordStatus;
  total: number;
}

function emptyClassroomListState(): ClassroomListState {
  return {
    items: [],
    errorKey: null,
    isLoading: false,
    limit: CLASSROOM_PAGE_SIZE,
    offset: 0,
    pageCount: 1,
    search: '',
    status: 'active',
    total: 0,
  };
}
