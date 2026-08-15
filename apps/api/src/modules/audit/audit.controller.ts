import type { FastifyReply, FastifyRequest } from 'fastify';
import { AuthServiceError, parseAuthorizationHeader, type AuthService } from '../auth/index.js';
import { readHeader } from '../auth/auth.cookies.js';
import { AuditServiceError } from './audit.errors.js';
import type { AuditService } from './audit.service.js';

const recentAuditQuerySchema = {
  limit: 10,
};

/** Handles audit HTTP validation, auth, and response envelopes. */
export class AuditController {
  constructor(
    private readonly authService: AuthService,
    private readonly auditService: AuditService
  ) {}

  readonly listRecent = async (request: FastifyRequest, reply: FastifyReply) => {
    const query = request.query as { limit?: string };
    const limit = parseLimit(query.limit);

    try {
      const actor = await this.authenticateRequest(request);

      return await reply.send({
        success: true,
        data: this.auditService.listRecent(actor, limit),
        message: 'Activite recente chargee.',
      });
    } catch (error) {
      return sendAuditError(reply, error);
    }
  };

  private async authenticateRequest(request: FastifyRequest) {
    return this.authService.verifyAccessToken(
      parseAuthorizationHeader(readHeader(request.headers.authorization))
    );
  }
}

function parseLimit(raw: string | undefined): number {
  const parsed = Number.parseInt(raw ?? String(recentAuditQuerySchema.limit), 10);

  return Number.isFinite(parsed) && parsed >= 1 ? parsed : recentAuditQuerySchema.limit;
}

function sendAuditError(reply: FastifyReply, error: unknown) {
  const publicError =
    error instanceof AuditServiceError || error instanceof AuthServiceError
      ? error
      : new AuditServiceError('AUDIT_FAILED', 500, "Le journal d'activite est indisponible.");

  return reply.code(publicError.statusCode).send({
    success: false,
    error: {
      code: publicError.code,
      message: publicError.publicMessage,
    },
  });
}
