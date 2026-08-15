import type { FastifyReply, FastifyRequest } from 'fastify';
import {
  archiveClassroomRequestSchema,
  assignClassSubjectRequestSchema,
  classSubjectListQuerySchema,
  classroomListQuerySchema,
  createClassroomRequestSchema,
  createSubjectRequestSchema,
  curriculumCopyConfirmRequestSchema,
  curriculumCopyPreviewRequestSchema,
  enrolOptionalSubjectsRequestSchema,
  enrolStudentsRequestSchema,
  subjectListQuerySchema,
  transferStudentRequestSchema,
  updateClassSubjectRequestSchema,
  updateClassroomRequestSchema,
  updateSubjectRequestSchema,
} from '@edutrack/shared';
import { AuthServiceError, parseAuthorizationHeader, type AuthService } from '../auth/index.js';
import { readHeader } from '../auth/auth.cookies.js';
import type { RequestAuditContext } from '../auth/auth.types.js';
import { ClassesServiceError } from './classes.errors.js';
import type { ClassEnrollmentsService } from './class-enrollments.service.js';
import type { ClassSubjectsService } from './class-subjects.service.js';
import type { ClassroomsService } from './classrooms.service.js';
import type { CurriculumService } from './curriculum.service.js';
import type { SubjectsService } from './subjects.service.js';

/** Handles classes HTTP validation, auth, and response envelopes. */
export class ClassesController {
  constructor(
    private readonly authService: AuthService,
    private readonly subjectsService: SubjectsService,
    private readonly classroomsService: ClassroomsService,
    private readonly classSubjectsService: ClassSubjectsService,
    private readonly classEnrollmentsService: ClassEnrollmentsService,
    private readonly curriculumService: CurriculumService
  ) {}

  // ---- Subjects -----------------------------------------------------------

  readonly listSubjects = async (request: FastifyRequest, reply: FastifyReply) => {
    const parsedQuery = subjectListQuerySchema.safeParse(request.query);

    if (!parsedQuery.success) {
      return sendValidationError(reply, parsedQuery.error);
    }

    try {
      const actor = await this.authenticateRequest(request);

      return await reply.send({
        success: true,
        data: this.subjectsService.list(actor, parsedQuery.data),
        message: 'Liste des matieres chargee.',
      });
    } catch (error) {
      return sendClassesError(reply, error);
    }
  };

  readonly createSubject = async (request: FastifyRequest, reply: FastifyReply) => {
    const parsedBody = createSubjectRequestSchema.safeParse(request.body);

    if (!parsedBody.success) {
      return sendValidationError(reply, parsedBody.error);
    }

    try {
      const actor = await this.authenticateRequest(request);

      return await reply.send({
        success: true,
        data: this.subjectsService.create(actor, parsedBody.data, getRequestAuditContext(request)),
        message: 'Matiere enregistree.',
      });
    } catch (error) {
      return sendClassesError(reply, error);
    }
  };

  readonly updateSubject = async (request: FastifyRequest, reply: FastifyReply) => {
    const parsedBody = updateSubjectRequestSchema.safeParse(request.body);

    if (!parsedBody.success) {
      return sendValidationError(reply, parsedBody.error);
    }

    try {
      const actor = await this.authenticateRequest(request);

      return await reply.send({
        success: true,
        data: this.subjectsService.update(
          actor,
          readParam(request, 'subjectId'),
          parsedBody.data,
          getRequestAuditContext(request)
        ),
        message: 'Matiere mise a jour.',
      });
    } catch (error) {
      return sendClassesError(reply, error);
    }
  };

  readonly archiveSubject = async (request: FastifyRequest, reply: FastifyReply) => {
    const parsedBody = archiveClassroomRequestSchema.safeParse(request.body);

    if (!parsedBody.success) {
      return sendValidationError(reply, parsedBody.error);
    }

    try {
      const actor = await this.authenticateRequest(request);

      return await reply.send({
        success: true,
        data: this.subjectsService.archive(
          actor,
          readParam(request, 'subjectId'),
          parsedBody.data,
          getRequestAuditContext(request)
        ),
        message: 'Matiere archivee.',
      });
    } catch (error) {
      return sendClassesError(reply, error);
    }
  };

