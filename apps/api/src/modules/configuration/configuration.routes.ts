import type { FastifyInstance } from 'fastify';
import type { AuthService } from '../auth/index.js';
import type { AcademicYearsService } from './academic-years.service.js';
import { ConfigurationController } from './configuration.controller.js';
import type { ConfigurationService } from './configuration.service.js';

export interface RegisterConfigurationRoutesOptions {
  authService: AuthService;
  configurationService: ConfigurationService;
  academicYearsService: AcademicYearsService;
}

/** Registers the Phase 3 configuration foundation routes (roadmap §9.1/§9.3). */
export function registerConfigurationRoutes(
  server: FastifyInstance,
  options: RegisterConfigurationRoutesOptions
) {
  const controller = new ConfigurationController(
    options.authService,
    options.configurationService,
    options.academicYearsService
  );

  server.get('/configuration/readiness', controller.getReadiness);
  server.get('/configuration/academic-years', controller.listAcademicYears);
  server.post('/configuration/academic-years', controller.createAcademicYear);
  server.put('/configuration/academic-years/:yearId/status', controller.changeAcademicYearStatus);
}
