import { academicYearStatusRequestSchema, createAcademicYearRequestSchema } from '@edutrack/shared';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { AuthServiceError, parseAuthorizationHeader, type AuthService } from '../auth/index.js';
import { readHeader } from '../auth/auth.cookies.js';
import type { RequestAuditContext } from '../auth/auth.types.js';
import { ConfigurationServiceError } from './configuration.errors.js';
import type { AcademicYearsService } from './academic-years.service.js';
import type { ConfigurationService } from './configuration.service.js';

/** Handles configuration HTTP auth and response envelopes. */
export class ConfigurationController {
  constructor(
    private readonly authService: AuthService,
    private readonly configurationService: ConfigurationService,
    private readonly academicYearsService: AcademicYearsService
  ) {}

  readonly getReadiness = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const actor = await this.authenticateRequest(request);

      return await reply.send({
        success: true,
        data: this.configurationService.getReadiness(actor),
        message: 'État de la configuration chargé.',
      });
    } catch (error) {
      return sendConfigurationError(reply, error);
    }
  };

  readonly listAcademicYears = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const actor = await this.authenticateRequest(request);

      return await reply.send({
        success: true,
        data: this.academicYearsService.list(actor),
        message: 'Années scolaires chargées.',
      });
    } catch (error) {
      return sendConfigurationError(reply, error);
    }
  };

  readonly createAcademicYear = async (request: FastifyRequest, reply: FastifyReply) => {
    const parsedBody = createAcademicYearRequestSchema.safeParse(request.body);

    if (!parsedBody.success) {
      return sendValidationError(reply, parsedBody.error);
    }

    try {
      const actor = await this.authenticateRequest(request);

      return await reply.send({
        success: true,
        data: this.academicYearsService.createDraft(
          actor,
          parsedBody.data,
          getRequestAuditContext(request)
        ),
        message: 'Année scolaire créée.',
      });
    } catch (error) {
      return sendConfigurationError(reply, error);
    }
  };

  readonly changeAcademicYearStatus = async (request: FastifyRequest, reply: FastifyReply) => {
    const parsedBody = academicYearStatusRequestSchema.safeParse(request.body);

    if (!parsedBody.success) {
      return sendValidationError(reply, parsedBody.error);
    }

    try {
      const actor = await this.authenticateRequest(request);

      return await reply.send({
        success: true,
        data: this.academicYearsService.changeStatus(
          actor,
          readParam(request, 'yearId'),
          parsedBody.data,
          getRequestAuditContext(request)
        ),
        message: 'Statut de l\u2019année scolaire mis à jour.',
      });
    } catch (error) {
      return sendConfigurationError(reply, error);
    }
  };

  private async authenticateRequest(request: FastifyRequest) {
    return this.authService.verifyAccessToken(
      parseAuthorizationHeader(readHeader(request.headers.authorization))
    );
  }
}

function sendConfigurationError(reply: FastifyReply, error: unknown) {
  const publicError =
    error instanceof ConfigurationServiceError || error instanceof AuthServiceError
      ? error
      : new ConfigurationServiceError(
          'CONFIGURATION_FAILED',
          500,
          'La configuration est temporairement indisponible. Réessayez.'
        );

  const fields = publicError instanceof ConfigurationServiceError ? publicError.fields : undefined;

  return reply.code(publicError.statusCode).send({
    success: false,
    error: {
      code: publicError.code,
      message: publicError.publicMessage,
      ...(fields ? { fields } : {}),
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
      message: 'Les données envoyées sont invalides.',
      fields,
    },
  });
}

function readParam(request: FastifyRequest, name: string) {
  const params = request.params as Record<string, string | undefined>;
  const value = params[name];

  if (!value) {
    throw new ConfigurationServiceError('CONFIGURATION_FAILED', 400, 'Paramètre manquant.');
  }

  return value;
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
