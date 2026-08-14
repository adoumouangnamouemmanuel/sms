import type { FastifyReply, FastifyRequest } from 'fastify';
import { REFRESH_TOKEN_TTL_SECONDS } from './auth.constants.js';
import { readHeader, readRefreshCookie, serializeRefreshCookie } from './auth.cookies.js';
import { AuthServiceError } from './auth.errors.js';
import {
  changePasswordRequestSchema,
  loginRequestSchema,
  resetPasswordRequestSchema,
  type AuthTokenResponse,
} from './auth.schema.js';
import { parseAuthorizationHeader } from './auth.tokens.js';
import type { AuthService } from './auth.service.js';
import type { AuthSessionResult, RequestAuditContext } from './auth.types.js';

/** Handles HTTP validation and response envelopes for the auth module. */
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  readonly login = async (request: FastifyRequest, reply: FastifyReply) => {
    const parsedBody = loginRequestSchema.safeParse(request.body);

    if (!parsedBody.success) {
      return sendValidationError(reply, parsedBody.error);
    }

    try {
      return await sendAuthSession(
        reply,
        await this.authService.login(parsedBody.data, getRequestAuditContext(request))
      );
    } catch (error) {
      return sendAuthError(reply, error);
    }
  };

  readonly refresh = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      return await sendAuthSession(
        reply,
        await this.authService.refresh(readRefreshCookie(request), getRequestAuditContext(request))
      );
    } catch (error) {
      return sendAuthError(reply, error, { clearRefreshCookie: true });
    }
  };

  readonly logout = (request: FastifyRequest, reply: FastifyReply) => {
    try {
      this.authService.logout(readRefreshCookie(request), getRequestAuditContext(request));
    } catch {
      // Logout is idempotent: stale cookies should still be cleared client-side.
    }

    return reply.header('Set-Cookie', serializeRefreshCookie('', { maxAgeSeconds: 0 })).send({
      success: true,
      data: { loggedOut: true },
      message: 'Deconnexion effectuee.',
    });
  };

  readonly me = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const actor = await this.authenticateRequest(request);

      return await reply.send({
        success: true,
        data: { user: this.authService.getAuthenticatedUser(actor) },
        message: 'Session locale valide.',
      });
    } catch (error) {
      return sendAuthError(reply, error);
    }
  };

  readonly changePassword = async (request: FastifyRequest, reply: FastifyReply) => {
    const parsedBody = changePasswordRequestSchema.safeParse(request.body);

    if (!parsedBody.success) {
      return sendValidationError(reply, parsedBody.error);
    }

    try {
      const actor = await this.authenticateRequest(request);
      const user = await this.authService.changePassword(
        actor,
        parsedBody.data,
        getRequestAuditContext(request)
      );

      return await reply
        .header('Set-Cookie', serializeRefreshCookie('', { maxAgeSeconds: 0 }))
        .send({
          success: true,
          data: { user },
          message: 'Mot de passe modifie.',
        });
    } catch (error) {
      return sendAuthError(reply, error);
    }
  };

  readonly resetPassword = async (request: FastifyRequest, reply: FastifyReply) => {
    const parsedBody = resetPasswordRequestSchema.safeParse(request.body);

    if (!parsedBody.success) {
      return sendValidationError(reply, parsedBody.error);
    }

    try {
      const actor = await this.authenticateRequest(request);
      const targetUserId = getRouteUserId(request);
      const user = await this.authService.resetPassword(
        actor,
        targetUserId,
        parsedBody.data,
        getRequestAuditContext(request)
      );

      if (actor.id === targetUserId) {
        reply.header('Set-Cookie', serializeRefreshCookie('', { maxAgeSeconds: 0 }));
      }

      return await reply.send({
        success: true,
        data: { user },
        message: 'Mot de passe reinitialise.',
      });
    } catch (error) {
      return sendAuthError(reply, error);
    }
  };

  private async authenticateRequest(request: FastifyRequest) {
    const token = parseAuthorizationHeader(readHeader(request.headers.authorization));

    return this.authService.verifyAccessToken(token);
  }
}

function sendAuthSession(reply: FastifyReply, result: AuthSessionResult) {
  const responseBody: AuthTokenResponse = {
    accessToken: result.accessToken,
    accessTokenExpiresAt: result.accessTokenExpiresAt,
    refreshTokenExpiresAt: result.refreshTokenExpiresAt,
    user: result.user,
  };

  return reply
    .header(
      'Set-Cookie',
      serializeRefreshCookie(result.refreshToken, {
        maxAgeSeconds: REFRESH_TOKEN_TTL_SECONDS,
      })
    )
    .send({
      success: true,
      data: responseBody,
      message: 'Session locale ouverte.',
    });
}

function sendAuthError(
  reply: FastifyReply,
  error: unknown,
  options: { clearRefreshCookie?: boolean } = {}
) {
  const authError =
    error instanceof AuthServiceError
      ? error
      : new AuthServiceError(
          'INVALID_ACCESS_TOKEN',
          500,
          "Une erreur d'authentification est survenue."
        );

  if (options.clearRefreshCookie) {
    reply.header('Set-Cookie', serializeRefreshCookie('', { maxAgeSeconds: 0 }));
  }

  return reply.code(authError.statusCode).send({
    success: false,
    error: {
      code: authError.code,
      message: authError.publicMessage,
    },
  });
}

function sendValidationError(reply: FastifyReply, error: { issues: ValidationIssue[] }) {
  const fields: Record<string, string> = {};

  for (const issue of error.issues) {
    const path = issue.path.map(String).join('.');

    if (path) {
      fields[path] = issue.message;
    }
  }

  return reply.code(400).send({
    success: false,
    error: {
      code: 'VALIDATION_ERROR',
      message: 'Les donnees envoyees sont invalides.',
      fields,
    },
  });
}

function getRequestAuditContext(request: FastifyRequest): RequestAuditContext {
  return {
    correlationId: request.id,
    userAgent: readHeader(request.headers['user-agent']),
  };
}

function getRouteUserId(request: FastifyRequest) {
  const params = request.params as { userId?: unknown };

  if (typeof params.userId !== 'string' || !params.userId) {
    throw new AuthServiceError('USER_NOT_FOUND', 404, 'Utilisateur introuvable.');
  }

  return params.userId;
}

interface ValidationIssue {
  path: PropertyKey[];
  message: string;
}
