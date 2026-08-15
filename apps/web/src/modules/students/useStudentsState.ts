import type {
  ArchiveGuardianRequest,
  ArchiveStudentRequest,
  CreateGuardianRequest,
  CreateStudentRequest,
  GuardianListQuery,
  GuardianProfileResponse,
  GuardianResponse,
  LinkStudentGuardianRequest,
  PaginatedGuardiansResponse,
  PaginatedStudentsResponse,
  RecordStatus,
  PersonSex,
  StudentGuardianLinkResponse,
  StudentListQuery,
  StudentProfileResponse,
  StudentResponse,
  UpdateGuardianRequest,
  UpdateStudentGuardianLinkRequest,
  UpdateStudentRequest,
} from '@edutrack/shared';
import { useCallback, useEffect, useState } from 'react';
import {
  archiveGuardian as archiveGuardianRequest,
  archiveStudent as archiveStudentRequest,
  createGuardian as createGuardianRequest,
  createStudent as createStudentRequest,
  getGuardianProfile,
  getStudentProfile,
  linkGuardian as linkGuardianRequest,
  listGuardians,
  listStudents,
  reactivateGuardian as reactivateGuardianRequest,
  reactivateStudent as reactivateStudentRequest,
  unlinkGuardian as unlinkGuardianRequest,
  updateGuardian as updateGuardianRequest,
  updateGuardianLink as updateGuardianLinkRequest,
  updateStudent as updateStudentRequest,
  type StudentsRequestOptions,
} from './studentsApi';
import { resolveStudentsErrorMessageKey } from './studentsErrors';

export type PeopleTab = 'students' | 'guardians';

export interface StudentsClient {
  archiveGuardian(
    guardianId: string,
    input: ArchiveGuardianRequest,
    options?: StudentsRequestOptions
  ): Promise<GuardianResponse>;
  archiveStudent(
    studentId: string,
    input: ArchiveStudentRequest,
    options?: StudentsRequestOptions
  ): Promise<StudentResponse>;
  createGuardian(
    input: CreateGuardianRequest,
    options?: StudentsRequestOptions
  ): Promise<GuardianResponse>;
  createStudent(
    input: CreateStudentRequest,
    options?: StudentsRequestOptions
  ): Promise<StudentResponse>;
  getGuardianProfile(
    guardianId: string,
    options?: StudentsRequestOptions
  ): Promise<GuardianProfileResponse>;
  getStudentProfile(
    studentId: string,
    options?: StudentsRequestOptions
  ): Promise<StudentProfileResponse>;
  linkGuardian(
    studentId: string,
    input: LinkStudentGuardianRequest,
    options?: StudentsRequestOptions
  ): Promise<StudentGuardianLinkResponse>;
  listGuardians(
    query: GuardianListQuery,
    options?: StudentsRequestOptions
  ): Promise<PaginatedGuardiansResponse>;
  listStudents(
    query: StudentListQuery,
    options?: StudentsRequestOptions
  ): Promise<PaginatedStudentsResponse>;
  reactivateGuardian(
    guardianId: string,
    input: ArchiveGuardianRequest,
    options?: StudentsRequestOptions
  ): Promise<GuardianResponse>;
  reactivateStudent(
    studentId: string,
    input: ArchiveStudentRequest,
    options?: StudentsRequestOptions
  ): Promise<StudentResponse>;
  unlinkGuardian(
    linkId: string,
    options?: StudentsRequestOptions
  ): Promise<StudentGuardianLinkResponse>;
  updateGuardian(
    guardianId: string,
    input: UpdateGuardianRequest,
    options?: StudentsRequestOptions
  ): Promise<GuardianResponse>;
  updateGuardianLink(
    linkId: string,
    input: UpdateStudentGuardianLinkRequest,
    options?: StudentsRequestOptions
  ): Promise<StudentGuardianLinkResponse>;
  updateStudent(
    studentId: string,
    input: UpdateStudentRequest,
    options?: StudentsRequestOptions
  ): Promise<StudentResponse>;
}

export interface UseStudentsModuleOptions {
  apiBaseUrl: string | null;
  capabilityToken?: string;
  client?: StudentsClient;
}

