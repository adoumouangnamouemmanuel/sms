import type { FastifyInstance } from 'fastify';
import type { AuthService } from '../auth/index.js';
import { AuditController } from './audit.controller.js';
import type { AuditService } from './audit.service.js';

export interface RegisterAuditRoutesOptions {
  authService: AuthService;
  auditService: AuditService;
}

/** Registers the read-only audit routes backing the dashboard timeline. */
export function registerAuditRoutes(server: FastifyInstance, options: RegisterAuditRoutesOptions) {
  const controller = new AuditController(options.authService, options.auditService);

  server.get('/audit/recent', controller.listRecent);
}
