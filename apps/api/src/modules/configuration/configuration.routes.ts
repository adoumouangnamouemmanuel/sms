import type { FastifyInstance } from 'fastify';
import type { AuthService } from '../auth/index.js';
import { ConfigurationController } from './configuration.controller.js';
import type { ConfigurationService } from './configuration.service.js';

export interface RegisterConfigurationRoutesOptions {
  authService: AuthService;
  configurationService: ConfigurationService;
}

/** Registers the Phase 3.1 configuration foundation routes. */
export function registerConfigurationRoutes(
  server: FastifyInstance,
  options: RegisterConfigurationRoutesOptions
) {
  const controller = new ConfigurationController(options.authService, options.configurationService);

  server.get('/configuration/readiness', controller.getReadiness);
}
