import {
  createAuditLogRepository,
  createGuardianRepository,
  createStudentGuardianRepository,
  createStudentRepository,
  createTenantContext,
  withTransaction,
  type EduTrackDatabase,
  type UpdateStudentGuardianInput,
  type UpdateStudentInput,
} from '@edutrack/db';
import type {
  ArchiveStudentRequest,
  CreateStudentRequest,
  LinkStudentGuardianRequest,
  PaginatedStudentsResponse,
  StudentListQuery,
  StudentProfileResponse,
  UpdateStudentGuardianLinkRequest,
  UpdateStudentRequest,
} from '@edutrack/shared';
import type { AuthenticatedUser, RequestAuditContext } from '../auth/index.js';
import { generatePeopleCode, normalizePeopleCode } from './people.codes.js';
import { toGuardianResponse, toLinkResponse, toStudentResponse } from './people.mappers.js';
import {
  guardianNotFound,
  peopleForbidden,
  studentCodeAlreadyExists,
  studentGuardianLinkAlreadyExists,
  studentGuardianLinkNotFound,
  studentNotFound,
} from './people.errors.js';

export interface StudentsServiceOptions {
  now?: () => Date;
}

const MAX_GENERATED_CODE_ATTEMPTS = 5;

/**
 * Application service for tenant-scoped student records and guardian links.
 * Codes are durable identity (never reused); when omitted, the service
 * generates `{school.code}-{academicYearStart}-{NNI}` with a sequential NNI
 * fallback until the real NNI arrives via the Excel import.
 */
export class StudentsService {
  private readonly now: () => Date;

  constructor(
    private readonly db: EduTrackDatabase,
    options: StudentsServiceOptions = {}
  ) {
    this.now = options.now ?? (() => new Date());
  }

  list(actor: AuthenticatedUser, query: StudentListQuery): PaginatedStudentsResponse {
    this.assertSchoolMaster(actor);
    const repository = createStudentRepository(this.db, createTenantContext(actor.schoolId));
    const listOptions = {
      ...(query.search !== undefined ? { search: query.search } : {}),
      ...(query.status !== undefined ? { status: query.status } : {}),
      ...(query.classLevelId !== undefined ? { classLevelId: query.classLevelId } : {}),
      ...(query.classroomId !== undefined ? { classroomId: query.classroomId } : {}),
      ...(query.sex !== undefined ? { sex: query.sex } : {}),
      limit: query.limit,
      offset: query.offset,
    };
    const items = repository.listWithClassrooms(listOptions);

    return {
      items: items.map(toStudentResponse),
      total: repository.count(listOptions),
      limit: query.limit,
      offset: query.offset,
    };
  }

  getProfile(actor: AuthenticatedUser, studentId: string): StudentProfileResponse {
    this.assertSchoolMaster(actor);
    const tenant = createTenantContext(actor.schoolId);
    const student = createStudentRepository(this.db, tenant).findByIdWithClassroom(studentId);

    if (!student) {
      throw studentNotFound();
    }

    const guardians = createStudentGuardianRepository(this.db, tenant)
      .listForStudent(studentId)
      .flatMap((link) => {
        const guardian = createGuardianRepository(this.db, tenant).findById(link.guardianId);

        return guardian
          ? [{ link: toLinkResponse(link), guardian: toGuardianResponse(guardian) }]
          : [];
      });

    return {
      student: toStudentResponse(student),
      guardians,
    };
  }

  create(
    actor: AuthenticatedUser,
    input: CreateStudentRequest,
    requestContext: RequestAuditContext = {}
  ) {
    this.assertSchoolMaster(actor);
    const tenant = createTenantContext(actor.schoolId);

    return withTransaction(this.db, (transaction) => {
      const repository = createStudentRepository(transaction, tenant);
      let lastError: unknown;

      for (let attempt = 0; attempt < MAX_GENERATED_CODE_ATTEMPTS; attempt += 1) {
        try {
          const code = input.code?.trim()
            ? normalizePeopleCode(input.code)
            : generatePeopleCode(
                transaction,
                tenant,
                this.now,
                () => createStudentRepository(transaction, tenant).countAll(),
                attempt
              );

          const student = repository.create({
            code,
            firstName: input.firstName.trim(),
            lastName: input.lastName.trim(),
            sex: input.sex ?? null,
            dateOfBirth: input.dateOfBirth ?? null,
            placeOfBirth: input.placeOfBirth ?? null,
            nationality: input.nationality ?? null,
            photoUrl: input.photoUrl ?? null,
            phone: input.phone ?? null,
            email: input.email ?? null,
            address: input.address ?? null,
          });

          createAuditLogRepository(transaction, tenant).createEvent({
            actorUserId: actor.id,
            action: 'STUDENT_CREATE',
            targetType: 'student',
            targetId: student.id,
            correlationId: requestContext.correlationId ?? null,
            metadata: { code: student.code },
          });

          return toStudentResponse(student);
        } catch (error) {
          if (!isUniqueConstraintViolation(error)) {
            throw error;
          }

          // An explicit code collision is a caller error; a generated code
          // collision is retried with the next sequence number.
          if (input.code?.trim()) {
            throw studentCodeAlreadyExists();
          }

          lastError = error;
        }
      }

      throw lastError;
    });
  }

