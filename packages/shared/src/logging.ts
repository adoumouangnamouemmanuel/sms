import { SIDECAR_CAPABILITY_HEADER } from './sidecar.js';

export const SENSITIVE_LOG_FIELDS = [
  'req.headers.authorization',
  'req.headers.cookie',
  `req.headers['${SIDECAR_CAPABILITY_HEADER}']`,
  "res.headers['set-cookie']",
  'body.password',
  'body.currentPassword',
  'body.newPassword',
  'body.passwordHash',
  'body.password_hash',
  'body.token',
  'body.accessToken',
  'body.refreshToken',
  'body.sessionSecret',
] as const;

export const REDACTED_LOG_VALUE = '[redacted]';