  readonly reactivateSubject = async (request: FastifyRequest, reply: FastifyReply) => {
    const parsedBody = archiveClassroomRequestSchema.safeParse(request.body);

    if (!parsedBody.success) {
      return sendValidationError(reply, parsedBody.error);
    }

    try {
      const actor = await this.authenticateRequest(request);

      return await reply.send({
        success: true,
        data: this.subjectsService.reactivate(
          actor,
          readParam(request, 'subjectId'),
          parsedBody.data,
          getRequestAuditContext(request)
        ),
        message: 'Matiere reactivee.',
      });
    } catch (error) {
      return sendClassesError(reply, error);
    }
  };

  // ---- Classrooms ---------------------------------------------------------

  readonly listClassrooms = async (request: FastifyRequest, reply: FastifyReply) => {
    const parsedQuery = classroomListQuerySchema.safeParse(request.query);

    if (!parsedQuery.success) {
      return sendValidationError(reply, parsedQuery.error);
    }

    try {
      const actor = await this.authenticateRequest(request);

      return await reply.send({
        success: true,
        data: this.classroomsService.list(actor, parsedQuery.data),
        message: 'Liste des classes chargee.',
      });
    } catch (error) {
      return sendClassesError(reply, error);
    }
  };

  readonly createClassroom = async (request: FastifyRequest, reply: FastifyReply) => {
    const parsedBody = createClassroomRequestSchema.safeParse(request.body);

    if (!parsedBody.success) {
      return sendValidationError(reply, parsedBody.error);
    }

    try {
      const actor = await this.authenticateRequest(request);

      return await reply.send({
        success: true,
        data: this.classroomsService.create(
          actor,
          parsedBody.data,
          getRequestAuditContext(request)
        ),
        message: 'Classe creee.',
      });
    } catch (error) {
      return sendClassesError(reply, error);
    }
  };

  readonly updateClassroom = async (request: FastifyRequest, reply: FastifyReply) => {
    const parsedBody = updateClassroomRequestSchema.safeParse(request.body);

    if (!parsedBody.success) {
      return sendValidationError(reply, parsedBody.error);
    }

    try {
      const actor = await this.authenticateRequest(request);

      return await reply.send({
        success: true,
        data: this.classroomsService.update(
          actor,
          readParam(request, 'classroomId'),
          parsedBody.data,
          getRequestAuditContext(request)
        ),
        message: 'Classe mise a jour.',
      });
    } catch (error) {
      return sendClassesError(reply, error);
    }
  };

  readonly archiveClassroom = async (request: FastifyRequest, reply: FastifyReply) => {
    const parsedBody = archiveClassroomRequestSchema.safeParse(request.body);

    if (!parsedBody.success) {
      return sendValidationError(reply, parsedBody.error);
    }

    try {
      const actor = await this.authenticateRequest(request);

      return await reply.send({
        success: true,
        data: this.classroomsService.archive(
          actor,
          readParam(request, 'classroomId'),
          parsedBody.data,
          getRequestAuditContext(request)
        ),
        message: 'Classe archivee.',
      });
    } catch (error) {
      return sendClassesError(reply, error);
    }
  };

  readonly reactivateClassroom = async (request: FastifyRequest, reply: FastifyReply) => {
    const parsedBody = archiveClassroomRequestSchema.safeParse(request.body);

    if (!parsedBody.success) {
      return sendValidationError(reply, parsedBody.error);
    }

    try {
      const actor = await this.authenticateRequest(request);

      return await reply.send({
        success: true,
        data: this.classroomsService.reactivate(
          actor,
          readParam(request, 'classroomId'),
          parsedBody.data,
          getRequestAuditContext(request)
        ),
        message: 'Classe reactivee.',
      });
    } catch (error) {
      return sendClassesError(reply, error);
    }
  };

