import {
  createAuditLogRepository,
  createSubjectRepository,
  createTenantContext,
  withTransaction,
  type EduTrackDatabase,
  type UpdateSubjectInput,
} from '@edutrack/db';
import type {
  ArchiveClassroomRequest,
  CreateSubjectRequest,
  PaginatedSubjectsResponse,
  SubjectListQuery,
  SubjectResponse,
  UpdateSubjectRequest,
} from '@edutrack/shared';
import type { AuthenticatedUser, RequestAuditContext } from '../auth/index.js';
import { toSubjectResponse } from './classes.mappers.js';
import {
  classesForbidden,
  subjectCodeAlreadyExists,
  subjectNotFound,
  versionConflict,
} from './classes.errors.js';

export interface SubjectsServiceOptions {
  now?: () => Date;
}

/**
 * Application service for the school subject catalogue (roadmap §10.2).
 * Codes are stable tenant-local identity (e.g. "MATH"); names may carry
 * localized display variants.
 */
export class SubjectsService {
  private readonly now: () => Date;

  constructor(
    private readonly db: EduTrackDatabase,
    options: SubjectsServiceOptions = {}
  ) {
    this.now = options.now ?? (() => new Date());
  }

  list(actor: AuthenticatedUser, query: SubjectListQuery): PaginatedSubjectsResponse {
    this.assertSchoolMaster(actor);
    const repository = createSubjectRepository(this.db, createTenantContext(actor.schoolId));
    const listOptions = {
      ...(query.search !== undefined ? { search: query.search } : {}),
      ...(query.category !== undefined ? { category: query.category } : {}),
      ...(query.status !== undefined ? { status: query.status } : {}),
      limit: query.limit,
      offset: query.offset,
    };
    const items = repository.list(listOptions);

    return {
      items: items.map(toSubjectResponse),
      total: repository.count(listOptions),
      limit: query.limit,
      offset: query.offset,
    };
  }

  create(
    actor: AuthenticatedUser,
    input: CreateSubjectRequest,
    requestContext: RequestAuditContext = {}
  ): SubjectResponse {
    this.assertSchoolMaster(actor);
    const tenant = createTenantContext(actor.schoolId);

    return withTransaction(this.db, (transaction) => {
      const repository = createSubjectRepository(transaction, tenant);

      try {
        const subject = repository.create({
          code: input.code.trim().toUpperCase(),
          name: input.name.trim(),
          nameEn: input.nameEn ?? null,
          nameAr: input.nameAr ?? null,
          shortLabel: input.shortLabel ?? null,
          category: input.category,
        });

        createAuditLogRepository(transaction, tenant).createEvent({
          actorUserId: actor.id,
          action: 'SUBJECT_CREATE',
          targetType: 'subject',
          targetId: subject.id,
          correlationId: requestContext.correlationId ?? null,
          metadata: { code: subject.code },
        });

        return toSubjectResponse(subject);
      } catch (error) {
        if (isUniqueConstraintViolation(error)) {
          throw subjectCodeAlreadyExists();
        }

        throw error;
      }
    });
  }

  update(
    actor: AuthenticatedUser,
    subjectId: string,
    input: UpdateSubjectRequest,
    requestContext: RequestAuditContext = {}
  ): SubjectResponse {
    this.assertSchoolMaster(actor);
    const tenant = createTenantContext(actor.schoolId);
    const updatedAt = this.now().toISOString();

    return withTransaction(this.db, (transaction) => {
      const repository = createSubjectRepository(transaction, tenant);
      const current = repository.findById(subjectId);

      if (!current) {
        throw subjectNotFound();
      }

      if (input.recordVersion !== undefined && current.recordVersion !== input.recordVersion) {
        throw versionConflict();
      }

      const updated = repository.update(subjectId, normalizeSubjectUpdate(input), updatedAt);
      createAuditLogRepository(transaction, tenant).createEvent({
        actorUserId: actor.id,
        action: 'SUBJECT_UPDATE',
        targetType: 'subject',
        targetId: subjectId,
        correlationId: requestContext.correlationId ?? null,
        metadata: { updatedFields: Object.keys(input) },
      });

      return toSubjectResponse(updated);
    });
  }

  archive(
    actor: AuthenticatedUser,
    subjectId: string,
    input: ArchiveClassroomRequest,
    requestContext: RequestAuditContext = {}
  ): SubjectResponse {
    this.assertSchoolMaster(actor);
    const tenant = createTenantContext(actor.schoolId);
    const updatedAt = this.now().toISOString();

    return withTransaction(this.db, (transaction) => {
      const repository = createSubjectRepository(transaction, tenant);

      if (!repository.findById(subjectId)) {
        throw subjectNotFound();
      }

      const archived = repository.archive(subjectId, updatedAt);
      createAuditLogRepository(transaction, tenant).createEvent({
        actorUserId: actor.id,
        action: 'SUBJECT_ARCHIVE',
        targetType: 'subject',
        targetId: subjectId,
        correlationId: requestContext.correlationId ?? null,
        metadata: { reason: input.reason },
      });

      return toSubjectResponse(archived);
    });
  }

  reactivate(
    actor: AuthenticatedUser,
    subjectId: string,
    input: ArchiveClassroomRequest,
    requestContext: RequestAuditContext = {}
  ): SubjectResponse {
    this.assertSchoolMaster(actor);
    const tenant = createTenantContext(actor.schoolId);
    const updatedAt = this.now().toISOString();

    return withTransaction(this.db, (transaction) => {
      const repository = createSubjectRepository(transaction, tenant);

      if (!repository.findById(subjectId)) {
        throw subjectNotFound();
      }

      const reactivated = repository.reactivate(subjectId, updatedAt);
      createAuditLogRepository(transaction, tenant).createEvent({
        actorUserId: actor.id,
        action: 'SUBJECT_REACTIVATE',
        targetType: 'subject',
        targetId: subjectId,
        correlationId: requestContext.correlationId ?? null,
        metadata: { reason: input.reason },
      });

      return toSubjectResponse(reactivated);
    });
  }

  private assertSchoolMaster(actor: AuthenticatedUser) {
    if (actor.role !== 'SCHOOL_MASTER') {
      throw classesForbidden();
    }
  }
}

function normalizeSubjectUpdate(input: UpdateSubjectRequest): UpdateSubjectInput {
  return {
    ...(input.name !== undefined ? { name: input.name.trim() } : {}),
    ...(input.nameEn !== undefined ? { nameEn: input.nameEn ?? null } : {}),
    ...(input.nameAr !== undefined ? { nameAr: input.nameAr ?? null } : {}),
    ...(input.shortLabel !== undefined ? { shortLabel: input.shortLabel ?? null } : {}),
    ...(input.category !== undefined ? { category: input.category } : {}),
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
