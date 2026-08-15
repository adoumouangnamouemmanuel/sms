import type { FastifyReply, FastifyRequest } from 'fastify';
import {
  archiveGuardianRequestSchema,
  archiveStudentRequestSchema,
  archiveTeacherRequestSchema,
  createGuardianRequestSchema,
  createStudentRequestSchema,
  createTeacherLoginRequestSchema,
  createTeacherRequestSchema,
  deactivateTeacherLoginRequestSchema,
  guardianListQuerySchema,
  linkStudentGuardianRequestSchema,
  studentListQuerySchema,
  teacherListQuerySchema,
  updateGuardianRequestSchema,
  updateStudentGuardianLinkRequestSchema,
  updateStudentRequestSchema,
  updateTeacherRequestSchema,
} from '@edutrack/shared';
import { AuthServiceError, parseAuthorizationHeader, type AuthService } from '../auth/index.js';
import { readHeader } from '../auth/auth.cookies.js';
import type { RequestAuditContext } from '../auth/auth.types.js';
import type { GuardiansService } from './guardians.service.js';
import { PeopleServiceError } from './people.errors.js';
import type { StudentsService } from './students.service.js';
import type { TeachersService } from './teachers.service.js';

/** Handles people HTTP validation, auth, and response envelopes. */
export class PeopleController {
  constructor(
    private readonly authService: AuthService,
    private readonly studentsService: StudentsService,
    private readonly guardiansService: GuardiansService,
    private readonly teachersService: TeachersService
  ) {}

  readonly listStudents = async (request: FastifyRequest, reply: FastifyReply) => {
    const parsedQuery = studentListQuerySchema.safeParse(request.query);

    if (!parsedQuery.success) {
      return sendValidationError(reply, parsedQuery.error);
    }

    try {
      const actor = await this.authenticateRequest(request);

      return await reply.send({
        success: true,
        data: this.studentsService.list(actor, parsedQuery.data),
        message: 'Liste des eleves chargee.',
      });
    } catch (error) {
      return sendPeopleError(reply, error);
    }
  };

  readonly getStudentProfile = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const actor = await this.authenticateRequest(request);
      const studentId = readParam(request, 'studentId');