  readonly getClassroomRoster = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const actor = await this.authenticateRequest(request);

      return await reply.send({
        success: true,
        data: this.classEnrollmentsService.getRoster(actor, readParam(request, 'classroomId')),
        message: 'Effectif de la classe charge.',
      });
    } catch (error) {
      return sendClassesError(reply, error);
    }
  };

  readonly exportClassRegister = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const actor = await this.authenticateRequest(request);

      return await reply.send({
        success: true,
        data: this.classEnrollmentsService.exportRegister(actor, readParam(request, 'classroomId')),
        message: 'Registre de classe genere.',
      });
    } catch (error) {
      return sendClassesError(reply, error);
    }
  };

  // ---- Class-subjects -----------------------------------------------------

  readonly listClassSubjects = async (request: FastifyRequest, reply: FastifyReply) => {
    const parsedQuery = classSubjectListQuerySchema.safeParse(request.query);

    if (!parsedQuery.success) {
      return sendValidationError(reply, parsedQuery.error);
    }

    try {
      const actor = await this.authenticateRequest(request);

      return await reply.send({
        success: true,
        data: this.classSubjectsService.list(actor, parsedQuery.data),
        message: 'Curriculum de la classe charge.',
      });
    } catch (error) {
      return sendClassesError(reply, error);
    }
  };

  readonly assignClassSubject = async (request: FastifyRequest, reply: FastifyReply) => {
    const parsedBody = assignClassSubjectRequestSchema.safeParse(request.body);

    if (!parsedBody.success) {
      return sendValidationError(reply, parsedBody.error);
    }

    try {
      const actor = await this.authenticateRequest(request);

      return await reply.send({
        success: true,
        data: this.classSubjectsService.assign(
          actor,
          parsedBody.data,
          getRequestAuditContext(request)
        ),
        message: 'Matiere affectee a la classe.',
      });
    } catch (error) {
      return sendClassesError(reply, error);
    }
  };

  readonly updateClassSubject = async (request: FastifyRequest, reply: FastifyReply) => {
    const parsedBody = updateClassSubjectRequestSchema.safeParse(request.body);

    if (!parsedBody.success) {
      return sendValidationError(reply, parsedBody.error);
    }

    try {
      const actor = await this.authenticateRequest(request);

      return await reply.send({
        success: true,
        data: this.classSubjectsService.update(
          actor,
          readParam(request, 'classSubjectId'),
          parsedBody.data,
          getRequestAuditContext(request)
        ),
        message: 'Affectation matiere-classe mise a jour.',
      });
    } catch (error) {
      return sendClassesError(reply, error);
    }
  };

  readonly removeClassSubject = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const actor = await this.authenticateRequest(request);

      return await reply.send({
        success: true,
        data: this.classSubjectsService.remove(
          actor,
          readParam(request, 'classSubjectId'),
          getRequestAuditContext(request)
        ),
        message: 'Matiere retiree de la classe.',
      });
    } catch (error) {
      return sendClassesError(reply, error);
    }
  };

  // ---- Enrolment ----------------------------------------------------------

  readonly enrolStudents = async (request: FastifyRequest, reply: FastifyReply) => {
    const parsedBody = enrolStudentsRequestSchema.safeParse(request.body);

    if (!parsedBody.success) {
      return sendValidationError(reply, parsedBody.error);
    }

    try {
      const actor = await this.authenticateRequest(request);

      return await reply.send({
        success: true,
        data: this.classEnrollmentsService.enrolStudents(
          actor,
          parsedBody.data,
          getRequestAuditContext(request)
        ),
        message: 'Eleves inscrits dans la classe.',
      });
    } catch (error) {
      return sendClassesError(reply, error);
    }
  };

  readonly transferStudent = async (request: FastifyRequest, reply: FastifyReply) => {
    const parsedBody = transferStudentRequestSchema.safeParse(request.body);

    if (!parsedBody.success) {
      return sendValidationError(reply, parsedBody.error);
    }

    try {
      const actor = await this.authenticateRequest(request);

      return await reply.send({
        success: true,
        data: this.classEnrollmentsService.transfer(
          actor,
          readParam(request, 'studentId'),
          parsedBody.data,
          getRequestAuditContext(request)
        ),
        message: 'Eleve transfere.',
      });
    } catch (error) {
      return sendClassesError(reply, error);
    }
  };

  readonly listStudentsMissingClass = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const actor = await this.authenticateRequest(request);

      return await reply.send({
        success: true,
        data: this.classEnrollmentsService.listStudentsMissingClass(actor),
        message: 'Eleves sans classe chargee.',
      });
    } catch (error) {
      return sendClassesError(reply, error);
    }
  };

  readonly enrolOptionalSubjects = async (request: FastifyRequest, reply: FastifyReply) => {
    const parsedBody = enrolOptionalSubjectsRequestSchema.safeParse(request.body);

    if (!parsedBody.success) {
      return sendValidationError(reply, parsedBody.error);
    }

    try {
      const actor = await this.authenticateRequest(request);

      return await reply.send({
        success: true,
        data: this.classEnrollmentsService.enrolOptionalSubjects(
          actor,
          parsedBody.data,
          getRequestAuditContext(request)
        ),
        message: 'Options inscrites pour l eleve.',
      });
    } catch (error) {
      return sendClassesError(reply, error);
    }
  };

  // ---- Curriculum copy ----------------------------------------------------

  readonly previewCurriculumCopy = async (request: FastifyRequest, reply: FastifyReply) => {
    const parsedBody = curriculumCopyPreviewRequestSchema.safeParse(request.body);

    if (!parsedBody.success) {
      return sendValidationError(reply, parsedBody.error);
    }

    try {
      const actor = await this.authenticateRequest(request);

      return await reply.send({
        success: true,
        data: this.curriculumService.copyPreview(actor, parsedBody.data),
        message: 'Apercu de la copie du curriculum charge.',
      });
    } catch (error) {
      return sendClassesError(reply, error);
    }
  };

  readonly confirmCurriculumCopy = async (request: FastifyRequest, reply: FastifyReply) => {
    const parsedBody = curriculumCopyConfirmRequestSchema.safeParse(request.body);

    if (!parsedBody.success) {
      return sendValidationError(reply, parsedBody.error);
    }

    try {
      const actor = await this.authenticateRequest(request);

      return await reply.send({
        success: true,
        data: this.curriculumService.copyConfirm(
          actor,
          parsedBody.data,
          getRequestAuditContext(request)
        ),
        message: 'Curriculum copie.',
      });
    } catch (error) {
      return sendClassesError(reply, error);
    }
  };

  private async authenticateRequest(request: FastifyRequest) {
    return this.authService.verifyAccessToken(
      parseAuthorizationHeader(readHeader(request.headers.authorization))
    );
  }
}

function sendClassesError(reply: FastifyReply, error: unknown) {
  const publicError =
    error instanceof ClassesServiceError || error instanceof AuthServiceError
      ? error
      : new ClassesServiceError('CLASSES_FAILED', 500, 'La gestion des classes a echoue.');

  return reply.code(publicError.statusCode).send({
    success: false,
    error: {
      code: publicError.code,
      message: publicError.publicMessage,
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
      message: 'Les donnees envoyees sont invalides.',
      fields,
    },
  });
}

function readParam(request: FastifyRequest, name: string) {
  const params = request.params as Record<string, string | undefined>;
  const value = params[name];

  if (!value) {
    throw new ClassesServiceError('CLASSES_FAILED', 400, 'Parametre manquant.');
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
