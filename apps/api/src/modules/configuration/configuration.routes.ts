import type { FastifyInstance } from 'fastify';
import type { AuthService } from '../auth/index.js';
import type { AcademicYearsService } from './academic-years.service.js';
import type { AppreciationService } from './appreciation.service.js';
import { ConfigurationController } from './configuration.controller.js';
import type { ConfigurationService } from './configuration.service.js';
import type { GradingPolicyService } from './grading-policy.service.js';

export interface RegisterConfigurationRoutesOptions {
  authService: AuthService;
  configurationService: ConfigurationService;
  academicYearsService: AcademicYearsService;
  gradingPolicyService: GradingPolicyService;
  appreciationService: AppreciationService;
}

/**
 * Registers the Phase 3 configuration routes (roadmap §9.1/§9.3/§9.7-§9.10):
 * readiness, academic years, versioned grading policies with scope
 * assignment/resolution, and versioned appreciation scales.
 */
export function registerConfigurationRoutes(
  server: FastifyInstance,
  options: RegisterConfigurationRoutesOptions
) {
  const controller = new ConfigurationController(
    options.authService,
    options.configurationService,
    options.academicYearsService,
    options.gradingPolicyService,
    options.appreciationService
  );

  server.get('/configuration/readiness', controller.getReadiness);
  server.get('/configuration/academic-years', controller.listAcademicYears);
  server.post('/configuration/academic-years', controller.createAcademicYear);
  server.put('/configuration/academic-years/:yearId/status', controller.changeAcademicYearStatus);

  // Grading policies (roadmap §9.7-§9.9)
  server.get('/grading-policies', controller.listGradingPolicies);
  server.get('/grading-policies/resolved', controller.resolveGradingPolicy);
  server.get('/grading-policies/:policyId', controller.getGradingPolicy);
  server.post('/grading-policies', controller.createGradingPolicy);
  server.put('/grading-policies/:policyId', controller.updateGradingPolicy);
  server.post('/grading-policies/:policyId/publish', controller.publishGradingPolicy);
  server.post('/grading-policies/:policyId/duplicate', controller.duplicateGradingPolicy);
  server.put('/grading-policies/:policyId/scopes', controller.assignPolicyScopes);

  // Appreciation scales (roadmap §9.10)
  server.get('/appreciation-scales', controller.listAppreciationScales);
  server.post('/appreciation-scales', controller.createAppreciationScale);
  server.put('/appreciation-scales/:scaleId', controller.updateAppreciationScale);
  server.post('/appreciation-scales/:scaleId/publish', controller.publishAppreciationScale);
  server.post('/appreciation-scales/:scaleId/duplicate', controller.duplicateAppreciationScale);
}
