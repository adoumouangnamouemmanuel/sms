import type {
  ArchiveTeacherRequest,
  CreateTeacherRequest,
  PaginatedTeachersResponse,
  RecordStatus,
  ResetPasswordRequest,
  TeacherListQuery,
  TeacherLoginCreatedResponse,
  TeacherProfileResponse,
  TeacherResponse,
  UpdateTeacherRequest,
} from '@edutrack/shared';
import { useCallback, useEffect, useRef, useState } from 'react';
import { resetPassword as resetTeacherPasswordRequest } from '../auth/authApi';
import {
  archiveTeacher as archiveTeacherRequest,
  createTeacher as createTeacherRequest,
  createTeacherLogin as createTeacherLoginRequest,
  deactivateTeacherLogin as deactivateTeacherLoginRequest,
  getTeacherProfile,
  listTeachers,
  reactivateTeacher as reactivateTeacherRequest,
  reactivateTeacherLogin as reactivateTeacherLoginRequest,
  updateTeacher as updateTeacherRequest,
  type TeachersRequestOptions,
} from './teachersApi';
import { resolveTeachersErrorMessageKey } from './teachersErrors';

export interface TeachersClient {
  archiveTeacher(
    teacherId: string,
    input: ArchiveTeacherRequest,
    options?: TeachersRequestOptions
  ): Promise<TeacherResponse>;
  createTeacher(
    input: CreateTeacherRequest,
    options?: TeachersRequestOptions
  ): Promise<TeacherResponse>;
  createTeacherLogin(
    teacherId: string,
    options?: TeachersRequestOptions
  ): Promise<TeacherLoginCreatedResponse>;
  deactivateTeacherLogin(
    teacherId: string,
    input: ArchiveTeacherRequest,
    options?: TeachersRequestOptions
  ): Promise<TeacherProfileResponse>;
  getTeacherProfile(
    teacherId: string,
    options?: TeachersRequestOptions
  ): Promise<TeacherProfileResponse>;
  listTeachers(
    query: TeacherListQuery,
    options?: TeachersRequestOptions
  ): Promise<PaginatedTeachersResponse>;
  reactivateTeacher(
    teacherId: string,
    input: ArchiveTeacherRequest,
    options?: TeachersRequestOptions
  ): Promise<TeacherResponse>;
  reactivateTeacherLogin(
    teacherId: string,
    options?: TeachersRequestOptions
  ): Promise<TeacherProfileResponse>;
  resetTeacherPassword(
    userId: string,
    input: ResetPasswordRequest,
    options?: TeachersRequestOptions
  ): Promise<unknown>;
  updateTeacher(
    teacherId: string,
    input: UpdateTeacherRequest,
    options?: TeachersRequestOptions
  ): Promise<TeacherResponse>;
}

export interface UseTeachersModuleOptions {
  apiBaseUrl: string | null;
  capabilityToken?: string;
  client?: TeachersClient;
}

const PAGE_SIZE = 20;

