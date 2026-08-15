import multipart from '@fastify/multipart';
import type { FastifyInstance } from 'fastify';
import type { AuthService } from '../auth/index.js';
import { ImportsController } from './imports.controller.js';
import type { ImportsService } from './imports.service.js';

const MAX_IMPORT_FILE_BYTES = 10 * 1024 * 1024;

export interface RegisterImportsRoutesOptions {
  authService: AuthService;
  importsService: ImportsService;
}

/**
 * Registers the imports routes inside an encapsulated scope that also registers
 * the multipart content-type parser, so only these routes accept uploads.
 */
export function registerImportsRoutes(
  server: FastifyInstance,
  options: RegisterImportsRoutesOptions
) {
  const controller = new ImportsController(options.authService, options.importsService);

  server.register(async (instance) => {
    await instance.register(multipart, {
      limits: {
        fileSize: MAX_IMPORT_FILE_BYTES,
        files: 1,
        fields: 0,
      },
    });

    instance.post('/imports/preview/:kind', controller.previewImport);
    instance.post('/imports/confirm', controller.confirmImport);
    instance.get('/imports/templates/:kind', controller.downloadTemplate);
    instance.get('/imports/errors/:importId', controller.downloadErrors);
  });
}
