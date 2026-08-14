import {
  createAuditLogRepository,
  createRefreshSessionRepository,
  createSchoolRepository,
  createTenantContext,
  createUserRepository,
  withTransaction,
  type CredentialUserRecord,
  type EduTrackDatabase,
  type RefreshSessionRecord,
  type SafeUserRecord,
} from '@edutrack/db';
import {
  isAuthUserRole,
  type AuthUserRole,
  type ChangePasswordRequest,
  type LoginRequest,
  type PublicAuthUser,
  type ResetPasswordRequest,
} from '@edutrack/shared';
import {
  ACCOUNT_LOCKOUT_MS,
  DUMMY_PASSWORD_HASH,
  MAX_FAILED_LOGIN_ATTEMPTS,
  REFRESH_TOKEN_TTL_SECONDS,
} from './auth.constants.js';
import { failureMetadata, successMetadata } from './auth.audit.js';
import {
  createRefreshTokenMaterial,
  hashOptional,
  hashPassword,
  hashToken,
  parseDate,
  parseRefreshToken,
  resolveAccessTokenSecret,
  verifyPassword,
} from './auth.crypto.js';
import {
  accountLocked,
  forbidden,
  invalidCredentials,
  invalidCurrentPassword,
  invalidRefreshSession,
  missingRefreshSession,
  userNotFound,
  AuthServiceError,
} from './auth.errors.js';
import { createAccessToken, verifyAccessToken } from './auth.tokens.js';
import type { AuthenticatedUser, AuthServiceOptions, RequestAuditContext } from './auth.types.js';

/** Application service for local login, rotation, password changes and reset policy. */
export class AuthService {
  private readonly accessTokenSecret: Uint8Array;
  private readonly now: () => Date;

  constructor(
    private readonly db: EduTrackDatabase,
    options: AuthServiceOptions = {}
  ) {
    this.accessTokenSecret = resolveAccessTokenSecret(options.accessTokenSecret);
    this.now = options.now ?? (() => new Date());
  }

  async login(input: LoginRequest, requestContext: RequestAuditContext = {}) {
    const school = createSchoolRepository(this.db).findActiveByCode(input.schoolCode);

    if (!school) {
      await verifyPassword(input.password, DUMMY_PASSWORD_HASH);
      throw invalidCredentials();
    }

    const tenant = createTenantContext(school.id);
    const userRepository = createUserRepository(this.db, tenant);
    const auditRepository = createAuditLogRepository(this.db, tenant);
    const authUser = userRepository.findActiveByUsernameForAuth(input.username);

    if (!authUser) {
      await verifyPassword(input.password, DUMMY_PASSWORD_HASH);
      auditRepository.createEvent({
        action: 'AUTH_LOGIN',
        targetType: 'user',
        correlationId: requestContext.correlationId ?? null,
        metadata: failureMetadata('invalid_credentials', requestContext, {
          username: input.username,
        }),
        outcome: 'FAILURE',
      });
      throw invalidCredentials();
    }

    this.assertSupportedRole(authUser, requestContext);
    this.assertNotLocked(authUser, requestContext);

    if (!(await verifyPassword(input.password, authUser.passwordHash))) {
      this.recordFailedLogin(authUser, requestContext);
      throw this.willLockAfterFailure(authUser) ? accountLocked() : invalidCredentials();
    }

    return this.createAuthenticatedSession(toPublicAuthUser(authUser), {
      deviceName: input.deviceName,
      requestContext,
    });
  }

