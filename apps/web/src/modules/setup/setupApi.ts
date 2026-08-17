import {
  SIDECAR_CAPABILITY_HEADER,
  type AdvanceSetupStepRequest,
  type SetupCalendarRequest,
  type SetupClassLevelsRequest,
  type SetupSchoolProfileRequest,
  type SetupStateResponse,
} from '@edutrack/shared';
import { fetchWithTimeout } from '../../lib/httpClient';
import { createAuthHeaders } from '../auth';
import { SetupApiError } from './setupErrors';

type Fetcher = typeof fetch;

export interface SetupRequestOptions {
  capabilityToken?: string;
  fetcher?: Fetcher;
}

export async function getSetupState(apiBaseUrl: string, options: SetupRequestOptions = {}) {
  return requestJson<SetupStateResponse>(apiBaseUrl, '/setup/state', {
    method: 'GET',
    options,
  });
}

export async function saveSchoolProfile(
  apiBaseUrl: string,
  input: SetupSchoolProfileRequest,
  options: SetupRequestOptions = {}
) {
  return requestJson<SetupStateResponse>(apiBaseUrl, '/setup/profile', {
    method: 'PUT',
    body: input,
    options,
  });
}

export async function saveSetupCalendar(
  apiBaseUrl: string,
  input: SetupCalendarRequest,
  options: SetupRequestOptions = {}
) {
  return requestJson<SetupStateResponse>(apiBaseUrl, '/setup/calendar', {
    method: 'PUT',
    body: input,
    options,
  });
}

export async function saveSetupClassLevels(
  apiBaseUrl: string,
  input: SetupClassLevelsRequest,
  options: SetupRequestOptions = {}
) {
  return requestJson<SetupStateResponse>(apiBaseUrl, '/setup/class-levels', {
    method: 'PUT',
    body: input,
    options,
  });
}

export async function advanceSetupStep(
  apiBaseUrl: string,
  input: AdvanceSetupStepRequest,
  options: SetupRequestOptions = {}
) {
  return requestJson<SetupStateResponse>(apiBaseUrl, '/setup/step', {
    method: 'PUT',
    body: input,
    options,
  });
}

export async function completeSetup(apiBaseUrl: string, options: SetupRequestOptions = {}) {
  return requestJson<SetupStateResponse>(apiBaseUrl, '/setup/complete', {
    method: 'POST',
    body: {},
    options,
  });
}

async function requestJson<T>(
  apiBaseUrl: string,
  path: string,
  request: {
    method: 'GET' | 'POST' | 'PUT';
    body?: unknown;
    options: SetupRequestOptions;
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
    throw new SetupApiError('LOCAL_SERVICE_UNAVAILABLE', 'Local service unavailable.', 0);
  }

  let payload: ApiResponse<T> | ApiErrorResponse;

  try {
    payload = (await response.json()) as ApiResponse<T> | ApiErrorResponse;
  } catch {
    throw new SetupApiError(
      'LOCAL_SERVICE_UNAVAILABLE',
      'Local service returned an unreadable response.',
      response.status
    );
  }

  if (!response.ok || !payload.success) {
    throw new SetupApiError(
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
