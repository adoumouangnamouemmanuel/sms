export const AUTH_API_ERROR_MESSAGE_KEYS = {
  ACCOUNT_LOCKED: 'auth.errors.accountLocked',
  FORBIDDEN: 'auth.errors.forbidden',
  INVALID_ACCESS_TOKEN: 'auth.errors.sessionExpired',
  INVALID_CAPABILITY: 'auth.errors.apiUnavailable',
  INVALID_CREDENTIALS: 'auth.errors.invalidCredentials',
  INVALID_CURRENT_PASSWORD: 'auth.errors.invalidCurrentPassword',
  LOCAL_SERVICE_UNAVAILABLE: 'auth.errors.apiUnavailable',
  INVALID_REFRESH_SESSION: 'auth.errors.sessionExpired',
  MISSING_REFRESH_SESSION: 'auth.errors.sessionExpired',
  UNEXPECTED_ORIGIN: 'auth.errors.apiUnavailable',
  USER_NOT_FOUND: 'auth.errors.userNotFound',
} as const;

export type AuthApiErrorCode = keyof typeof AUTH_API_ERROR_MESSAGE_KEYS;

/** Keeps API error handling stable without exposing backend internals to components. */
export class AuthApiError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: number
  ) {
    super(message);
    this.name = 'AuthApiError';
  }
}

export function resolveAuthErrorMessageKey(error: unknown, fallbackKey = 'auth.errors.generic') {
  if (error instanceof AuthApiError && isKnownAuthApiErrorCode(error.code)) {
    return AUTH_API_ERROR_MESSAGE_KEYS[error.code];
  }

  return fallbackKey;
}

function isKnownAuthApiErrorCode(code: string): code is AuthApiErrorCode {
  return code in AUTH_API_ERROR_MESSAGE_KEYS;
}