export interface PaginatedListState<T> {
  items: T[];
  errorKey: string | null;
  isLoading: boolean;
  limit: number;
  offset: number;
  pageCount: number;
  search: string;
  status: RecordStatus;
  classLevelId: string | null;
  /** ACTIVE-enrollment classroom filter (current year), null = all. */
  classroomId: string | null;
  sex: PersonSex | null;
  total: number;
}

const PAGE_SIZE = 20;

export function useStudentsModule({
  apiBaseUrl,
  capabilityToken,
  client,
}: UseStudentsModuleOptions) {
  const [tab, setTab] = useState<PeopleTab>('students');

  const [studentsList, setStudentsList] =
    useState<PaginatedListState<StudentResponse>>(emptyListState());
  const [guardiansList, setGuardiansList] =
    useState<PaginatedListState<GuardianResponse>>(emptyListState());
  const [studentProfile, setStudentProfile] = useState<StudentProfileResponse | null>(null);
  const [guardianProfile, setGuardianProfile] = useState<GuardianProfileResponse | null>(null);
  const [profileErrorKey, setProfileErrorKey] = useState<string | null>(null);
  const [mutationErrorKey, setMutationErrorKey] = useState<string | null>(null);

  const requestOptions = useCallback(
    (extra?: StudentsRequestOptions): StudentsRequestOptions => ({
      ...(capabilityToken ? { capabilityToken } : {}),
      ...(extra ?? {}),
    }),
    [capabilityToken]
  );

  const loadStudents = useCallback(
    async (
      search: string,
      offset: number,
      status: RecordStatus,
      classLevelId: string | null,
      classroomId: string | null,
      sex: PersonSex | null
    ) => {
      if (!apiBaseUrl && !client) {
        return;
      }

      setStudentsList((previous) => ({ ...previous, isLoading: true, errorKey: null }));

      try {
        const page = client
          ? await client.listStudents(
              {
                search,
                status,
                limit: PAGE_SIZE,
                offset,
                ...(classLevelId ? { classLevelId } : {}),
                ...(classroomId ? { classroomId } : {}),
                ...(sex ? { sex } : {}),
              },
              requestOptions()
            )
          : await listStudents(
              apiBaseUrl ?? '',
              {
                search,
                status,
                limit: PAGE_SIZE,
                offset,
                ...(classLevelId ? { classLevelId } : {}),
                ...(classroomId ? { classroomId } : {}),
                ...(sex ? { sex } : {}),
              },
              requestOptions()
            );

        setStudentsList({
          items: page.items,
          errorKey: null,
          isLoading: false,
          limit: page.limit,
          offset: page.offset,
          pageCount: Math.max(1, Math.ceil(page.total / page.limit)),
          search,
          status,
          classLevelId,
          classroomId,
          sex,
          total: page.total,
        });
      } catch (error) {
        setStudentsList((previous) => ({
          ...previous,
          errorKey: resolveStudentsErrorMessageKey(error),
          isLoading: false,
        }));
      }
    },
    [apiBaseUrl, client, requestOptions]
  );

  const loadGuardians = useCallback(
    async (search: string, offset: number, status: RecordStatus) => {
      if (!apiBaseUrl && !client) {
        return;
      }

      setGuardiansList((previous) => ({ ...previous, isLoading: true, errorKey: null }));

      try {
        const page = client
          ? await client.listGuardians(
              { search, status, limit: PAGE_SIZE, offset },
              requestOptions()
            )
          : await listGuardians(
              apiBaseUrl ?? '',
              { search, status, limit: PAGE_SIZE, offset },
              requestOptions()
            );

        setGuardiansList({
          items: page.items,
          errorKey: null,
          isLoading: false,
          limit: page.limit,
          offset: page.offset,
          pageCount: Math.max(1, Math.ceil(page.total / page.limit)),
          search,
          status,
          classLevelId: null,
          classroomId: null,
          sex: null,
          total: page.total,
        });
      } catch (error) {
        setGuardiansList((previous) => ({
          ...previous,
          errorKey: resolveStudentsErrorMessageKey(error),
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

    const loadHandle = window.setTimeout(() => {
      void loadStudents('', 0, 'active', null, null, null);
      void loadGuardians('', 0, 'active');
    }, 0);

    return () => {
      window.clearTimeout(loadHandle);
    };
  }, [client, loadGuardians, loadStudents, apiBaseUrl]);

  const searchStudents = useCallback(
    (search: string) => {
      void loadStudents(
        search.trim(),
        0,
        studentsList.status,
        studentsList.classLevelId,
        studentsList.classroomId,
        studentsList.sex
      );
    },
    [loadStudents, studentsList]
  );

  const searchGuardians = useCallback(
    (search: string) => {
      void loadGuardians(search.trim(), 0, guardiansList.status);
    },
    [guardiansList.status, loadGuardians]
  );

  const setStudentsStatus = useCallback(
    (status: RecordStatus) => {
      void loadStudents(
        studentsList.search,
        0,
        status,
        studentsList.classLevelId,
        studentsList.classroomId,
        studentsList.sex
      );
    },
    [loadStudents, studentsList]
  );

  const setStudentsClassLevel = useCallback(
    (classLevelId: string | null) => {
      // Changing the level invalidates any classroom selection from another level.
      void loadStudents(studentsList.search, 0, studentsList.status, classLevelId, null, studentsList.sex);
    },
    [loadStudents, studentsList]
  );

  const setStudentsClassroom = useCallback(
    (classroomId: string | null) => {
      void loadStudents(
        studentsList.search,
        0,
        studentsList.status,
        studentsList.classLevelId,
        classroomId,
        studentsList.sex
      );
    },
    [loadStudents, studentsList]
  );

  const setStudentsSex = useCallback(
    (sex: PersonSex | null) => {
      void loadStudents(
        studentsList.search,
        0,
        studentsList.status,
        studentsList.classLevelId,
        studentsList.classroomId,
        sex
      );
    },
    [loadStudents, studentsList]
  );

  const setGuardiansStatus = useCallback(
    (status: RecordStatus) => {
      void loadGuardians(guardiansList.search, 0, status);
    },
    [guardiansList.search, loadGuardians]
  );

  const nextStudentsPage = useCallback(() => {
    const nextOffset = studentsList.offset + studentsList.limit;

    if (nextOffset < studentsList.total) {
      void loadStudents(
        studentsList.search,
        nextOffset,
        studentsList.status,
        studentsList.classLevelId,
        studentsList.classroomId,
        studentsList.sex
      );
    }
  }, [loadStudents, studentsList]);

  const prevStudentsPage = useCallback(() => {
    const previousOffset = Math.max(0, studentsList.offset - studentsList.limit);

    if (previousOffset !== studentsList.offset) {
      void loadStudents(
        studentsList.search,
        previousOffset,
        studentsList.status,
        studentsList.classLevelId,
        studentsList.classroomId,
        studentsList.sex
      );
    }
  }, [loadStudents, studentsList]);

  const nextGuardiansPage = useCallback(() => {
    const nextOffset = guardiansList.offset + guardiansList.limit;

    if (nextOffset < guardiansList.total) {
      void loadGuardians(guardiansList.search, nextOffset, guardiansList.status);
    }
  }, [guardiansList, loadGuardians]);

  const prevGuardiansPage = useCallback(() => {
    const previousOffset = Math.max(0, guardiansList.offset - guardiansList.limit);

    if (previousOffset !== guardiansList.offset) {
      void loadGuardians(guardiansList.search, previousOffset, guardiansList.status);
    }
  }, [guardiansList, loadGuardians]);

  const openStudent = useCallback(
    async (studentId: string) => {
      if (!apiBaseUrl && !client) {
        return;
      }

      setProfileErrorKey(null);

      try {
        const profile = client
          ? await client.getStudentProfile(studentId, requestOptions())
          : await getStudentProfile(apiBaseUrl ?? '', studentId, requestOptions());

        setStudentProfile(profile);
      } catch (error) {
        setProfileErrorKey(resolveStudentsErrorMessageKey(error));
      }
    },
    [apiBaseUrl, client, requestOptions]
  );

  const openGuardian = useCallback(
    async (guardianId: string) => {
      if (!apiBaseUrl && !client) {
        return;
      }

      setProfileErrorKey(null);

      try {
        const profile = client
          ? await client.getGuardianProfile(guardianId, requestOptions())
          : await getGuardianProfile(apiBaseUrl ?? '', guardianId, requestOptions());

        setGuardianProfile(profile);
      } catch (error) {
        setProfileErrorKey(resolveStudentsErrorMessageKey(error));
      }
    },
    [apiBaseUrl, client, requestOptions]
  );

  const closeStudent = useCallback(() => {
    setStudentProfile(null);
    setProfileErrorKey(null);
  }, []);

  const closeGuardian = useCallback(() => {
    setGuardianProfile(null);
    setProfileErrorKey(null);
  }, []);

  const runMutation = useCallback(
    async <T>(operation: () => Promise<T>, refresh: () => Promise<void> | void): Promise<T> => {
      setMutationErrorKey(null);

      try {
        const result = await operation();

        await refresh();
        return result;
      } catch (error) {
        setMutationErrorKey(resolveStudentsErrorMessageKey(error));
        throw error;
      }
    },
    []
  );

  const refreshStudents = useCallback(() => {
    return loadStudents(
      studentsList.search,
      studentsList.offset,
      studentsList.status,
      studentsList.classLevelId,
      studentsList.classroomId,
      studentsList.sex
    );
  }, [loadStudents, studentsList]);

  const refreshGuardians = useCallback(() => {
    return loadGuardians(guardiansList.search, guardiansList.offset, guardiansList.status);
  }, [guardiansList, loadGuardians]);

  const refreshStudentProfile = useCallback(async () => {
    if (!studentProfile) {
      return;
    }

    const profile = client
      ? await client.getStudentProfile(studentProfile.student.id, requestOptions())
      : await getStudentProfile(apiBaseUrl ?? '', studentProfile.student.id, requestOptions());

    setStudentProfile(profile);
  }, [apiBaseUrl, client, requestOptions, studentProfile]);

  const refreshGuardianProfile = useCallback(async () => {
    if (!guardianProfile) {
      return;
    }

    const profile = client
      ? await client.getGuardianProfile(guardianProfile.guardian.id, requestOptions())
      : await getGuardianProfile(apiBaseUrl ?? '', guardianProfile.guardian.id, requestOptions());

    setGuardianProfile(profile);
  }, [apiBaseUrl, client, guardianProfile, requestOptions]);

  const createStudent = useCallback(
    async (input: CreateStudentRequest) =>
      runMutation(async () => {
        const created = client
          ? await client.createStudent(input, requestOptions())
          : await createStudentRequest(apiBaseUrl ?? '', input, requestOptions());

        setTab('students');
        return created;
      }, refreshStudents),
    [apiBaseUrl, client, refreshStudents, requestOptions, runMutation]
  );

  const updateStudent = useCallback(
    async (studentId: string, input: UpdateStudentRequest) =>
      runMutation(
        () =>
          client
            ? client.updateStudent(studentId, input, requestOptions())
            : updateStudentRequest(apiBaseUrl ?? '', studentId, input, requestOptions()),
        async () => {
          await refreshStudents();
          await refreshStudentProfile();
        }
      ),
    [apiBaseUrl, client, refreshStudentProfile, refreshStudents, requestOptions, runMutation]
  );

  const archiveStudent = useCallback(
    async (studentId: string, reason: string) =>
      runMutation(
        () =>
          client
            ? client.archiveStudent(studentId, { reason }, requestOptions())
            : archiveStudentRequest(apiBaseUrl ?? '', studentId, { reason }, requestOptions()),
        async () => {
          await refreshStudents();
          await refreshStudentProfile();
        }
      ),
    [apiBaseUrl, client, refreshStudentProfile, refreshStudents, requestOptions, runMutation]
  );

  const reactivateStudent = useCallback(
    async (studentId: string, reason: string) =>
      runMutation(
        () =>
          client
            ? client.reactivateStudent(studentId, { reason }, requestOptions())
            : reactivateStudentRequest(apiBaseUrl ?? '', studentId, { reason }, requestOptions()),
        async () => {
          await refreshStudents();
          await refreshStudentProfile();
        }
      ),
    [apiBaseUrl, client, refreshStudentProfile, refreshStudents, requestOptions, runMutation]
  );

  const createGuardian = useCallback(
    async (input: CreateGuardianRequest) =>
      runMutation(async () => {
        const created = client
          ? await client.createGuardian(input, requestOptions())
          : await createGuardianRequest(apiBaseUrl ?? '', input, requestOptions());

        setTab('guardians');
        return created;
      }, refreshGuardians),
    [apiBaseUrl, client, refreshGuardians, requestOptions, runMutation]
  );

  const updateGuardian = useCallback(
    async (guardianId: string, input: UpdateGuardianRequest) =>
      runMutation(
        () =>
          client
            ? client.updateGuardian(guardianId, input, requestOptions())
            : updateGuardianRequest(apiBaseUrl ?? '', guardianId, input, requestOptions()),
        async () => {
          await refreshGuardians();
          await refreshGuardianProfile();
        }
      ),
    [apiBaseUrl, client, refreshGuardianProfile, refreshGuardians, requestOptions, runMutation]
  );

  const archiveGuardian = useCallback(
    async (guardianId: string, reason: string) =>
      runMutation(
        () =>
          client
            ? client.archiveGuardian(guardianId, { reason }, requestOptions())
            : archiveGuardianRequest(apiBaseUrl ?? '', guardianId, { reason }, requestOptions()),
        async () => {
          await refreshGuardians();
          await refreshGuardianProfile();
        }
      ),
    [apiBaseUrl, client, refreshGuardianProfile, refreshGuardians, requestOptions, runMutation]
  );

  const reactivateGuardian = useCallback(
    async (guardianId: string, reason: string) =>
      runMutation(
        () =>
          client
            ? client.reactivateGuardian(guardianId, { reason }, requestOptions())
            : reactivateGuardianRequest(apiBaseUrl ?? '', guardianId, { reason }, requestOptions()),
        async () => {
          await refreshGuardians();
          await refreshGuardianProfile();
        }
      ),
    [apiBaseUrl, client, refreshGuardianProfile, refreshGuardians, requestOptions, runMutation]
  );

  const linkGuardian = useCallback(
    async (studentId: string, input: LinkStudentGuardianRequest) =>
      runMutation(
        () =>
          client
            ? client.linkGuardian(studentId, input, requestOptions())
            : linkGuardianRequest(apiBaseUrl ?? '', studentId, input, requestOptions()),
        refreshStudentProfile
      ),
    [apiBaseUrl, client, refreshStudentProfile, requestOptions, runMutation]
  );

  const updateLink = useCallback(
    async (linkId: string, input: UpdateStudentGuardianLinkRequest) =>
      runMutation(
        () =>
          client
            ? client.updateGuardianLink(linkId, input, requestOptions())
            : updateGuardianLinkRequest(apiBaseUrl ?? '', linkId, input, requestOptions()),
        refreshStudentProfile
      ),
    [apiBaseUrl, client, refreshStudentProfile, requestOptions, runMutation]
  );

  const unlinkLink = useCallback(
    async (linkId: string) =>
      runMutation(
        () =>
          client
            ? client.unlinkGuardian(linkId, requestOptions())
            : unlinkGuardianRequest(apiBaseUrl ?? '', linkId, requestOptions()),
        refreshStudentProfile
      ),
    [apiBaseUrl, client, refreshStudentProfile, requestOptions, runMutation]
  );

  return {
    archiveGuardian,
    archiveStudent,
    closeGuardian,
    closeStudent,
    createGuardian,
    createStudent,
    guardianProfile,
    guardians: guardiansList,
    linkGuardian,
    mutationErrorKey,
    nextGuardiansPage,
    nextStudentsPage,
    openGuardian,
    openStudent,
    prevGuardiansPage,
    prevStudentsPage,
    profileErrorKey,
    reactivateGuardian,
    reactivateStudent,
    searchGuardians,
    searchStudents,
    setGuardiansStatus,
    setStudentsClassLevel,
    setStudentsClassroom,
    setStudentsSex,
    setStudentsStatus,
    studentProfile,
    students: studentsList,
    tab,
    setTab,
    unlinkLink,
    updateGuardian,
    updateLink,
    updateStudent,
  };
}

function emptyListState<T>(): PaginatedListState<T> {
  return {
    items: [],
    errorKey: null,
    isLoading: false,
    limit: PAGE_SIZE,
    offset: 0,
    pageCount: 1,
    search: '',
    status: 'active',
    classLevelId: null,
    classroomId: null,
    sex: null,
    total: 0,
  };
}
