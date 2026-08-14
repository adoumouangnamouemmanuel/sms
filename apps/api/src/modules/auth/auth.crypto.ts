import bcrypt from 'bcrypt';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { BCRYPT_COST } from './auth.constants.js';
import { invalidRefreshSession } from './auth.errors.js';
import type { ParsedRefreshToken, RefreshTokenMaterial } from './auth.types.js';

export async function hashPassword(password: string) {
  return bcrypt.hash(password, BCRYPT_COST);
}

export async function verifyPassword(password: string, passwordHash: string) {
  return bcrypt.compare(password, passwordHash);
}

export function hashToken(token: string) {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

export function hashOptional(value: string | undefined) {
  return value ? hashToken(value) : null;
}

/** Encodes tenant and session IDs so refresh can find the tenant-scoped row first. */
export function createRefreshTokenMaterial(schoolId: string): RefreshTokenMaterial {
  const sessionId = randomUUID();
  const secret = randomBytes(32).toString('base64url');
  const token = `${schoolId}.${sessionId}.${secret}`;

  return {
    sessionId,
    token,
    tokenHash: hashToken(token),
  };
}

export function parseRefreshToken(refreshToken: string): ParsedRefreshToken {
  const [schoolId, sessionId, secret, ...extraParts] = refreshToken.split('.');

  if (!schoolId || !sessionId || !secret || extraParts.length > 0) {
    throw invalidRefreshSession();
  }

  return { schoolId, sessionId };
}

export function resolveAccessTokenSecret(secret: string | Uint8Array | undefined) {
  if (secret instanceof Uint8Array) {
    return secret;
  }

  if (secret?.trim()) {
    return new TextEncoder().encode(secret.trim());
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error('AUTH_ACCESS_TOKEN_SECRET is required; refusing to sign tokens with an ephemeral key.');
  }

  console.warn(
    'No access token secret configured. Using an ephemeral key; all sessions end on restart.'
  );

  return randomBytes(32);
}

export function parseDate(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);

  return Number.isNaN(parsed.getTime()) ? null : parsed;
}
