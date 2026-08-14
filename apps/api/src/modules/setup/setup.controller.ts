import type { FastifyReply, FastifyRequest } from 'fastify';
import { AuthServiceError, parseAuthorizationHeader, type AuthService } from '../auth/index.js';
import { readHeader } from '../auth/auth.cookies.js';
import type { RequestAuditContext } from '../auth/auth.types.js';
import {
  setupCalendarRequestSchema,
  setupClassLevelsRequestSchema,
  setupSchoolProfileRequestSchema,
} from './setup.schema.js';
import { SetupServiceError } from './setup.errors.js';
import type { SetupService } from './setup.service.js';

/** Handles setup HTTP validation, auth, and response envelopes. */
export class SetupController {
  constructor(
    private readonly authService: AuthService,
    private readonly setupService: SetupService
  ) {}

  readonly state = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const actor = await this.authenticateRequest(request);

      return await reply.send({
        success: true,
        data: this.setupService.getState(actor),
        message: 'Configuration locale chargee.',
      });
    } catch (error) {
      return sendSetupError(reply, error);
    }
  };

  readonly saveProfile = async (request: FastifyRequest, reply: FastifyReply) => {
    const parsedBody = setupSchoolProfileRequestSchema.safeParse(request.body);

    if (!parsedBody.success) {
      return sendValidationError(reply, parsedBody.error);
    }

    try {
      const actor = await this.authenticateRequest(request);

      return await reply.send({
        success: true,
        data: this.setupService.saveProfile(
          actor,
          parsedBody.data,
          getRequestAuditContext(request)
        ),
        message: 'Profil de l ecole enregistre.',
      });
    } catch (error) {
      return sendSetupError(reply, error);
    }
  };

  readonly saveCalendar = async (request: FastifyRequest, reply: FastifyReply) => {
    const parsedBody = setupCalendarRequestSchema.safeParse(request.body);

    if (!parsedBody.success) {
      return sendValidationError(reply, parsedBody.error);
    }

    try {
      const actor = await this.authenticateRequest(request);

      return await reply.send({
        success: true,
        data: this.setupService.saveCalendar(
          actor,
          parsedBody.data,
          getRequestAuditContext(request)
        ),
        message: 'Annee scolaire enregistree.',
      });
    } catch (error) {
      return sendSetupError(reply, error);
    }
  };

  readonly saveClassLevels = async (request: FastifyRequest, reply: FastifyReply) => {
    const parsedBody = setupClassLevelsRequestSchema.safeParse(request.body);

    if (!parsedBody.success) {
      return sendValidationError(reply, parsedBody.error);
    }

    try {
      const actor = await this.authenticateRequest(request);

      return await reply.send({
        success: true,
        data: this.setupService.saveClassLevels(
          actor,
          parsedBody.data,
          getRequestAuditContext(request)
        ),
        message: 'Niveaux de classe enregistres.',
      });
    } catch (error) {
      return sendSetupError(reply, error);
    }
  };

  readonly complete = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const actor = await this.authenticateRequest(request);

      return await reply.send({
        success: true,
        data: this.setupService.completeSetup(actor, getRequestAuditContext(request)),
        message: 'Configuration locale terminee.',
      });
    } catch (error) {
      return sendSetupError(reply, error);
    }
  };

  private async authenticateRequest(request: FastifyRequest) {
    return this.authService.verifyAccessToken(
      parseAuthorizationHeader(readHeader(request.headers.authorization))
    );
  }
}

function sendSetupError(reply: FastifyReply, error: unknown) {
  const publicError =
    error instanceof SetupServiceError || error instanceof AuthServiceError
      ? error
      : new SetupServiceError('SETUP_FAILED', 500, 'La configuration locale a echoue.');

  return reply.code(publicError.statusCode).send({
    success: false,
    error: {
      code: publicError.code,
      message: publicError.publicMessage,
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

interface ValidationIssue {
  path: PropertyKey[];
  message: string;
}
