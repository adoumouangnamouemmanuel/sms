import type { ConfigurationReadinessResponse } from '@edutrack/shared';
import { fetchWithTimeout } from '../../httpClient';
import { createAuthHeaders } from '../auth';

type Fetcher = typeof fetch;

export interface ConfigurationRequestOptions {
  capabilityToken?: string;
  fetcher?: Fetcher;
}

export class ConfigurationApiError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: number
  ) {
    super(message);
    this.name = 'ConfigurationApiError';
  }
}

const CONFIGURATION_API_ERROR_MESSAGE_KEYS = {
  CONFIGURATION_FAILED: 'configuration.errors.failed',
  CONFIGURATION_NOT_READY: 'configuration.errors.notReady',
  FORBIDDEN: 'configuration.errors.forbidden',
  INVALID_ACCESS_TOKEN: 'configuration.errors.sessionExpired',
  LOCAL_SERVICE_UNAVAILABLE: 'configuration.errors.localService',
  ROUTE_NOT_FOUND: 'configuration.errors.serviceUpdate',
  UNKNOWN_ERROR: 'configuration.errors.failed',
  VALIDATION_ERROR: 'configuration.errors.validation',
} as const;

type ConfigurationApiErrorCode = keyof typeof CONFIGURATION_API_ERROR_MESSAGE_KEYS;

export function resolveConfigurationErrorMessageKey(error: unknown) {
  if (error instanceof ConfigurationApiError && isKnownConfigurationApiErrorCode(error.code)) {
    return CONFIGURATION_API_ERROR_MESSAGE_KEYS[error.code];
  }

  return 'configuration.errors.failed';
}

function isKnownConfigurationApiErrorCode(code: string): code is ConfigurationApiErrorCode {
  return code in CONFIGURATION_API_ERROR_MESSAGE_KEYS;
}

/** Loads the backend-computed configuration readiness state (roadmap §9.1). */
export async function fetchConfigurationReadiness(
  apiBaseUrl: string,
  options: ConfigurationRequestOptions = {}
) {
  return requestJson<ConfigurationReadinessResponse>(apiBaseUrl, '/configuration/readiness', {
    method: 'GET',
    options,
  });
}

interface RequestJsonOptions {
  method: 'GET' | 'POST' | 'PUT';
  body?: unknown;
  options: ConfigurationRequestOptions;
}

async function requestJson<T>(
  apiBaseUrl: string,
  path: string,
  { method, body, options }: RequestJsonOptions
) {
  const fetcher = options.fetcher ?? fetch;

  if (!apiBaseUrl) {
    throw new ConfigurationApiError('LOCAL_SERVICE_UNAVAILABLE', 'Service local indisponible.', 0);
  }

  const init: RequestInit = {
    method,
    headers: {
      ...createAuthHeaders(),
      ...(options.capabilityToken ? { 'x-edutrack-capability': options.capabilityToken } : {}),
      ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
    },
  };

  if (body !== undefined) {
    init.body = JSON.stringify(body);
  }

  try {
    const response = await fetchWithTimeout(fetcher, `${apiBaseUrl}${path}`, init);

    if (!response.ok) {
      const payload = (await readJson(response)) as ApiErrorPayload;
      throw new ConfigurationApiError(
        payload.error?.code ?? 'UNKNOWN_ERROR',
        payload.error?.message ?? 'Une erreur est survenue.',
        response.status
      );
    }

    const payload = (await readJson(response)) as ApiSuccess<T>;
    return payload.data;
  } catch (error) {
    if (error instanceof ConfigurationApiError) {
      throw error;
    }

    throw new ConfigurationApiError('LOCAL_SERVICE_UNAVAILABLE', 'Service local indisponible.', 0);
  }
}

function readJson(response: Response) {
  return response.json() as Promise<unknown>;
}

interface ApiSuccess<T> {
  success: true;
  data: T;
}

interface ApiErrorPayload {
  error?: { code?: string; message?: string };
}
