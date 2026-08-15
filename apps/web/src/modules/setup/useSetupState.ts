import {
  type SetupCalendarRequest,
  type SetupClassLevelsRequest,
  type SetupSchoolProfileRequest,
  type SetupStateResponse,
} from '@edutrack/shared';
import { useCallback, useEffect, useState } from 'react';
import {
  completeSetup,
  getSetupState,
  saveSchoolProfile,
  saveSetupCalendar,
  saveSetupClassLevels,
  type SetupRequestOptions,
} from './setupApi';
import { resolveSetupErrorMessageKey } from './setupErrors';

export interface SetupClient {
  complete: (options?: SetupRequestOptions) => Promise<SetupStateResponse>;
  getState: (options?: SetupRequestOptions) => Promise<SetupStateResponse>;
  saveCalendar: (
    input: SetupCalendarRequest,
    options?: SetupRequestOptions
  ) => Promise<SetupStateResponse>;
  saveClassLevels: (
    input: SetupClassLevelsRequest,
    options?: SetupRequestOptions
  ) => Promise<SetupStateResponse>;
  saveProfile: (
    input: SetupSchoolProfileRequest,
    options?: SetupRequestOptions
  ) => Promise<SetupStateResponse>;
}

export interface UseSetupStateOptions {
  apiBaseUrl: string | null;
  capabilityToken?: string;
  client?: SetupClient;
}

export function useSetupState({ apiBaseUrl, capabilityToken, client }: UseSetupStateOptions) {
  const [state, setState] = useState<SetupStateResponse | null>(null);
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const requestOptions = useCallback(
    (extra?: SetupRequestOptions): SetupRequestOptions => ({
      ...(capabilityToken ? { capabilityToken } : {}),
      ...(extra ?? {}),
    }),
    [capabilityToken]
  );

  const load = useCallback(async () => {
    if (!apiBaseUrl && !client) {
      return;
    }

    setIsLoading(true);
    setErrorKey(null);

    try {
      const nextState = client
        ? await client.getState(requestOptions())
        : await getSetupState(apiBaseUrl ?? '', requestOptions());

      setState(nextState);
    } catch (error) {
      setErrorKey(resolveSetupErrorMessageKey(error));
    } finally {
      setIsLoading(false);
    }
  }, [apiBaseUrl, client, requestOptions]);

  useEffect(() => {
    const loadHandle = window.setTimeout(() => {
      void load();
    }, 0);

    return () => {
      window.clearTimeout(loadHandle);
    };
  }, [load]);

  const persist = useCallback(
    async (operation: () => Promise<SetupStateResponse>) => {
      if (!apiBaseUrl && !client) {
        setErrorKey('setup.errors.localService');
        return null;
      }

      setIsSaving(true);
      setErrorKey(null);

      try {
        const nextState = await operation();

        setState(nextState);
        return nextState;
      } catch (error) {
        setErrorKey(resolveSetupErrorMessageKey(error));
        return null;
      } finally {
        setIsSaving(false);
      }
    },
    [apiBaseUrl, client]
  );

  const saveProfile = useCallback(
    async (input: SetupSchoolProfileRequest) =>
      persist(async () =>
        client
          ? client.saveProfile(input, requestOptions())
          : saveSchoolProfile(apiBaseUrl ?? '', input, requestOptions())
      ),
    [apiBaseUrl, client, persist, requestOptions]
  );

  const saveCalendar = useCallback(
    async (input: SetupCalendarRequest) =>
      persist(async () =>
        client
          ? client.saveCalendar(input, requestOptions())
          : saveSetupCalendar(apiBaseUrl ?? '', input, requestOptions())
      ),
    [apiBaseUrl, client, persist, requestOptions]
  );

  const saveClassLevels = useCallback(
    async (input: SetupClassLevelsRequest) =>
      persist(async () =>
        client
          ? client.saveClassLevels(input, requestOptions())
          : saveSetupClassLevels(apiBaseUrl ?? '', input, requestOptions())
      ),
    [apiBaseUrl, client, persist, requestOptions]
  );

  const complete = useCallback(
    async () =>
      persist(async () =>
        client
          ? client.complete(requestOptions())
          : completeSetup(apiBaseUrl ?? '', requestOptions())
      ),
    [apiBaseUrl, client, persist, requestOptions]
  );

  const updateState = useCallback((nextState: SetupStateResponse) => {
    setState(nextState);
  }, []);

  return {
    complete,
    errorKey,
    isLoading,
    isSaving,
    reload: load,
    saveCalendar,
    saveClassLevels,
    saveProfile,
    state,
    /** Lets screens inside the main shell (settings, structure) refresh the shared state. */
    updateState,
  };
}
