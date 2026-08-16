import {
  createAcademicYearRepository,
  createAuditLogRepository,
  createClassEnrollmentRepository,
  createClassLevelRepository,
  createClassroomRepository,
  createTenantContext,
  withTransaction,
  type ClassroomRecord,
  type EduTrackDatabase,
  type RepositoryExecutor,
  type TenantContext,
  type UpdateClassroomInput,
} from '@edutrack/db';
import type {
  ArchiveClassroomRequest,
  ClassroomListQuery,
  ClassroomView,
  CreateClassroomRequest,
  PaginatedClassroomsResponse,
  UpdateClassroomRequest,
} from '@edutrack/shared';
import type { AuthenticatedUser, RequestAuditContext } from '../auth/index.js';
import { toClassroomView } from './classes.mappers.js';
import {
  academicYearNotFound,
  classesForbidden,
  classroomCodeAlreadyExists,
  classroomNotFound,
  classLevelNotFound,
  versionConflict,
} from './classes.errors.js';

export interface ClassroomsServiceOptions {
  now?: () => Date;
}

/**
 * Application service for classrooms (cohorts within an academic year).
 * A classroom belongs to one academic year and one class level; its code
 * (e.g. "3E-A") is unique per school + year.
 */
export class ClassroomsService {
  private readonly now: () => Date;

  constructor(
    private readonly db: EduTrackDatabase,
    options: ClassroomsServiceOptions = {}
  ) {
    this.now = options.now ?? (() => new Date());
  }

  list(actor: AuthenticatedUser, query: ClassroomListQuery): PaginatedClassroomsResponse {
    this.assertSchoolMaster(actor);
    const tenant = createTenantContext(actor.schoolId);
    const repository = createClassroomRepository(this.db, tenant);
    const listOptions = {
      ...(query.academicYearId !== undefined ? { academicYearId: query.academicYearId } : {}),
      ...(query.classLevelId !== undefined ? { classLevelId: query.classLevelId } : {}),
      ...(query.search !== undefined ? { search: query.search } : {}),
      ...(query.status !== undefined ? { status: query.status } : {}),
      limit: query.limit,
      offset: query.offset,
    };
    const items = repository
      .list(listOptions)
      .map((classroom) => this.toView(this.db, tenant, classroom))
      .filter((view): view is ClassroomView => view !== null);

    return {
      items,
      total: repository.count(listOptions),
      limit: query.limit,
      offset: query.offset,
    };
  }

  /** Shared view builder used by the enrollment service for the roster header. */
  getRosterContext(actor: AuthenticatedUser, classroomId: string): ClassroomView | null {
    this.assertSchoolMaster(actor);
    const tenant = createTenantContext(actor.schoolId);
    const classroom = createClassroomRepository(this.db, tenant).findById(classroomId);

    return classroom ? this.toView(this.db, tenant, classroom) : null;
  }

  create(
    actor: AuthenticatedUser,
    input: CreateClassroomRequest,
    requestContext: RequestAuditContext = {}
  ): ClassroomView {
    this.assertSchoolMaster(actor);
    const tenant = createTenantContext(actor.schoolId);

    return withTransaction(this.db, (transaction) => {
      this.assertReferencesExist(transaction, tenant, input);
      const repository = createClassroomRepository(transaction, tenant);

      try {
        const classroom = repository.create({
          academicYearId: input.academicYearId,
          classLevelId: input.classLevelId,
          code: input.code.trim().toUpperCase(),
          name: input.name ?? null,
          capacity: input.capacity ?? null,
        });

        createAuditLogRepository(transaction, tenant).createEvent({
          actorUserId: actor.id,
          action: 'CLASSROOM_CREATE',
          targetType: 'classroom',
          targetId: classroom.id,
          correlationId: requestContext.correlationId ?? null,
          metadata: { code: classroom.code },
        });

        const view = this.toView(transaction, tenant, classroom);

        if (!view) {
          throw classroomNotFound();
        }

        return view;
      } catch (error) {
        if (isUniqueConstraintViolation(error)) {
          throw classroomCodeAlreadyExists();
        }

        throw error;
      }
    });
  }