  update(
    actor: AuthenticatedUser,
    studentId: string,
    input: UpdateStudentRequest,
    requestContext: RequestAuditContext = {}
  ) {
    this.assertSchoolMaster(actor);
    const tenant = createTenantContext(actor.schoolId);
    const updatedAt = this.now().toISOString();

    return withTransaction(this.db, (transaction) => {
      const repository = createStudentRepository(transaction, tenant);

      if (!repository.findById(studentId)) {
        throw studentNotFound();
      }

      const updated = repository.update(studentId, normalizeStudentUpdate(input), updatedAt);
      createAuditLogRepository(transaction, tenant).createEvent({
        actorUserId: actor.id,
        action: 'STUDENT_UPDATE',
        targetType: 'student',
        targetId: studentId,
        correlationId: requestContext.correlationId ?? null,
        metadata: { updatedFields: Object.keys(input) },
      });

      return toStudentResponse(updated);
    });
  }

  archive(
    actor: AuthenticatedUser,
    studentId: string,
    input: ArchiveStudentRequest,
    requestContext: RequestAuditContext = {}
  ) {
    this.assertSchoolMaster(actor);
    const tenant = createTenantContext(actor.schoolId);
    const updatedAt = this.now().toISOString();

    return withTransaction(this.db, (transaction) => {
      const repository = createStudentRepository(transaction, tenant);

      if (!repository.findById(studentId)) {
        throw studentNotFound();
      }

      const archived = repository.archive(studentId, updatedAt);
      createAuditLogRepository(transaction, tenant).createEvent({
        actorUserId: actor.id,
        action: 'STUDENT_ARCHIVE',
        targetType: 'student',
        targetId: studentId,
        correlationId: requestContext.correlationId ?? null,
        metadata: { reason: input.reason },
      });

      return toStudentResponse(archived);
    });
  }

  reactivate(
    actor: AuthenticatedUser,
    studentId: string,
    input: ArchiveStudentRequest,
    requestContext: RequestAuditContext = {}
  ) {
    this.assertSchoolMaster(actor);
    const tenant = createTenantContext(actor.schoolId);
    const updatedAt = this.now().toISOString();

    return withTransaction(this.db, (transaction) => {
      const repository = createStudentRepository(transaction, tenant);

      if (!repository.findById(studentId)) {
        throw studentNotFound();
      }

      const reactivated = repository.reactivate(studentId, updatedAt);
      createAuditLogRepository(transaction, tenant).createEvent({
        actorUserId: actor.id,
        action: 'STUDENT_REACTIVATE',
        targetType: 'student',
        targetId: studentId,
        correlationId: requestContext.correlationId ?? null,
        metadata: { reason: input.reason },
      });

      return toStudentResponse(reactivated);
    });
  }

  linkGuardian(
    actor: AuthenticatedUser,
    studentId: string,
    input: LinkStudentGuardianRequest,
    requestContext: RequestAuditContext = {}
  ) {
    this.assertSchoolMaster(actor);
    const tenant = createTenantContext(actor.schoolId);
    const updatedAt = this.now().toISOString();

    return withTransaction(this.db, (transaction) => {
      if (!createStudentRepository(transaction, tenant).findById(studentId)) {
        throw studentNotFound();
      }

      if (!createGuardianRepository(transaction, tenant).findById(input.guardianId)) {
        throw guardianNotFound();
      }

      const repository = createStudentGuardianRepository(transaction, tenant);

      if (input.isPrimary === true) {
        repository.demotePrimary(studentId, undefined, updatedAt);
      }

      try {
        const link = repository.link({
          studentId,
          guardianId: input.guardianId,
          relationshipType: input.relationshipType,
          isPrimary: input.isPrimary ?? false,
          isEmergency: input.isEmergency ?? false,
          notes: input.notes ?? null,
        });

        createAuditLogRepository(transaction, tenant).createEvent({
          actorUserId: actor.id,
          action: 'STUDENT_GUARDIAN_LINK',
          targetType: 'student_guardian',
          targetId: link.id,
          correlationId: requestContext.correlationId ?? null,
          metadata: {
            studentId,
            guardianId: input.guardianId,
            relationshipType: input.relationshipType,
          },
        });

        return toLinkResponse(link);
      } catch (error) {
        if (isUniqueConstraintViolation(error)) {
          throw studentGuardianLinkAlreadyExists();
        }

        throw error;
      }
    });
  }