  async refresh(refreshToken: string | undefined, requestContext: RequestAuditContext = {}) {
    if (!refreshToken) {
      throw missingRefreshSession();
    }

    const parsedToken = parseRefreshToken(refreshToken);
    const tenant = createTenantContext(parsedToken.schoolId);
    const sessionRepository = createRefreshSessionRepository(this.db, tenant);
    const auditRepository = createAuditLogRepository(this.db, tenant);
    const existingSession = sessionRepository.findByIdAndTokenHash(
      parsedToken.sessionId,
      hashToken(refreshToken)
    );

    if (!existingSession) {
      throw invalidRefreshSession();
    }

    const currentTime = this.now();

    if (isRefreshSessionInvalid(existingSession, currentTime)) {
      // Reuse of a rotated token is treated as possible theft; revoke the family.
      sessionRepository.revokeFamily(existingSession.familyId, currentTime.toISOString());
      auditRepository.createEvent({
        actorUserId: existingSession.userId,
        action: 'AUTH_REFRESH',
        targetType: 'refresh_session',
        targetId: existingSession.id,
        correlationId: requestContext.correlationId ?? null,
        metadata: failureMetadata('invalid_refresh_session', requestContext),
        outcome: 'FAILURE',
      });
      throw invalidRefreshSession();
    }

    const authUser = createUserRepository(this.db, tenant).findActiveByIdForAuth(
      existingSession.userId
    );

    if (!authUser || !isAuthUserRole(authUser.role)) {
      sessionRepository.revokeFamily(existingSession.familyId, currentTime.toISOString());
      auditRepository.createEvent({
        actorUserId: existingSession.userId,
        action: 'AUTH_REFRESH',
        targetType: 'refresh_session',
        targetId: existingSession.id,
        correlationId: requestContext.correlationId ?? null,
        metadata: failureMetadata('user_unavailable', requestContext),
        outcome: 'FAILURE',
      });
      throw invalidRefreshSession();
    }

    return this.rotateRefreshSession(
      toPublicAuthUser(authUser),
      existingSession.familyId,
      existingSession.id,
      requestContext
    );
  }

  logout(refreshToken: string | undefined, requestContext: RequestAuditContext = {}) {
    if (!refreshToken) {
      return;
    }

    const parsedToken = parseRefreshToken(refreshToken);
    const tenant = createTenantContext(parsedToken.schoolId);
    const existingSession = createRefreshSessionRepository(this.db, tenant).findByIdAndTokenHash(
      parsedToken.sessionId,
      hashToken(refreshToken)
    );

    if (!existingSession) {
      return;
    }

    const loggedOutAt = this.now().toISOString();

    withTransaction(this.db, (transaction) => {
      createRefreshSessionRepository(transaction, tenant).revokeSession(
        existingSession.id,
        loggedOutAt
      );
      createAuditLogRepository(transaction, tenant).createEvent({
        actorUserId: existingSession.userId,
        action: 'AUTH_LOGOUT',
        targetType: 'refresh_session',
        targetId: existingSession.id,
        correlationId: requestContext.correlationId ?? null,
        metadata: successMetadata(requestContext),
      });
    });
  }

  async changePassword(
    actor: AuthenticatedUser,
    input: ChangePasswordRequest,
    requestContext: RequestAuditContext = {}
  ) {
    const tenant = createTenantContext(actor.schoolId);
    const authUser = createUserRepository(this.db, tenant).findActiveByIdForAuth(actor.id);

    if (!authUser) {
      throw userNotFound();
    }

    if (!(await verifyPassword(input.currentPassword, authUser.passwordHash))) {
      createAuditLogRepository(this.db, tenant).createEvent({
        actorUserId: actor.id,
        action: 'AUTH_PASSWORD_CHANGE',
        targetType: 'user',
        targetId: actor.id,
        correlationId: requestContext.correlationId ?? null,
        metadata: failureMetadata('invalid_current_password', requestContext),
        outcome: 'FAILURE',
      });
      throw invalidCurrentPassword();
    }

    return this.updatePasswordAndRevokeSessions(actor, actor.id, input.newPassword, {
      action: 'AUTH_PASSWORD_CHANGE',
      requestContext,
    });
  }

  async resetPassword(
    actor: AuthenticatedUser,
    targetUserId: string,
    input: ResetPasswordRequest,
    requestContext: RequestAuditContext = {}
  ) {
    if (actor.role !== 'SCHOOL_MASTER') {
      throw forbidden();
    }

    const tenant = createTenantContext(actor.schoolId);
    const targetUser = createUserRepository(this.db, tenant).findActiveById(targetUserId);

    if (!targetUser) {
      throw userNotFound();
    }

    return this.updatePasswordAndRevokeSessions(actor, targetUserId, input.newPassword, {
      action: 'AUTH_PASSWORD_RESET',
      requestContext,
      metadata: { targetRole: targetUser.role },
    });
  }

  verifyAccessToken(accessToken: string) {
    return verifyAccessToken(accessToken, this.accessTokenSecret, this.now());
  }

  getAuthenticatedUser(actor: AuthenticatedUser) {
    const user = createUserRepository(this.db, createTenantContext(actor.schoolId)).findActiveById(
      actor.id
    );

    if (!user) {
      throw userNotFound();
    }

    return toPublicAuthUser(user);
  }