  update(
    actor: AuthenticatedUser,
    classroomId: string,
    input: UpdateClassroomRequest,
    requestContext: RequestAuditContext = {}
  ): ClassroomView {
    this.assertSchoolMaster(actor);
    const tenant = createTenantContext(actor.schoolId);
    const updatedAt = this.now().toISOString();

    return withTransaction(this.db, (transaction) => {
      const repository = createClassroomRepository(transaction, tenant);
      const current = repository.findById(classroomId);

      if (!current) {
        throw classroomNotFound();
      }

      if (input.recordVersion !== undefined && current.recordVersion !== input.recordVersion) {
        throw versionConflict();
      }

      const updated = repository.update(classroomId, normalizeClassroomUpdate(input), updatedAt);
      createAuditLogRepository(transaction, tenant).createEvent({
        actorUserId: actor.id,
        action: 'CLASSROOM_UPDATE',
        targetType: 'classroom',
        targetId: classroomId,
        correlationId: requestContext.correlationId ?? null,
        metadata: { updatedFields: Object.keys(input) },
      });

      const view = this.toView(transaction, tenant, updated);

      if (!view) {
        throw classroomNotFound();
      }

      return view;
    });
  }

  archive(
    actor: AuthenticatedUser,
    classroomId: string,
    input: ArchiveClassroomRequest,
    requestContext: RequestAuditContext = {}
  ): ClassroomView {
    this.assertSchoolMaster(actor);
    const tenant = createTenantContext(actor.schoolId);
    const updatedAt = this.now().toISOString();

    return withTransaction(this.db, (transaction) => {
      const repository = createClassroomRepository(transaction, tenant);

      if (!repository.findById(classroomId)) {
        throw classroomNotFound();
      }

      const archived = repository.archive(classroomId, updatedAt);
      createAuditLogRepository(transaction, tenant).createEvent({
        actorUserId: actor.id,
        action: 'CLASSROOM_ARCHIVE',
        targetType: 'classroom',
        targetId: classroomId,
        correlationId: requestContext.correlationId ?? null,
        metadata: { reason: input.reason },
      });

      const view = this.toView(transaction, tenant, archived);

      if (!view) {
        throw classroomNotFound();
      }

      return view;
    });
  }

  reactivate(
    actor: AuthenticatedUser,
    classroomId: string,
    input: ArchiveClassroomRequest,
    requestContext: RequestAuditContext = {}
  ): ClassroomView {
    this.assertSchoolMaster(actor);
    const tenant = createTenantContext(actor.schoolId);
    const updatedAt = this.now().toISOString();

    return withTransaction(this.db, (transaction) => {
      const repository = createClassroomRepository(transaction, tenant);

      if (!repository.findById(classroomId)) {
        throw classroomNotFound();
      }

      const reactivated = repository.reactivate(classroomId, updatedAt);
      createAuditLogRepository(transaction, tenant).createEvent({
        actorUserId: actor.id,
        action: 'CLASSROOM_REACTIVATE',
        targetType: 'classroom',
        targetId: classroomId,
        correlationId: requestContext.correlationId ?? null,
        metadata: { reason: input.reason },
      });

      const view = this.toView(transaction, tenant, reactivated);

      if (!view) {
        throw classroomNotFound();
      }

      return view;
    });
  }

  /**
   * Builds the display view for a classroom record. Executed inside the active
   * transaction when one is open, so headcounts never observe partial commits.
   */
  private toView(
    executor: RepositoryExecutor,
    tenant: TenantContext,
    classroom: ClassroomRecord
  ): ClassroomView | null {
    const classLevel = createClassLevelRepository(executor, tenant).findById(
      classroom.classLevelId
    );
    const academicYear = createAcademicYearRepository(executor, tenant).findById(
      classroom.academicYearId
    );

    if (!classLevel || !academicYear) {
      return null;
    }

    const activeEnrollmentCount = createClassEnrollmentRepository(executor, tenant).count({
      classroomId: classroom.id,
      status: 'ACTIVE',
    });

    return toClassroomView(classroom, { classLevel, academicYear, activeEnrollmentCount });
  }

  private assertReferencesExist(
    executor: RepositoryExecutor,
    tenant: TenantContext,
    input: CreateClassroomRequest
  ) {
    const academicYear = createAcademicYearRepository(executor, tenant).findActiveById(
      input.academicYearId
    );

    if (!academicYear) {
      throw academicYearNotFound();
    }

    if (!createClassLevelRepository(executor, tenant).findById(input.classLevelId)) {
      throw classLevelNotFound();
    }
  }

  private assertSchoolMaster(actor: AuthenticatedUser) {
    if (actor.role !== 'SCHOOL_MASTER') {
      throw classesForbidden();
    }
  }
}

function normalizeClassroomUpdate(input: UpdateClassroomRequest): UpdateClassroomInput {
  return {
    ...(input.name !== undefined ? { name: input.name ?? null } : {}),
    ...(input.capacity !== undefined ? { capacity: input.capacity ?? null } : {}),
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