  updateGuardianLink(
    actor: AuthenticatedUser,
    linkId: string,
    input: UpdateStudentGuardianLinkRequest,
    requestContext: RequestAuditContext = {}
  ) {
    this.assertSchoolMaster(actor);
    const tenant = createTenantContext(actor.schoolId);
    const updatedAt = this.now().toISOString();

    return withTransaction(this.db, (transaction) => {
      const repository = createStudentGuardianRepository(transaction, tenant);
      const current = repository.findById(linkId);

      if (!current) {
        throw studentGuardianLinkNotFound();
      }

      if (input.isPrimary === true) {
        repository.demotePrimary(current.studentId, linkId, updatedAt);
      }

      const updated = repository.update(linkId, normalizeLinkUpdate(input), updatedAt);
      createAuditLogRepository(transaction, tenant).createEvent({
        actorUserId: actor.id,
        action: 'STUDENT_GUARDIAN_UPDATE',
        targetType: 'student_guardian',
        targetId: linkId,
        correlationId: requestContext.correlationId ?? null,
        metadata: { updatedFields: Object.keys(input) },
      });

      return toLinkResponse(updated);
    });
  }

  unlinkGuardian(
    actor: AuthenticatedUser,
    linkId: string,
    requestContext: RequestAuditContext = {}
  ) {
    this.assertSchoolMaster(actor);
    const tenant = createTenantContext(actor.schoolId);
    const updatedAt = this.now().toISOString();

    return withTransaction(this.db, (transaction) => {
      const repository = createStudentGuardianRepository(transaction, tenant);

      if (!repository.findById(linkId)) {
        throw studentGuardianLinkNotFound();
      }

      const unlinked = repository.unlink(linkId, updatedAt);
      createAuditLogRepository(transaction, tenant).createEvent({
        actorUserId: actor.id,
        action: 'STUDENT_GUARDIAN_UNLINK',
        targetType: 'student_guardian',
        targetId: linkId,
        correlationId: requestContext.correlationId ?? null,
        metadata: { studentId: unlinked.studentId, guardianId: unlinked.guardianId },
      });

      return toLinkResponse(unlinked);
    });
  }

  private assertSchoolMaster(actor: AuthenticatedUser) {
    if (actor.role !== 'SCHOOL_MASTER') {
      throw peopleForbidden();
    }
  }
}

function normalizeLinkUpdate(input: UpdateStudentGuardianLinkRequest): UpdateStudentGuardianInput {
  return {
    ...(input.relationshipType !== undefined ? { relationshipType: input.relationshipType } : {}),
    ...(input.isPrimary !== undefined ? { isPrimary: input.isPrimary } : {}),
    ...(input.isEmergency !== undefined ? { isEmergency: input.isEmergency } : {}),
    ...(input.notes !== undefined ? { notes: input.notes ?? null } : {}),
  };
}

function normalizeStudentUpdate(input: UpdateStudentRequest): UpdateStudentInput {
  return {
    ...(input.firstName !== undefined ? { firstName: input.firstName.trim() } : {}),
    ...(input.lastName !== undefined ? { lastName: input.lastName.trim() } : {}),
    ...(input.sex !== undefined ? { sex: input.sex ?? null } : {}),
    ...(input.dateOfBirth !== undefined ? { dateOfBirth: input.dateOfBirth ?? null } : {}),
    ...(input.placeOfBirth !== undefined ? { placeOfBirth: input.placeOfBirth ?? null } : {}),
    ...(input.nationality !== undefined ? { nationality: input.nationality ?? null } : {}),
    ...(input.photoUrl !== undefined ? { photoUrl: input.photoUrl ?? null } : {}),
    ...(input.phone !== undefined ? { phone: input.phone ?? null } : {}),
    ...(input.email !== undefined ? { email: input.email ?? null } : {}),
    ...(input.address !== undefined ? { address: input.address ?? null } : {}),
  };
}

function isUniqueConstraintViolation(error: unknown) {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === 'SQLITE_CONSTRAINT_UNIQUE'
  );
}
