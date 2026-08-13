import type {
  AuthTokenResponse,
  ChangePasswordRequest,
  LoginRequest,
  ResetPasswordRequest,
} from '@edutrack/shared';
import { AuthApiError } from './authErrors';
import { clearAccessToken, createAuthHeaders, rememberAccessToken } from './authSession';

type Fetcher = typeof fetch;

export async function login(apiBaseUrl: string, input: LoginRequest, fetcher: Fetcher = fetch) {
  const session = await postJson<AuthTokenResponse>(apiBaseUrl, '/auth/login', input, fetcher);

  rememberSession(session);

  return session;
}

export async function refreshSession(apiBaseUrl: string, fetcher: Fetcher = fetch) {
  const session = await postJson<AuthTokenResponse>(apiBaseUrl, '/auth/refresh', {}, fetcher);

  rememberSession(session);

  return session;
}

export async function logout(apiBaseUrl: string, fetcher: Fetcher = fetch) {
  await postJson(apiBaseUrl, '/auth/logout', {}, fetcher, createAuthHeaders());
  clearAccessToken();
}

export async function changePassword(
  apiBaseUrl: string,
  input: ChangePasswordRequest,
  fetcher: Fetcher = fetch
) {
  const result = await postJson(
    apiBaseUrl,
    '/auth/password/change',
    input,
    fetcher,
    createAuthHeaders()
  );

  clearAccessToken();

  return result;
}

export async function resetPassword(
  apiBaseUrl: string,
  userId: string,
  input: ResetPasswordRequest,
  fetcher: Fetcher = fetch
) {
  return postJson(
    apiBaseUrl,
    `/auth/users/${encodeURIComponent(userId)}/password/reset`,
    input,
    fetcher,
    createAuthHeaders()
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
  const response = await fetcher(`${apiBaseUrl}${path}`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    body: JSON.stringify(body),
  });
  const payload = (await response.json()) as ApiResponse<T> | ApiErrorResponse;

  if (!response.ok || !payload.success) {
    throw new AuthApiError(
      payload.success ? 'REQUEST_REJECTED' : payload.error.code,
      payload.success ? 'Requete locale refusee.' : payload.error.message,
      response.status
    );
  }

  return payload.data;
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
