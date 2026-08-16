import type { FastifyReply, FastifyRequest } from 'fastify';
import { AuthServiceError, parseAuthorizationHeader, type AuthService } from '../auth/index.js';
import { readHeader } from '../auth/auth.cookies.js';
import { ConfigurationServiceError } from './configuration.errors.js';
import type { ConfigurationService } from './configuration.service.js';

/** Handles configuration HTTP auth and response envelopes. */
export class ConfigurationController {
  constructor(
    private readonly authService: AuthService,
    private readonly configurationService: ConfigurationService
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
