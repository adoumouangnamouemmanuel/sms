import type { FastifyInstance } from 'fastify';
import type { AuthService } from '../auth/index.js';
import { SetupController } from './setup.controller.js';
import type { SetupService } from './setup.service.js';

export interface RegisterSetupRoutesOptions {
  authService: AuthService;
  setupService: SetupService;
}

/** Registers the Phase 2 school setup route surface. */
export function registerSetupRoutes(server: FastifyInstance, options: RegisterSetupRoutesOptions) {
  const controller = new SetupController(options.authService, options.setupService);

  server.get('/setup/state', controller.state);
  server.put('/setup/profile', controller.saveProfile);
  server.put('/setup/calendar', controller.saveCalendar);
  server.put('/setup/class-levels', controller.saveClassLevels);
  server.put('/setup/step', controller.advanceStep);
  server.post('/setup/complete', controller.complete);
}
