import {
  createAuditLogRepository,
  createClassSubjectRepository,
  createClassroomRepository,
  createSubjectRepository,
  createTeacherRepository,
  createTenantContext,
  withTransaction,
  type ClassSubjectRecord,
  type EduTrackDatabase,
  type UpdateClassSubjectInput,
} from '@edutrack/db';
import type {
  AssignClassSubjectRequest,
  ClassSubjectListQuery,
  ClassSubjectView,
  UpdateClassSubjectRequest,
} from '@edutrack/shared';
import type { AuthenticatedUser, RequestAuditContext } from '../auth/index.js';
import { toClassSubjectView } from './classes.mappers.js';
import {
  classesForbidden,
  classroomNotFound,
  classSubjectNotFound,
  classSubjectPairAlreadyExists,
  subjectNotFound,
  teacherNotFound,
  versionConflict,
} from './classes.errors.js';

export interface ClassSubjectsServiceOptions {
  now?: () => Date;
}

/**
 * Application service for subject/coefficient/teacher assignments on a
 * classroom (roadmap §10.2). `isRequired=false` marks a class-subject
 * optional: students must be enrolled explicitly (see ClassEnrollmentsService).
 */
export class ClassSubjectsService {
  private readonly now: () => Date;

  constructor(
    private readonly db: EduTrackDatabase,
    options: ClassSubjectsServiceOptions = {}
  ) {
    this.now = options.now ?? (() => new Date());
  }

  list(actor: AuthenticatedUser, query: ClassSubjectListQuery): ClassSubjectView[] {
    this.assertSchoolMaster(actor);
    const tenant = createTenantContext(actor.schoolId);
    const repository = createClassSubjectRepository(this.db, tenant);
    const listOptions = {
      classroomId: query.classroomId,
      ...(query.status !== undefined ? { status: query.status } : {}),
      limit: 200,
    };
    const subjectRepository = createSubjectRepository(this.db, tenant);
    const teacherRepository = createTeacherRepository(this.db, tenant);

    return repository
      .list(listOptions)
      .map((classSubject) => this.toView(classSubject, subjectRepository, teacherRepository))
      .filter((view): view is ClassSubjectView => view !== null);
  }

  assign(
    actor: AuthenticatedUser,
    input: AssignClassSubjectRequest,
    requestContext: RequestAuditContext = {}
  ): ClassSubjectView {
    this.assertSchoolMaster(actor);
    const tenant = createTenantContext(actor.schoolId);

    return withTransaction(this.db, (transaction) => {
      if (!createClassroomRepository(transaction, tenant).findById(input.classroomId)) {
        throw classroomNotFound();
      }

      const subject = createSubjectRepository(transaction, tenant).findById(input.subjectId);

      if (!subject) {
        throw subjectNotFound();
      }

      if (input.teacherId) {
        assertTeacherExists(transaction, tenant, input.teacherId);
      }

      const repository = createClassSubjectRepository(transaction, tenant);

      if (repository.findByClassroomSubject(input.classroomId, input.subjectId)) {
        throw classSubjectPairAlreadyExists();
      }

      let classSubject;

      try {
        classSubject = repository.create({
          classroomId: input.classroomId,
          subjectId: input.subjectId,
          coefficient: input.coefficient,
          isRequired: input.isRequired,
          teacherId: input.teacherId ?? null,
        });
      } catch (error) {
        // A concurrent assign can race the pre-check above: map the unique
        // violation to the stable domain error instead of a raw 500.
        if (isUniqueConstraintViolation(error)) {
          throw classSubjectPairAlreadyExists();
        }

        throw error;
      }

      createAuditLogRepository(transaction, tenant).createEvent({
        actorUserId: actor.id,
        action: 'CLASS_SUBJECT_ASSIGN',
        targetType: 'class_subject',
        targetId: classSubject.id,
        correlationId: requestContext.correlationId ?? null,
        metadata: {
          classroomId: input.classroomId,
          subjectId: input.subjectId,
          coefficient: input.coefficient,
          isRequired: input.isRequired,
        },
      });

      const view = this.toView(
        classSubject,
        createSubjectRepository(transaction, tenant),
        createTeacherRepository(transaction, tenant)
      );

      if (!view) {
        throw subjectNotFound();
      }

      return view;
    });
  }

