export type AuthErrorCode =
  | 'ACCOUNT_LOCKED'
  | 'FORBIDDEN'
  | 'INVALID_ACCESS_TOKEN'
  | 'INVALID_CREDENTIALS'
  | 'INVALID_CURRENT_PASSWORD'
  | 'INVALID_REFRESH_SESSION'
  | 'MISSING_REFRESH_SESSION'
  | 'USER_NOT_FOUND';

/** Public-safe authentication error with a stable machine-readable code. */
export class AuthServiceError extends Error {
  constructor(
    readonly code: AuthErrorCode,
    readonly statusCode: number,
    readonly publicMessage: string
  ) {
    super(publicMessage);
    this.name = 'AuthServiceError';
  }
}

export function invalidCredentials() {
  return new AuthServiceError(
    'INVALID_CREDENTIALS',
    401,
    "L'identifiant ou le mot de passe est incorrect."
  );
}

export function accountLocked() {
  return new AuthServiceError(
    'ACCOUNT_LOCKED',
    423,
    'Le compte est temporairement verrouille. Reessayez dans 15 minutes.'
  );
}

export function forbidden() {
  return new AuthServiceError(
    'FORBIDDEN',
    403,
    "Vous n'etes pas autorise a effectuer cette operation."
  );
}

export function invalidAccessToken() {
  return new AuthServiceError(
    'INVALID_ACCESS_TOKEN',
    401,
    'La session locale est invalide ou expiree.'
  );
}

export function invalidRefreshSession() {
  return new AuthServiceError(
    'INVALID_REFRESH_SESSION',
    401,
    'La session locale doit etre renouvellee.'
  );
}

export function missingRefreshSession() {
  return new AuthServiceError(
    'MISSING_REFRESH_SESSION',
    401,
    'La session locale doit etre renouvelee.'
  );
}

export function invalidCurrentPassword() {
  return new AuthServiceError(
    'INVALID_CURRENT_PASSWORD',
    400,
    'Le mot de passe actuel est incorrect.'
  );
}

export function userNotFound() {
  return new AuthServiceError('USER_NOT_FOUND', 404, 'Utilisateur introuvable.');
}
