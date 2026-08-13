import { SignJWT, jwtVerify } from 'jose';
import { isAuthUserRole, type PublicAuthUser } from '@edutrack/shared';
import {
  ACCESS_TOKEN_AUDIENCE,
  ACCESS_TOKEN_ISSUER,
  ACCESS_TOKEN_TTL_SECONDS,
} from './auth.constants.js';
import { invalidAccessToken } from './auth.errors.js';
import type { AuthenticatedUser } from './auth.types.js';

export async function createAccessToken(
  user: PublicAuthUser,
  issuedAt: Date,
  accessTokenSecret: Uint8Array
) {
  const accessTokenExpiresAt = new Date(
    issuedAt.getTime() + ACCESS_TOKEN_TTL_SECONDS * 1000
  ).toISOString();
  const accessToken = await new SignJWT({
    schoolId: user.schoolId,
    username: user.username,
    role: user.role,
  })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setSubject(user.id)
    .setIssuer(ACCESS_TOKEN_ISSUER)
    .setAudience(ACCESS_TOKEN_AUDIENCE)
    .setIssuedAt(Math.floor(issuedAt.getTime() / 1000))
    .setExpirationTime(Math.floor(new Date(accessTokenExpiresAt).getTime() / 1000))
    .sign(accessTokenSecret);

  return {
    accessToken,
    accessTokenExpiresAt,
  };
}

export async function verifyAccessToken(
  accessToken: string,
  accessTokenSecret: Uint8Array,
  currentDate?: Date
): Promise<AuthenticatedUser> {
  try {
    const verifyOptions = {
      issuer: ACCESS_TOKEN_ISSUER,
      audience: ACCESS_TOKEN_AUDIENCE,
      ...(currentDate ? { currentDate } : {}),
    };
    const { payload } = await jwtVerify(accessToken, accessTokenSecret, verifyOptions);
    const role = payload.role;

    if (
      typeof payload.sub !== 'string' ||
      typeof payload.schoolId !== 'string' ||
      typeof payload.username !== 'string' ||
      !isAuthUserRole(role)
    ) {
      throw invalidAccessToken();
    }

    return {
      id: payload.sub,
      schoolId: payload.schoolId,
      username: payload.username,
      role,
    };
  } catch {
    throw invalidAccessToken();
  }
}

export function parseAuthorizationHeader(headerValue: string | undefined) {
  if (!headerValue) {
    throw invalidAccessToken();
  }

  const [scheme, token] = headerValue.split(' ');

  if (scheme !== 'Bearer' || !token) {
    throw invalidAccessToken();
  }

  return token;
}