  update(
    actor: AuthenticatedUser,
    classSubjectId: string,
    input: UpdateClassSubjectRequest,
    requestContext: RequestAuditContext = {}
  ): ClassSubjectView {
    this.assertSchoolMaster(actor);
    const tenant = createTenantContext(actor.schoolId);
    const updatedAt = this.now().toISOString();

    return withTransaction(this.db, (transaction) => {
      const repository = createClassSubjectRepository(transaction, tenant);
      const current = repository.findById(classSubjectId);

      if (!current) {
        throw classSubjectNotFound();
      }

      if (input.recordVersion !== undefined && current.recordVersion !== input.recordVersion) {
        throw versionConflict();
      }

      if (input.teacherId !== undefined && input.teacherId !== null) {
        assertTeacherExists(transaction, tenant, input.teacherId);
      }

      const updated = repository.update(
        classSubjectId,
        normalizeClassSubjectUpdate(input),
        updatedAt
      );
      createAuditLogRepository(transaction, tenant).createEvent({
        actorUserId: actor.id,
        action: 'CLASS_SUBJECT_UPDATE',
        targetType: 'class_subject',
        targetId: classSubjectId,
        correlationId: requestContext.correlationId ?? null,
        metadata: { updatedFields: Object.keys(input) },
      });

      const view = this.toView(
        updated,
        createSubjectRepository(transaction, tenant),
        createTeacherRepository(transaction, tenant)
      );

      if (!view) {
        throw subjectNotFound();
      }

      return view;
    });
  }

  remove(
    actor: AuthenticatedUser,
    classSubjectId: string,
    requestContext: RequestAuditContext = {}
  ): ClassSubjectView {
    this.assertSchoolMaster(actor);
    const tenant = createTenantContext(actor.schoolId);
    const updatedAt = this.now().toISOString();

    return withTransaction(this.db, (transaction) => {
      const repository = createClassSubjectRepository(transaction, tenant);

      if (!repository.findById(classSubjectId)) {
        throw classSubjectNotFound();
      }

      const archived = repository.archive(classSubjectId, updatedAt);
      createAuditLogRepository(transaction, tenant).createEvent({
        actorUserId: actor.id,
        action: 'CLASS_SUBJECT_REMOVE',
        targetType: 'class_subject',
        targetId: classSubjectId,
        correlationId: requestContext.correlationId ?? null,
        metadata: { classroomId: archived.classroomId, subjectId: archived.subjectId },
      });

      const view = this.toView(
        archived,
        createSubjectRepository(transaction, tenant),
        createTeacherRepository(transaction, tenant)
      );

      if (!view) {
        throw subjectNotFound();
      }

      return view;
    });
  }

  private toView(
    classSubject: ClassSubjectRecord,
    subjectRepository: ReturnType<typeof createSubjectRepository>,
    teacherRepository: ReturnType<typeof createTeacherRepository>
  ): ClassSubjectView | null {
    const subject = subjectRepository.findById(classSubject.subjectId);
    const teacher = classSubject.teacherId
      ? (teacherRepository.findById(classSubject.teacherId) ?? null)
      : null;

    if (!subject) {
      return null;
    }

    return toClassSubjectView(classSubject, { subject, teacher });
  }

  private assertSchoolMaster(actor: AuthenticatedUser) {
    if (actor.role !== 'SCHOOL_MASTER') {
      throw classesForbidden();
    }
  }
}

function assertTeacherExists(
  executor: Parameters<typeof createTeacherRepository>[0],
  tenant: Parameters<typeof createTeacherRepository>[1],
  teacherId: string
) {
  if (!createTeacherRepository(executor, tenant).findById(teacherId)) {
    throw teacherNotFound();
  }
}

function isUniqueConstraintViolation(error: unknown) {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === 'SQLITE_CONSTRAINT_UNIQUE'
  );
}

function normalizeClassSubjectUpdate(input: UpdateClassSubjectRequest): UpdateClassSubjectInput {
  return {
    ...(input.coefficient !== undefined ? { coefficient: input.coefficient } : {}),
    ...(input.isRequired !== undefined ? { isRequired: input.isRequired } : {}),
    ...(input.teacherId !== undefined ? { teacherId: input.teacherId ?? null } : {}),
  };
}
