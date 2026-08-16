import type {
  AcademicYearStatusRequest,
  AcademicYearWithTerms,
  AcademicYearsResponse,
  AppreciationScaleInput,
  AppreciationScaleView,
  AppreciationScalesResponse,
  AssignPolicyScopesRequest,
  ConfigurationReadinessResponse,
  CreateAcademicYearRequest,
  GradingPoliciesResponse,
  GradingPolicyConfig,
  GradingPolicyDetailResponse,
  ResolvedPolicyResponse,
} from '@edutrack/shared';
import { fetchWithTimeout } from '../../lib/httpClient';
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

// ---------------------------------------------------------------------------
// Academic years (roadmap §9.3)
// ---------------------------------------------------------------------------

/** Lists the school's academic years with their terms (readable by all staff). */
export async function listAcademicYears(
  apiBaseUrl: string,
  options: ConfigurationRequestOptions = {}
) {
  return requestJson<AcademicYearsResponse>(apiBaseUrl, '/configuration/academic-years', {
    method: 'GET',
    options,
  });
}

/** Creates a DRAFT academic year with its terms (SchoolMaster only). */
export async function createAcademicYear(
  apiBaseUrl: string,
  input: CreateAcademicYearRequest,
  options: ConfigurationRequestOptions = {}
) {
  return requestJson<AcademicYearWithTerms>(apiBaseUrl, '/configuration/academic-years', {
    method: 'POST',
    body: input,
    options,
  });
}

/** Activates or closes an academic year; activation rolls the school over. */
export async function changeAcademicYearStatus(
  apiBaseUrl: string,
  yearId: string,
  input: AcademicYearStatusRequest,
  options: ConfigurationRequestOptions = {}
) {
  return requestJson<AcademicYearWithTerms>(
    apiBaseUrl,
    `/configuration/academic-years/${yearId}/status`,
    { method: 'PUT', body: input, options }
  );
}

// ---------------------------------------------------------------------------
// Grading policies (roadmap §9.7-§9.9)
// ---------------------------------------------------------------------------

/** Lists the school's grading policies with their scope assignments. */
export async function listGradingPolicies(
  apiBaseUrl: string,
  options: ConfigurationRequestOptions = {}
) {
  return requestJson<GradingPoliciesResponse>(apiBaseUrl, '/grading-policies', {
    method: 'GET',
    options,
  });
}

/** Loads one policy's full document with its scopes. */
export async function fetchGradingPolicyDetail(
  apiBaseUrl: string,
  policyId: string,
  options: ConfigurationRequestOptions = {}
) {
  return requestJson<GradingPolicyDetailResponse>(apiBaseUrl, `/grading-policies/${policyId}`, {
    method: 'GET',
    options,
  });
}

/** Creates a new DRAFT policy (SchoolMaster only). */
export async function createGradingPolicy(
  apiBaseUrl: string,
  config: GradingPolicyConfig,
  options: ConfigurationRequestOptions = {}
) {
  return requestJson<GradingPolicyDetailResponse>(apiBaseUrl, '/grading-policies', {
    method: 'POST',
    body: config,
    options,
  });
}

/** Replaces a DRAFT policy's whole document (SchoolMaster only). */
export async function updateGradingPolicy(
  apiBaseUrl: string,
  policyId: string,
  config: GradingPolicyConfig,
  options: ConfigurationRequestOptions = {}
) {
  return requestJson<GradingPolicyDetailResponse>(apiBaseUrl, `/grading-policies/${policyId}`, {
    method: 'PUT',
    body: config,
    options,
  });
}

/** Publishes a draft after domain validation (SchoolMaster only). */
export async function publishGradingPolicy(
  apiBaseUrl: string,
  policyId: string,
  options: ConfigurationRequestOptions = {}
) {
  return requestJson<GradingPolicyDetailResponse>(
    apiBaseUrl,
    `/grading-policies/${policyId}/publish`,
    {
      method: 'POST',
      options,
    }
  );
}

/** Creates the next DRAFT version of a policy (SchoolMaster only). */
export async function duplicateGradingPolicy(
  apiBaseUrl: string,
  policyId: string,
  options: ConfigurationRequestOptions = {}
) {
  return requestJson<GradingPolicyDetailResponse>(
    apiBaseUrl,
    `/grading-policies/${policyId}/duplicate`,
    {
      method: 'POST',
      options,
    }
  );
}

/** Replaces a policy's scope assignments atomically (SchoolMaster only). */
export async function assignPolicyScopes(
  apiBaseUrl: string,
  policyId: string,
  input: AssignPolicyScopesRequest,
  options: ConfigurationRequestOptions = {}
) {
  return requestJson<GradingPolicyDetailResponse>(
    apiBaseUrl,
    `/grading-policies/${policyId}/scopes`,
    {
      method: 'PUT',
      body: input,
      options,
    }
  );
}

/** Resolves the published policy covering a (level, subject) scope. */
export async function resolveGradingPolicy(
  apiBaseUrl: string,
  levelId: string,
  subjectId: string | null,
  options: ConfigurationRequestOptions = {}
) {
  const query = subjectId
    ? `levelId=${encodeURIComponent(levelId)}&subjectId=${encodeURIComponent(subjectId)}`
    : `levelId=${encodeURIComponent(levelId)}`;
  return requestJson<ResolvedPolicyResponse>(apiBaseUrl, `/grading-policies/resolved?${query}`, {
    method: 'GET',
    options,
  });
}

// ---------------------------------------------------------------------------
// Appreciation scales (roadmap §9.10)
// ---------------------------------------------------------------------------

/** Lists the school's appreciation scales with their bands. */
export async function listAppreciationScales(
  apiBaseUrl: string,
  options: ConfigurationRequestOptions = {}
) {
  return requestJson<AppreciationScalesResponse>(apiBaseUrl, '/appreciation-scales', {
    method: 'GET',
    options,
  });
}

/** Creates a DRAFT appreciation scale (SchoolMaster only). */
export async function createAppreciationScale(
  apiBaseUrl: string,
  input: AppreciationScaleInput,
  options: ConfigurationRequestOptions = {}
) {
  return requestJson<AppreciationScaleView>(apiBaseUrl, '/appreciation-scales', {
    method: 'POST',
    body: input,
    options,
  });
}

/** Replaces a DRAFT scale (SchoolMaster only). */
export async function updateAppreciationScale(
  apiBaseUrl: string,
  scaleId: string,
  input: AppreciationScaleInput,
  options: ConfigurationRequestOptions = {}
) {
  return requestJson<AppreciationScaleView>(apiBaseUrl, `/appreciation-scales/${scaleId}`, {
    method: 'PUT',
    body: input,
    options,
  });
}

/** Publishes a draft scale after band validation (SchoolMaster only). */
export async function publishAppreciationScale(
  apiBaseUrl: string,
  scaleId: string,
  options: ConfigurationRequestOptions = {}
) {
  return requestJson<AppreciationScaleView>(apiBaseUrl, `/appreciation-scales/${scaleId}/publish`, {
    method: 'POST',
    options,
  });
}

/** Creates the next DRAFT version of a scale (SchoolMaster only). */
export async function duplicateAppreciationScale(
  apiBaseUrl: string,
  scaleId: string,
  options: ConfigurationRequestOptions = {}
) {
  return requestJson<AppreciationScaleView>(
    apiBaseUrl,
    `/appreciation-scales/${scaleId}/duplicate`,
    {
      method: 'POST',
      options,
    }
  );
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
