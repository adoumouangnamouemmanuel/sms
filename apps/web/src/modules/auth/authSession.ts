let accessToken: string | null = null;
let accessTokenExpiresAt: string | null = null;

/** Keeps access tokens in memory only; refresh tokens remain httpOnly cookies. */
export function rememberAccessToken(token: string, expiresAt: string) {
  accessToken = token;
  accessTokenExpiresAt = expiresAt;
}

export function getAccessToken() {
  return accessToken;
}

export function getAccessTokenExpiresAt() {
  return accessTokenExpiresAt;
}

export function clearAccessToken() {
  accessToken = null;
  accessTokenExpiresAt = null;
}

export function createAuthHeaders() {
  return accessToken ? { Authorization: `Bearer ${accessToken}` } : {};
}
