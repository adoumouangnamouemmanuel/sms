import type { FastifyInstance } from 'fastify';
import { AuthController } from './auth.controller.js';
import type { AuthService } from './auth.service.js';

export interface RegisterAuthRoutesOptions {
  authService: AuthService;
}

/** Registers the Phase 2 local-auth route surface. */
export function registerAuthRoutes(server: FastifyInstance, options: RegisterAuthRoutesOptions) {
  const controller = new AuthController(options.authService);

  server.post('/auth/login', controller.login);
  server.post('/auth/refresh', controller.refresh);
  server.post('/auth/logout', controller.logout);
  server.get('/auth/me', controller.me);
  server.post('/auth/password/change', controller.changePassword);
  server.post('/auth/users/:userId/password/reset', controller.resetPassword);
}
