import {
  appreciationScaleInputSchema,
  assignPolicyScopesRequestSchema,
  createAcademicYearRequestSchema,
  academicYearStatusRequestSchema,
  gradingPolicyConfigSchema,
  resolveGradingPolicyQuerySchema,
} from '@edutrack/shared';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { AuthServiceError, parseAuthorizationHeader, type AuthService } from '../auth/index.js';
import { readHeader } from '../auth/auth.cookies.js';
import type { RequestAuditContext } from '../auth/auth.types.js';
import type { AcademicYearsService } from './academic-years.service.js';
import type { AppreciationService } from './appreciation.service.js';
import { ConfigurationServiceError } from './configuration.errors.js';
import type { ConfigurationService } from './configuration.service.js';
import type { GradingPolicyService } from './grading-policy.service.js';

/** Handles configuration HTTP auth and response envelopes. */
export class ConfigurationController {
  constructor(
    private readonly authService: AuthService,
    private readonly configurationService: ConfigurationService,
    private readonly academicYearsService: AcademicYearsService,
    private readonly gradingPolicyService: GradingPolicyService,
    private readonly appreciationService: AppreciationService
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

  // -------------------------------------------------------------------------
  // Grading policies (roadmap §9.7-§9.9)
  // -------------------------------------------------------------------------

  readonly listGradingPolicies = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const actor = await this.authenticateRequest(request);
      return await reply.send({
        success: true,
        data: this.gradingPolicyService.list(actor),
        message: 'Politiques de notation chargées.',
      });
    } catch (error) {
      return sendConfigurationError(reply, error);
    }
  };

  readonly getGradingPolicy = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const actor = await this.authenticateRequest(request);
      return await reply.send({
        success: true,
        data: this.gradingPolicyService.get(actor, readParam(request, 'policyId')),
        message: 'Politique de notation chargée.',
      });
    } catch (error) {
      return sendConfigurationError(reply, error);
    }
  };

  readonly createGradingPolicy = async (request: FastifyRequest, reply: FastifyReply) => {
    const parsedBody = gradingPolicyConfigSchema.safeParse(request.body);
    if (!parsedBody.success) {
      return sendValidationError(reply, parsedBody.error);
    }

    try {
      const actor = await this.authenticateRequest(request);
      return await reply.send({
        success: true,
        data: this.gradingPolicyService.createDraft(
          actor,
          parsedBody.data,
          getRequestAuditContext(request)
        ),
        message: 'Politique de notation créée.',
      });
    } catch (error) {
      return sendConfigurationError(reply, error);
    }
  };

  readonly updateGradingPolicy = async (request: FastifyRequest, reply: FastifyReply) => {
    const parsedBody = gradingPolicyConfigSchema.safeParse(request.body);
    if (!parsedBody.success) {
      return sendValidationError(reply, parsedBody.error);
    }

    try {
      const actor = await this.authenticateRequest(request);
      return await reply.send({
        success: true,
        data: this.gradingPolicyService.updateDraft(
          actor,
          readParam(request, 'policyId'),
          parsedBody.data,
          getRequestAuditContext(request)
        ),
        message: 'Politique de notation mise à jour.',
      });
    } catch (error) {
      return sendConfigurationError(reply, error);
    }
  };

  readonly publishGradingPolicy = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const actor = await this.authenticateRequest(request);
      return await reply.send({
        success: true,
        data: this.gradingPolicyService.publish(
          actor,
          readParam(request, 'policyId'),
          getRequestAuditContext(request)
        ),
        message: 'Politique de notation publiée.',
      });
    } catch (error) {
      return sendConfigurationError(reply, error);
    }
  };

  readonly duplicateGradingPolicy = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const actor = await this.authenticateRequest(request);
      return await reply.send({
        success: true,
        data: this.gradingPolicyService.duplicate(
          actor,
          readParam(request, 'policyId'),
          getRequestAuditContext(request)
        ),
        message: 'Nouvelle version de la politique créée.',
      });
    } catch (error) {
      return sendConfigurationError(reply, error);
    }
  };

  readonly assignPolicyScopes = async (request: FastifyRequest, reply: FastifyReply) => {
    const parsedBody = assignPolicyScopesRequestSchema.safeParse(request.body);
    if (!parsedBody.success) {
      return sendValidationError(reply, parsedBody.error);
    }

    try {
      const actor = await this.authenticateRequest(request);
      return await reply.send({
        success: true,
        data: this.gradingPolicyService.replaceScopes(
          actor,
          readParam(request, 'policyId'),
          parsedBody.data,
          getRequestAuditContext(request)
        ),
        message: 'Périmètres de la politique mis à jour.',
      });
    } catch (error) {
      return sendConfigurationError(reply, error);
    }
  };

  readonly resolveGradingPolicy = async (request: FastifyRequest, reply: FastifyReply) => {
    const parsedQuery = resolveGradingPolicyQuerySchema.safeParse(request.query);

    if (!parsedQuery.success) {
      return sendValidationError(reply, parsedQuery.error);
    }

    const { levelId } = parsedQuery.data;
    const subjectId = parsedQuery.data.subjectId ?? null;

    try {
      const actor = await this.authenticateRequest(request);
      return await reply.send({
        success: true,
        data: this.gradingPolicyService.resolve(actor, levelId, subjectId),
        message: 'Politique résolue.',
      });
    } catch (error) {
      return sendConfigurationError(reply, error);
    }
  };

  // -------------------------------------------------------------------------
  // Appreciation (roadmap §9.10)
  // -------------------------------------------------------------------------

  readonly listAppreciationScales = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const actor = await this.authenticateRequest(request);
      return await reply.send({
        success: true,
        data: this.appreciationService.list(actor),
        message: 'Échelles d\u2019appréciation chargées.',
      });
    } catch (error) {
      return sendConfigurationError(reply, error);
    }
  };

  readonly createAppreciationScale = async (request: FastifyRequest, reply: FastifyReply) => {
    const parsedBody = appreciationScaleInputSchema.safeParse(request.body);
    if (!parsedBody.success) {
      return sendValidationError(reply, parsedBody.error);
    }

    try {
      const actor = await this.authenticateRequest(request);
      return await reply.send({
        success: true,
        data: this.appreciationService.createDraft(
          actor,
          parsedBody.data,
          getRequestAuditContext(request)
        ),
        message: 'Échelle d\u2019appréciation créée.',
      });
    } catch (error) {
      return sendConfigurationError(reply, error);
    }
  };

  readonly updateAppreciationScale = async (request: FastifyRequest, reply: FastifyReply) => {
    const parsedBody = appreciationScaleInputSchema.safeParse(request.body);
    if (!parsedBody.success) {
      return sendValidationError(reply, parsedBody.error);
    }

    try {
      const actor = await this.authenticateRequest(request);
      return await reply.send({
        success: true,
        data: this.appreciationService.updateDraft(
          actor,
          readParam(request, 'scaleId'),
          parsedBody.data,
          getRequestAuditContext(request)
        ),
        message: 'Échelle d\u2019appréciation mise à jour.',
      });
    } catch (error) {
      return sendConfigurationError(reply, error);
    }
  };

  readonly publishAppreciationScale = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const actor = await this.authenticateRequest(request);
      return await reply.send({
        success: true,
        data: this.appreciationService.publish(
          actor,
          readParam(request, 'scaleId'),
          getRequestAuditContext(request)
        ),
        message: 'Échelle d\u2019appréciation publiée.',
      });
    } catch (error) {
      return sendConfigurationError(reply, error);
    }
  };

  readonly duplicateAppreciationScale = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const actor = await this.authenticateRequest(request);
      return await reply.send({
        success: true,
        data: this.appreciationService.duplicate(
          actor,
          readParam(request, 'scaleId'),
          getRequestAuditContext(request)
        ),
        message: 'Nouvelle version de l\u2019échelle créée.',
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
    throw new ConfigurationServiceError('VALIDATION_ERROR', 400, 'Paramètre manquant.');
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