      return await reply.send({
        success: true,
        data: this.studentsService.getProfile(actor, studentId),
        message: 'Profil de l eleve charge.',
      });
    } catch (error) {
      return sendPeopleError(reply, error);
    }
  };

  readonly createStudent = async (request: FastifyRequest, reply: FastifyReply) => {
    const parsedBody = createStudentRequestSchema.safeParse(request.body);

    if (!parsedBody.success) {
      return sendValidationError(reply, parsedBody.error);
    }

    try {
      const actor = await this.authenticateRequest(request);

      return await reply.send({
        success: true,
        data: this.studentsService.create(actor, parsedBody.data, getRequestAuditContext(request)),
        message: 'Eleve enregistre.',
      });
    } catch (error) {
      return sendPeopleError(reply, error);
    }
  };

  readonly updateStudent = async (request: FastifyRequest, reply: FastifyReply) => {
    const parsedBody = updateStudentRequestSchema.safeParse(request.body);

    if (!parsedBody.success) {
      return sendValidationError(reply, parsedBody.error);
    }

    try {
      const actor = await this.authenticateRequest(request);

      return await reply.send({
        success: true,
        data: this.studentsService.update(
          actor,
          readParam(request, 'studentId'),
          parsedBody.data,
          getRequestAuditContext(request)
        ),
        message: 'Eleve mis a jour.',
      });
    } catch (error) {
      return sendPeopleError(reply, error);
    }
  };

  readonly archiveStudent = async (request: FastifyRequest, reply: FastifyReply) => {
    const parsedBody = archiveStudentRequestSchema.safeParse(request.body);

    if (!parsedBody.success) {
      return sendValidationError(reply, parsedBody.error);
    }

    try {
      const actor = await this.authenticateRequest(request);

      return await reply.send({
        success: true,
        data: this.studentsService.archive(
          actor,
          readParam(request, 'studentId'),
          parsedBody.data,
          getRequestAuditContext(request)
        ),
        message: 'Eleve archive.',
      });
    } catch (error) {
      return sendPeopleError(reply, error);
    }
  };

  readonly reactivateStudent = async (request: FastifyRequest, reply: FastifyReply) => {
    const parsedBody = archiveStudentRequestSchema.safeParse(request.body);

    if (!parsedBody.success) {
      return sendValidationError(reply, parsedBody.error);
    }

    try {
      const actor = await this.authenticateRequest(request);

      return await reply.send({
        success: true,
        data: this.studentsService.reactivate(
          actor,
          readParam(request, 'studentId'),
          parsedBody.data,
          getRequestAuditContext(request)
        ),
        message: 'Eleve reactive.',
      });
    } catch (error) {
      return sendPeopleError(reply, error);
    }
  };

  readonly linkGuardian = async (request: FastifyRequest, reply: FastifyReply) => {
    const parsedBody = linkStudentGuardianRequestSchema.safeParse(request.body);

    if (!parsedBody.success) {
      return sendValidationError(reply, parsedBody.error);
    }

    try {
      const actor = await this.authenticateRequest(request);

      return await reply.send({
        success: true,
        data: this.studentsService.linkGuardian(
          actor,
          readParam(request, 'studentId'),
          parsedBody.data,
          getRequestAuditContext(request)
        ),
        message: 'Responsable lie a l eleve.',
      });
    } catch (error) {
      return sendPeopleError(reply, error);
    }
  };

  readonly updateGuardianLink = async (request: FastifyRequest, reply: FastifyReply) => {
    const parsedBody = updateStudentGuardianLinkRequestSchema.safeParse(request.body);

    if (!parsedBody.success) {
      return sendValidationError(reply, parsedBody.error);
    }

    try {
      const actor = await this.authenticateRequest(request);

      return await reply.send({
        success: true,
        data: this.studentsService.updateGuardianLink(
          actor,
          readParam(request, 'linkId'),
          parsedBody.data,
          getRequestAuditContext(request)
        ),
        message: 'Lien responsable-eleve mis a jour.',
      });
    } catch (error) {
      return sendPeopleError(reply, error);
    }
  };

  readonly unlinkGuardian = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const actor = await this.authenticateRequest(request);

      return await reply.send({
        success: true,
        data: this.studentsService.unlinkGuardian(
          actor,
          readParam(request, 'linkId'),
          getRequestAuditContext(request)
        ),
        message: 'Lien responsable-eleve retire.',
      });
    } catch (error) {
      return sendPeopleError(reply, error);
    }
  };

  readonly listGuardians = async (request: FastifyRequest, reply: FastifyReply) => {
    const parsedQuery = guardianListQuerySchema.safeParse(request.query);

    if (!parsedQuery.success) {
      return sendValidationError(reply, parsedQuery.error);
    }

    try {
      const actor = await this.authenticateRequest(request);

      return await reply.send({
        success: true,
        data: this.guardiansService.list(actor, parsedQuery.data),
        message: 'Liste des responsables chargee.',
      });
    } catch (error) {
      return sendPeopleError(reply, error);
    }
  };

  readonly getGuardianProfile = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const actor = await this.authenticateRequest(request);
      const guardianId = readParam(request, 'guardianId');

      return await reply.send({
        success: true,
        data: this.guardiansService.getProfile(actor, guardianId),
        message: 'Profil du responsable charge.',
      });
    } catch (error) {
      return sendPeopleError(reply, error);
    }
  };

  readonly createGuardian = async (request: FastifyRequest, reply: FastifyReply) => {
    const parsedBody = createGuardianRequestSchema.safeParse(request.body);

    if (!parsedBody.success) {
      return sendValidationError(reply, parsedBody.error);
    }

    try {
      const actor = await this.authenticateRequest(request);

      return await reply.send({
        success: true,
        data: this.guardiansService.create(actor, parsedBody.data, getRequestAuditContext(request)),
        message: 'Responsable enregistre.',
      });
    } catch (error) {
      return sendPeopleError(reply, error);
    }
  };

  readonly updateGuardian = async (request: FastifyRequest, reply: FastifyReply) => {
    const parsedBody = updateGuardianRequestSchema.safeParse(request.body);

    if (!parsedBody.success) {
      return sendValidationError(reply, parsedBody.error);
    }

    try {
      const actor = await this.authenticateRequest(request);

      return await reply.send({
        success: true,
        data: this.guardiansService.update(
          actor,
          readParam(request, 'guardianId'),
          parsedBody.data,
          getRequestAuditContext(request)
        ),
        message: 'Responsable mis a jour.',
      });
    } catch (error) {
      return sendPeopleError(reply, error);
    }
  };

  readonly archiveGuardian = async (request: FastifyRequest, reply: FastifyReply) => {
    const parsedBody = archiveGuardianRequestSchema.safeParse(request.body);

    if (!parsedBody.success) {
      return sendValidationError(reply, parsedBody.error);
    }

    try {
      const actor = await this.authenticateRequest(request);

      return await reply.send({
        success: true,
        data: this.guardiansService.archive(
          actor,
          readParam(request, 'guardianId'),
          parsedBody.data,
          getRequestAuditContext(request)
        ),
        message: 'Responsable archive.',
      });
    } catch (error) {
      return sendPeopleError(reply, error);
    }
  };

  readonly reactivateGuardian = async (request: FastifyRequest, reply: FastifyReply) => {
    const parsedBody = archiveGuardianRequestSchema.safeParse(request.body);

    if (!parsedBody.success) {
      return sendValidationError(reply, parsedBody.error);
    }

    try {
      const actor = await this.authenticateRequest(request);

      return await reply.send({
        success: true,
        data: this.guardiansService.reactivate(
          actor,
          readParam(request, 'guardianId'),
          parsedBody.data,
          getRequestAuditContext(request)
        ),
        message: 'Responsable reactive.',
      });
    } catch (error) {
      return sendPeopleError(reply, error);
    }
  };

  readonly listTeachers = async (request: FastifyRequest, reply: FastifyReply) => {
    const parsedQuery = teacherListQuerySchema.safeParse(request.query);

    if (!parsedQuery.success) {
      return sendValidationError(reply, parsedQuery.error);
    }

    try {
      const actor = await this.authenticateRequest(request);

      return await reply.send({
        success: true,
        data: this.teachersService.list(actor, parsedQuery.data),
        message: 'Liste des professeurs chargee.',
      });
    } catch (error) {
      return sendPeopleError(reply, error);
    }
  };

  readonly getTeacherProfile = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const actor = await this.authenticateRequest(request);
      const teacherId = readParam(request, 'teacherId');

      return await reply.send({
        success: true,
        data: this.teachersService.getProfile(actor, teacherId),
        message: 'Profil du professeur charge.',
      });
    } catch (error) {
      return sendPeopleError(reply, error);
    }
  };

  readonly createTeacher = async (request: FastifyRequest, reply: FastifyReply) => {
    const parsedBody = createTeacherRequestSchema.safeParse(request.body);

    if (!parsedBody.success) {
      return sendValidationError(reply, parsedBody.error);
    }

    try {
      const actor = await this.authenticateRequest(request);

      return await reply.send({
        success: true,
        data: this.teachersService.create(actor, parsedBody.data, getRequestAuditContext(request)),
        message: 'Professeur enregistre.',
      });
    } catch (error) {
      return sendPeopleError(reply, error);
    }
  };

  readonly updateTeacher = async (request: FastifyRequest, reply: FastifyReply) => {
    const parsedBody = updateTeacherRequestSchema.safeParse(request.body);

    if (!parsedBody.success) {
      return sendValidationError(reply, parsedBody.error);
    }

    try {
      const actor = await this.authenticateRequest(request);

      return await reply.send({
        success: true,
        data: this.teachersService.update(
          actor,
          readParam(request, 'teacherId'),
          parsedBody.data,
          getRequestAuditContext(request)
        ),
        message: 'Professeur mis a jour.',
      });
    } catch (error) {
      return sendPeopleError(reply, error);
    }
  };

  readonly archiveTeacher = async (request: FastifyRequest, reply: FastifyReply) => {
    const parsedBody = archiveTeacherRequestSchema.safeParse(request.body);

    if (!parsedBody.success) {
      return sendValidationError(reply, parsedBody.error);
    }

    try {
      const actor = await this.authenticateRequest(request);

      return await reply.send({
        success: true,
        data: this.teachersService.archive(
          actor,
          readParam(request, 'teacherId'),
          parsedBody.data,
          getRequestAuditContext(request)
        ),
        message: 'Professeur archive.',
      });
    } catch (error) {
      return sendPeopleError(reply, error);
    }
  };

  readonly reactivateTeacher = async (request: FastifyRequest, reply: FastifyReply) => {
    const parsedBody = archiveTeacherRequestSchema.safeParse(request.body);

    if (!parsedBody.success) {
      return sendValidationError(reply, parsedBody.error);
    }

    try {
      const actor = await this.authenticateRequest(request);

      return await reply.send({
        success: true,
        data: this.teachersService.reactivate(
          actor,
          readParam(request, 'teacherId'),
          parsedBody.data,
          getRequestAuditContext(request)
        ),
        message: 'Professeur reactive.',
      });
    } catch (error) {
      return sendPeopleError(reply, error);
    }
  };

  readonly createTeacherLogin = async (request: FastifyRequest, reply: FastifyReply) => {
    const parsedBody = createTeacherLoginRequestSchema.safeParse(request.body);

    if (!parsedBody.success) {
      return sendValidationError(reply, parsedBody.error);
    }

    try {
      const actor = await this.authenticateRequest(request);

      return await reply.send({
        success: true,
        data: await this.teachersService.createLogin(
          actor,
          readParam(request, 'teacherId'),
          getRequestAuditContext(request)
        ),
        message: 'Compte de connexion cree.',
      });
    } catch (error) {
      return sendPeopleError(reply, error);
    }
  };

  readonly deactivateTeacherLogin = async (request: FastifyRequest, reply: FastifyReply) => {
    const parsedBody = deactivateTeacherLoginRequestSchema.safeParse(request.body);

    if (!parsedBody.success) {
      return sendValidationError(reply, parsedBody.error);
    }

    try {
      const actor = await this.authenticateRequest(request);

      return await reply.send({
        success: true,
        data: this.teachersService.deactivateLogin(
          actor,
          readParam(request, 'teacherId'),
          parsedBody.data,
          getRequestAuditContext(request)
        ),
        message: 'Compte de connexion desactive.',
      });
    } catch (error) {
      return sendPeopleError(reply, error);
    }
  };

  readonly reactivateTeacherLogin = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const actor = await this.authenticateRequest(request);

      return await reply.send({
        success: true,
        data: this.teachersService.reactivateLogin(
          actor,
          readParam(request, 'teacherId'),
          getRequestAuditContext(request)
        ),
        message: 'Compte de connexion reactive.',
      });
    } catch (error) {
      return sendPeopleError(reply, error);
    }
  };

  private async authenticateRequest(request: FastifyRequest) {
    return this.authService.verifyAccessToken(
      parseAuthorizationHeader(readHeader(request.headers.authorization))
    );
  }
}

function sendPeopleError(reply: FastifyReply, error: unknown) {
  const publicError =
    error instanceof PeopleServiceError || error instanceof AuthServiceError
      ? error
      : new PeopleServiceError('PEOPLE_FAILED', 500, 'La gestion des eleves a echoue.');

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
    throw new PeopleServiceError('PEOPLE_FAILED', 400, 'Parametre manquant.');
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
