import type { AuthTokenResponse, PublicAuthUser } from '@edutrack/shared';

export type AuthenticatedUser = PublicAuthUser;

export interface AuthSessionResult extends AuthTokenResponse {
  refreshToken: string;
}

export interface AuthServiceOptions {
  accessTokenSecret?: string | Uint8Array;
  now?: () => Date;
}

export interface RequestAuditContext {
  correlationId?: string | undefined;
  userAgent?: string | undefined;
}

export interface RefreshTokenMaterial {
  sessionId: string;
  token: string;
  tokenHash: string;
}

export interface ParsedRefreshToken {
  schoolId: string;
  sessionId: string;
}