export function useTeachersModule({
  apiBaseUrl,
  capabilityToken,
  client,
}: UseTeachersModuleOptions) {
  const [listState, setListState] = useState<ListState>(emptyListState());
  const [profile, setProfile] = useState<TeacherProfileResponse | null>(null);
  const [profileErrorKey, setProfileErrorKey] = useState<string | null>(null);
  const [mutationErrorKey, setMutationErrorKey] = useState<string | null>(null);
  const [createdLogin, setCreatedLogin] = useState<TeacherLoginCreatedResponse | null>(null);
  const latestListRequest = useRef(0);
  const searchDebounceRef = useRef<number | null>(null);

  const requestOptions = useCallback(
    (extra?: TeachersRequestOptions): TeachersRequestOptions => ({
      ...(capabilityToken ? { capabilityToken } : {}),
      ...(extra ?? {}),
    }),
    [capabilityToken]
  );

  const loadList = useCallback(
    async (search: string, offset: number, status: RecordStatus) => {
      if (!apiBaseUrl && !client) {
        return;
      }

      setListState((previous) => ({ ...previous, isLoading: true, errorKey: null }));
      const requestId = ++latestListRequest.current;

      try {
        const page = client
          ? await client.listTeachers(
              { search, status, limit: PAGE_SIZE, offset },
              requestOptions()
            )
          : await listTeachers(
              apiBaseUrl ?? '',
              { search, status, limit: PAGE_SIZE, offset },
              requestOptions()
            );

        if (latestListRequest.current !== requestId) return;

        setListState({
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
        if (latestListRequest.current !== requestId) return;

        setListState((previous) => ({
          ...previous,
          errorKey: resolveTeachersErrorMessageKey(error),
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
      void loadList('', 0, 'active');
    }, 0);

    return () => {
      window.clearTimeout(loadHandle);
    };
  }, [apiBaseUrl, client, loadList]);

  const search = useCallback(
    (query: string) => {
      if (searchDebounceRef.current !== null) {
        window.clearTimeout(searchDebounceRef.current);
      }
      searchDebounceRef.current = window.setTimeout(() => {
        void loadList(query.trim(), 0, listState.status);
      }, 300);
    },
    [listState.status, loadList]
  );

  const setStatus = useCallback(
    (status: RecordStatus) => {
      void loadList(listState.search, 0, status);
    },
    [listState.search, loadList]
  );

  const nextPage = useCallback(() => {
    const nextOffset = listState.offset + listState.limit;

    if (nextOffset < listState.total) {
      void loadList(listState.search, nextOffset, listState.status);
    }
  }, [listState, loadList]);

  const prevPage = useCallback(() => {
    const previousOffset = Math.max(0, listState.offset - listState.limit);

    if (previousOffset !== listState.offset) {
      void loadList(listState.search, previousOffset, listState.status);
    }
  }, [listState, loadList]);

  const openProfile = useCallback(
    async (teacherId: string) => {
      if (!apiBaseUrl && !client) {
        return;
      }

      setProfileErrorKey(null);
      setCreatedLogin(null);

      try {
        const loaded = client
          ? await client.getTeacherProfile(teacherId, requestOptions())
          : await getTeacherProfile(apiBaseUrl ?? '', teacherId, requestOptions());

        setProfile(loaded);
      } catch (error) {
        setProfileErrorKey(resolveTeachersErrorMessageKey(error));
      }
    },
    [apiBaseUrl, client, requestOptions]
  );

  const closeProfile = useCallback(() => {
    setProfile(null);
    setProfileErrorKey(null);
    setCreatedLogin(null);
  }, []);

  const dismissCreatedLogin = useCallback(() => {
    setCreatedLogin(null);
  }, []);

  const runMutation = useCallback(
    async <T>(operation: () => Promise<T>, refresh: () => Promise<void> | void): Promise<T> => {
      setMutationErrorKey(null);

      try {
        const result = await operation();

        await refresh();
        return result;
      } catch (error) {
        setMutationErrorKey(resolveTeachersErrorMessageKey(error));
        throw error;
      }
    },
    []
  );

  const refreshList = useCallback(() => {
    return loadList(listState.search, listState.offset, listState.status);
  }, [listState, loadList]);

  const refreshProfile = useCallback(async () => {
    if (!profile) {
      return;
    }

    const loaded = client
      ? await client.getTeacherProfile(profile.teacher.id, requestOptions())
      : await getTeacherProfile(apiBaseUrl ?? '', profile.teacher.id, requestOptions());

    setProfile(loaded);
  }, [apiBaseUrl, client, profile, requestOptions]);

  const createTeacher = useCallback(
    async (input: CreateTeacherRequest) =>
      runMutation(
        () =>
          client
            ? client.createTeacher(input, requestOptions())
            : createTeacherRequest(apiBaseUrl ?? '', input, requestOptions()),
        refreshList
      ),
    [apiBaseUrl, client, refreshList, requestOptions, runMutation]
  );

  const updateTeacher = useCallback(
    async (teacherId: string, input: UpdateTeacherRequest) =>
      runMutation(
        () =>
          client
            ? client.updateTeacher(teacherId, input, requestOptions())
            : updateTeacherRequest(apiBaseUrl ?? '', teacherId, input, requestOptions()),
        async () => {
          await refreshList();
          await refreshProfile();
        }
      ),
    [apiBaseUrl, client, refreshList, refreshProfile, requestOptions, runMutation]
  );

  const archiveTeacher = useCallback(
    async (teacherId: string, reason: string) =>
      runMutation(
        () =>
          client
            ? client.archiveTeacher(teacherId, { reason }, requestOptions())
            : archiveTeacherRequest(apiBaseUrl ?? '', teacherId, { reason }, requestOptions()),
        async () => {
          await refreshList();
          await refreshProfile();
        }
      ),
    [apiBaseUrl, client, refreshList, refreshProfile, requestOptions, runMutation]
  );

  const reactivateTeacher = useCallback(
    async (teacherId: string, reason: string) =>
      runMutation(
        () =>
          client
            ? client.reactivateTeacher(teacherId, { reason }, requestOptions())
            : reactivateTeacherRequest(apiBaseUrl ?? '', teacherId, { reason }, requestOptions()),
        async () => {
          await refreshList();
          await refreshProfile();
        }
      ),
    [apiBaseUrl, client, refreshList, refreshProfile, requestOptions, runMutation]
  );

  const createLogin = useCallback(
    async (teacherId: string) =>
      runMutation(async () => {
        const credentials = client
          ? await client.createTeacherLogin(teacherId, requestOptions())
          : await createTeacherLoginRequest(apiBaseUrl ?? '', teacherId, requestOptions());

        setCreatedLogin(credentials);
        return credentials;
      }, refreshProfile),
    [apiBaseUrl, client, refreshProfile, requestOptions, runMutation]
  );

  const deactivateLogin = useCallback(
    async (teacherId: string, reason: string) =>
      runMutation(
        () =>
          client
            ? client.deactivateTeacherLogin(teacherId, { reason }, requestOptions())
            : deactivateTeacherLoginRequest(
                apiBaseUrl ?? '',
                teacherId,
                { reason },
                requestOptions()
              ),
        refreshProfile
      ),
    [apiBaseUrl, client, refreshProfile, requestOptions, runMutation]
  );

  const reactivateLogin = useCallback(
    async (teacherId: string) =>
      runMutation(
        () =>
          client
            ? client.reactivateTeacherLogin(teacherId, requestOptions())
            : reactivateTeacherLoginRequest(apiBaseUrl ?? '', teacherId, requestOptions()),
        refreshProfile
      ),
    [apiBaseUrl, client, refreshProfile, requestOptions, runMutation]
  );

  const resetTeacherPassword = useCallback(
    async (userId: string, newPassword: string) =>
      runMutation(
        () =>
          client
            ? client.resetTeacherPassword(userId, { newPassword }, requestOptions())
            : resetTeacherPasswordRequest(
                apiBaseUrl ?? '',
                userId,
                { newPassword },
                requestOptions()
              ),
        refreshProfile
      ),
    [apiBaseUrl, client, refreshProfile, requestOptions, runMutation]
  );

  return {
    archiveTeacher,
    closeProfile,
    createLogin,
    createTeacher,
    createdLogin,
    deactivateLogin,
    dismissCreatedLogin,
    mutationErrorKey,
    nextPage,
    openProfile,
    prevPage,
    profile,
    profileErrorKey,
    reactivateLogin,
    reactivateTeacher,
    resetTeacherPassword,
    search,
    setStatus,
    teachers: listState,
    updateTeacher,
  };
}

export interface ListState {
  items: TeacherResponse[];
  errorKey: string | null;
  isLoading: boolean;
  limit: number;
  offset: number;
  pageCount: number;
  search: string;
  status: RecordStatus;
  total: number;
}

function emptyListState(): ListState {
  return {
    items: [],
    errorKey: null,
    isLoading: false,
    limit: PAGE_SIZE,
    offset: 0,
    pageCount: 1,
    search: '',
    status: 'active',
    total: 0,
  };
}