  private assertSupportedRole(authUser: CredentialUserRecord, requestContext: RequestAuditContext) {
    if (isAuthUserRole(authUser.role)) {
      return;
    }

    createAuditLogRepository(this.db, createTenantContext(authUser.schoolId)).createEvent({
      actorUserId: authUser.id,
      action: 'AUTH_LOGIN',
      targetType: 'user',
      targetId: authUser.id,
      correlationId: requestContext.correlationId ?? null,
      metadata: failureMetadata('unsupported_role', requestContext),
      outcome: 'FAILURE',
    });
    throw forbidden();
  }

  private assertNotLocked(authUser: CredentialUserRecord, requestContext: RequestAuditContext) {
    const existingLock = parseDate(authUser.lockedUntil);

    if (!existingLock || existingLock <= this.now()) {
      return;
    }

    createAuditLogRepository(this.db, createTenantContext(authUser.schoolId)).createEvent({
      actorUserId: authUser.id,
      action: 'AUTH_LOGIN',
      targetType: 'user',
      targetId: authUser.id,
      correlationId: requestContext.correlationId ?? null,
      metadata: failureMetadata('account_locked', requestContext, {
        lockedUntil: existingLock.toISOString(),
      }),
      outcome: 'FAILURE',
    });
    throw accountLocked();
  }

  private recordFailedLogin(authUser: CredentialUserRecord, requestContext: RequestAuditContext) {
    const currentTime = this.now();
    const nextAttempts = getNextFailedAttempts(authUser, currentTime);
    const lockedUntil =
      nextAttempts >= MAX_FAILED_LOGIN_ATTEMPTS
        ? new Date(currentTime.getTime() + ACCOUNT_LOCKOUT_MS).toISOString()
        : null;
    const tenant = createTenantContext(authUser.schoolId);

    withTransaction(this.db, (transaction) => {
      createUserRepository(transaction, tenant).recordFailedLogin(
        authUser.id,
        nextAttempts,
        lockedUntil,
        currentTime.toISOString()
      );
      createAuditLogRepository(transaction, tenant).createEvent({
        actorUserId: authUser.id,
        action: 'AUTH_LOGIN',
        targetType: 'user',
        targetId: authUser.id,
        correlationId: requestContext.correlationId ?? null,
        metadata: failureMetadata('invalid_credentials', requestContext, {
          failedLoginAttempts: nextAttempts,
          lockedUntil,
        }),
        outcome: 'FAILURE',
      });
    });
  }

  private willLockAfterFailure(authUser: CredentialUserRecord) {
    return getNextFailedAttempts(authUser, this.now()) >= MAX_FAILED_LOGIN_ATTEMPTS;
  }

  private async createAuthenticatedSession(
    user: PublicAuthUser,
    options: { deviceName?: string | undefined; requestContext: RequestAuditContext }
  ) {
    const currentTime = this.now();
    const refreshTokenExpiresAt = new Date(
      currentTime.getTime() + REFRESH_TOKEN_TTL_SECONDS * 1000
    ).toISOString();
    const refreshToken = createRefreshTokenMaterial(user.schoolId);
    const accessTokenResult = await createAccessToken(user, currentTime, this.accessTokenSecret);
    const tenant = createTenantContext(user.schoolId);

    withTransaction(this.db, (transaction) => {
      createUserRepository(transaction, tenant).recordSuccessfulLogin(
        user.id,
        currentTime.toISOString()
      );
      createRefreshSessionRepository(transaction, tenant).createSession({
        id: refreshToken.sessionId,
        userId: user.id,
        tokenHash: refreshToken.tokenHash,
        expiresAt: refreshTokenExpiresAt,
        deviceName: options.deviceName,
        userAgentHash: hashOptional(options.requestContext.userAgent),
      });
      createAuditLogRepository(transaction, tenant).createEvent({
        actorUserId: user.id,
        action: 'AUTH_LOGIN',
        targetType: 'user',
        targetId: user.id,
        correlationId: options.requestContext.correlationId ?? null,
        metadata: successMetadata(options.requestContext),
      });
    });

    return {
      ...accessTokenResult,
      refreshToken: refreshToken.token,
      refreshTokenExpiresAt,
      user,
    };
  }

