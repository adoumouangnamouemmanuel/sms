import type {
  AuthTokenResponse,
  ChangePasswordRequest,
  LoginRequest,
  ResetPasswordRequest,
} from '@edutrack/shared';
import { SIDECAR_CAPABILITY_HEADER } from '@edutrack/shared';
import { fetchWithTimeout } from '../../httpClient';
import { AuthApiError } from './authErrors';
import { clearAccessToken, createAuthHeaders, rememberAccessToken } from './authSession';

type Fetcher = typeof fetch;
type AuthRequestOptionsInput = Fetcher | AuthRequestOptions;

export interface AuthRequestOptions {
  capabilityToken?: string;
  fetcher?: Fetcher;
}

export async function login(
  apiBaseUrl: string,
  input: LoginRequest,
  options: AuthRequestOptionsInput = {}
) {
  const requestOptions = resolveRequestOptions(options);
  const session = await postJson<AuthTokenResponse>(
    apiBaseUrl,
    '/auth/login',
    input,
    requestOptions.fetcher,
    createSidecarHeaders(requestOptions.capabilityToken)
  );

  rememberSession(session);

  return session;
}

export async function refreshSession(apiBaseUrl: string, options: AuthRequestOptionsInput = {}) {
  const requestOptions = resolveRequestOptions(options);
  const session = await postJson<AuthTokenResponse>(
    apiBaseUrl,
    '/auth/refresh',
    {},
    requestOptions.fetcher,
    createSidecarHeaders(requestOptions.capabilityToken)
  );

  rememberSession(session);

  return session;
}

export async function logout(apiBaseUrl: string, options: AuthRequestOptionsInput = {}) {
  const requestOptions = resolveRequestOptions(options);

  try {
    await postJson(apiBaseUrl, '/auth/logout', {}, requestOptions.fetcher, {
      ...createSidecarHeaders(requestOptions.capabilityToken),
      ...createAuthHeaders(),
    });
  } finally {
    clearAccessToken();
  }
}

export async function changePassword(
  apiBaseUrl: string,
  input: ChangePasswordRequest,
  options: AuthRequestOptionsInput = {}
) {
  const requestOptions = resolveRequestOptions(options);

  const result = await postJson(
    apiBaseUrl,
    '/auth/password/change',
    input,
    requestOptions.fetcher,
    {
      ...createSidecarHeaders(requestOptions.capabilityToken),
      ...createAuthHeaders(),
    }
  );

  clearAccessToken();

  return result;
}

export async function resetPassword(
  apiBaseUrl: string,
  userId: string,
  input: ResetPasswordRequest,
  options: AuthRequestOptionsInput = {}
) {
  const requestOptions = resolveRequestOptions(options);

  return postJson(
    apiBaseUrl,
    `/auth/users/${encodeURIComponent(userId)}/password/reset`,
    input,
    requestOptions.fetcher,
    {
      ...createSidecarHeaders(requestOptions.capabilityToken),
      ...createAuthHeaders(),
    }
  );
}

function rememberSession(session: AuthTokenResponse) {
  rememberAccessToken(session.accessToken, session.accessTokenExpiresAt);
}

async function postJson<T = unknown>(
  apiBaseUrl: string,
  path: string,
  body: unknown,
  fetcher: Fetcher,
  headers: Record<string, string> = {}
) {
  let response: Response;

  try {
    response = await fetchWithTimeout(fetcher, `${apiBaseUrl}${path}`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
      body: JSON.stringify(body),
    });
  } catch {
    throw new AuthApiError('LOCAL_SERVICE_UNAVAILABLE', 'Local service unavailable.', 0);
  }

  let payload: ApiResponse<T> | ApiErrorResponse;

  try {
    payload = (await response.json()) as ApiResponse<T> | ApiErrorResponse;
  } catch {
    throw new AuthApiError(
      'LOCAL_SERVICE_UNAVAILABLE',
      'Local service returned an unreadable response.',
      response.status
    );
  }

  if (!response.ok || !payload.success) {
    throw new AuthApiError(
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

function resolveRequestOptions(options: AuthRequestOptionsInput): Required<AuthRequestOptions> {
  if (typeof options === 'function') {
    return {
      capabilityToken: '',
      fetcher: options,
    };
  }

  return {
    capabilityToken: options.capabilityToken ?? '',
    fetcher: options.fetcher ?? fetch,
  };
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
