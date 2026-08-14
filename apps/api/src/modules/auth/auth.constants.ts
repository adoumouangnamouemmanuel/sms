export const BCRYPT_COST = 12;
export const MAX_FAILED_LOGIN_ATTEMPTS = 5;
export const ACCOUNT_LOCKOUT_MS = 15 * 60 * 1000;
export const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;
export const REFRESH_TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60;
export const ACCESS_TOKEN_ISSUER = 'edutrack-africa-local';
export const ACCESS_TOKEN_AUDIENCE = 'edutrack-africa-desktop';
export const REFRESH_COOKIE_NAME = 'edutrack_refresh_session';

// Bcrypt cost 12 dummy hash used to reduce timing clues for unknown schools/users.
export const DUMMY_PASSWORD_HASH = '$2b$12$C6UzMDM.H6dfI/f/IKcEeOq8GmUiZ6ztp7Z8VsYzHf5fQK1x6ZVdW';
