import type { FastifyReply, FastifyRequest } from 'fastify';
import { confirmImportRequestSchema, IMPORT_KINDS } from '@edutrack/shared';
import { AuthServiceError, parseAuthorizationHeader, type AuthService } from '../auth/index.js';
import { readHeader } from '../auth/auth.cookies.js';
import type { RequestAuditContext } from '../auth/auth.types.js';
import { ImportsServiceError, invalidImportFile } from './imports.errors.js';
import type { ImportsService } from './imports.service.js';

const TEMPLATE_CONTENT_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/** Handles imports HTTP validation, auth, multipart upload and response envelopes. */
export class ImportsController {
  constructor(
    private readonly authService: AuthService,
    private readonly importsService: ImportsService
  ) {}

  readonly previewImport = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const actor = await this.authenticateRequest(request);
      const kind = readKindParam(request);

      const file = await request.file();
      const filename = file?.filename ?? 'import.xlsx';
      const buffer = await readMultipartBuffer(file?.file);

      if (file?.file.truncated) {
        throw invalidImportFile('Le fichier depasse la taille maximale autorisee (10 Mo).');
      }

      return await reply.send({
        success: true,
        data: this.importsService.preview(actor, kind, filename, buffer),
        message: 'Fichier analyse, apercu pret.',
      });
    } catch (error) {
      return sendImportsError(reply, error);
    }
  };

  readonly confirmImport = async (request: FastifyRequest, reply: FastifyReply) => {
    const parsedBody = confirmImportRequestSchema.safeParse(request.body);

    if (!parsedBody.success) {
      return reply.code(400).send({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Les donnees envoyees sont invalides.',
        },
      });
    }

    try {
      const actor = await this.authenticateRequest(request);

      return await reply.send({
        success: true,
        data: this.importsService.confirm(actor, parsedBody.data, {
          ...getRequestAuditContext(request),
        }),
        message: 'Import confirme.',
      });
    } catch (error) {
      return sendImportsError(reply, error);
    }
  };

  readonly downloadTemplate = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      // The template is generic, but access is still gated to authenticated school masters.
      await this.authenticateRequest(request);
      const kind = readKindParam(request);

      const templateBuffer = this.importsService.template(kind);

      reply.header('Content-Type', TEMPLATE_CONTENT_TYPE);
      reply.header(
        'Content-Disposition',
        `attachment; filename="modele-${kind.toLocaleLowerCase('fr')}.xlsx"`
      );

      return await reply.send(templateBuffer);
    } catch (error) {
      return sendImportsError(reply, error);
    }
  };

  readonly downloadErrors = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const actor = await this.authenticateRequest(request);
      const importId = readParam(request, 'importId');

      const csv = this.importsService.errorsCsv(actor, importId);
      const safeImportId = importId.replace(/[^A-Za-z0-9._-]/g, '');

      reply.header('Content-Type', 'text/csv; charset=utf-8');
      reply.header(
        'Content-Disposition',
        `attachment; filename="lignes-en-erreur-${safeImportId}.csv"`
      );

      return await reply.send(csv);
    } catch (error) {
      return sendImportsError(reply, error);
    }
  };

  private async authenticateRequest(request: FastifyRequest) {
    return this.authService.verifyAccessToken(
      parseAuthorizationHeader(readHeader(request.headers.authorization))
    );
  }
}

async function readMultipartBuffer(stream: NodeJS.ReadableStream | undefined) {
  if (!stream) {
    throw invalidImportFile('Fichier manquant dans la requete.');
  }

  const chunks: Buffer[] = [];

  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  return Buffer.concat(chunks);
}

function readKindParam(request: FastifyRequest) {
  const rawKind = readParam(request, 'kind').toLocaleUpperCase('fr');
  const kind = IMPORT_KINDS.find((candidate) => candidate === rawKind);

  if (!kind || !IMPORT_KINDS.includes(kind)) {
    throw invalidImportFile("Le type d'import est inconnu.");
  }

  return kind;
}

function readParam(request: FastifyRequest, name: string) {
  const params = request.params as Record<string, string | undefined>;
  const value = params[name];

  if (!value) {
    throw invalidImportFile('Parametre manquant.');
  }

  return value;
}

function getRequestAuditContext(request: FastifyRequest): RequestAuditContext {
  return {
    correlationId: request.id,
    userAgent: readHeader(request.headers['user-agent']),
  };
}

function sendImportsError(reply: FastifyReply, error: unknown) {
  const publicError =
    error instanceof ImportsServiceError || error instanceof AuthServiceError
      ? error
      : new ImportsServiceError('IMPORTS_FAILED', 500, "L'import a echoue.");

  return reply.code(publicError.statusCode).send({
    success: false,
    error: {
      code: publicError.code,
      message: publicError.publicMessage,
    },
  });
}