  private async rotateRefreshSession(
    user: PublicAuthUser,
    familyId: string,
    oldSessionId: string,
    requestContext: RequestAuditContext
  ) {
    const currentTime = this.now();
    const refreshTokenExpiresAt = new Date(
      currentTime.getTime() + REFRESH_TOKEN_TTL_SECONDS * 1000
    ).toISOString();
    const refreshToken = createRefreshTokenMaterial(user.schoolId);
    const accessTokenResult = await createAccessToken(user, currentTime, this.accessTokenSecret);
    const tenant = createTenantContext(user.schoolId);

    try {
      withTransaction(this.db, (transaction) => {
        createRefreshSessionRepository(transaction, tenant).createSession({
          id: refreshToken.sessionId,
          userId: user.id,
          tokenHash: refreshToken.tokenHash,
          familyId,
          expiresAt: refreshTokenExpiresAt,
          userAgentHash: hashOptional(requestContext.userAgent),
        });

        const replaced = createRefreshSessionRepository(transaction, tenant).replaceSession(
          oldSessionId,
          refreshToken.sessionId,
          currentTime.toISOString()
        );

        if (!replaced) {
          throw invalidRefreshSession();
        }

        createAuditLogRepository(transaction, tenant).createEvent({
          actorUserId: user.id,
          action: 'AUTH_REFRESH',
          targetType: 'refresh_session',
          targetId: oldSessionId,
          correlationId: requestContext.correlationId ?? null,
          metadata: successMetadata(requestContext),
        });
      });
    } catch (error) {
      if (error instanceof AuthServiceError && error.code === 'INVALID_REFRESH_SESSION') {
        createRefreshSessionRepository(this.db, tenant).revokeFamily(
          familyId,
          currentTime.toISOString()
        );
        createAuditLogRepository(this.db, tenant).createEvent({
          actorUserId: user.id,
          action: 'AUTH_REFRESH',
          targetType: 'refresh_session',
          targetId: oldSessionId,
          correlationId: requestContext.correlationId ?? null,
          metadata: failureMetadata('invalid_refresh_session', requestContext),
          outcome: 'FAILURE',
        });
      }
      throw error;
    }

    return {
      ...accessTokenResult,
      refreshToken: refreshToken.token,
      refreshTokenExpiresAt,
      user,
    };
  }

  private async updatePasswordAndRevokeSessions(
    actor: AuthenticatedUser,
    targetUserId: string,
    newPassword: string,
    options: {
      action: 'AUTH_PASSWORD_CHANGE' | 'AUTH_PASSWORD_RESET';
      requestContext: RequestAuditContext;
      metadata?: Record<string, unknown>;
    }
  ) {
    const tenant = createTenantContext(actor.schoolId);
    const changedAt = this.now().toISOString();
    const passwordHash = await hashPassword(newPassword);

    return withTransaction(this.db, (transaction) => {
      const updatedUser = createUserRepository(transaction, tenant).updatePasswordHash(
        targetUserId,
        passwordHash,
        changedAt
      );

      createRefreshSessionRepository(transaction, tenant).revokeUserSessions(
        targetUserId,
        changedAt
      );
      createAuditLogRepository(transaction, tenant).createEvent({
        actorUserId: actor.id,
        action: options.action,
        targetType: 'user',
        targetId: targetUserId,
        correlationId: options.requestContext.correlationId ?? null,
        metadata: successMetadata(options.requestContext, options.metadata),
      });

      return requireUpdatedUser(updatedUser);
    });
  }
}

function isRefreshSessionInvalid(session: RefreshSessionRecord, currentTime: Date) {
  const expiresAt = parseDate(session.expiresAt);

  return (
    session.revokedAt !== null ||
    session.replacedBySessionId !== null ||
    expiresAt === null ||
    expiresAt <= currentTime
  );
}

function getNextFailedAttempts(authUser: CredentialUserRecord, currentTime: Date) {
  const existingLock = parseDate(authUser.lockedUntil);

  // After an expired lock, start the counter fresh instead of extending punishment.
  return existingLock && existingLock <= currentTime ? 1 : authUser.failedLoginAttempts + 1;
}

function toPublicAuthUser(user: SafeUserRecord & { role: AuthUserRole }): PublicAuthUser {
  return {
    id: user.id,
    schoolId: user.schoolId,
    username: user.username,
    role: user.role,
  };
}

function requireUpdatedUser(user: SafeUserRecord | undefined) {
  if (!user) {
    throw userNotFound();
  }

  return toPublicAuthUser(user);
}
