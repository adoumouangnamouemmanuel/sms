import {
  createAuditLogRepository,
  createSubjectGroupRepository,
  createTenantContext,
  withTransaction,
  type EduTrackDatabase,
} from '@edutrack/db';
import type {
  CreateSubjectGroupRequest,
  SetSubjectGroupMembersRequest,
  SubjectGroupMembersResponse,
  SubjectGroupsResponse,
  SubjectGroupView,
  UpdateSubjectGroupRequest,
} from '@edutrack/shared';
import type { AuthenticatedUser, RequestAuditContext } from '../auth/index.js';
import {
  classesForbidden,
  subjectGroupNameAlreadyExists,
  subjectGroupNotFound,
  versionConflict,
} from './classes.errors.js';

export interface SubjectGroupsServiceOptions {
  now?: () => Date;
}

/**
 * School-defined subject groups / sections service (roadmap §9.6). Groups are
 * pure configuration: name, display order and membership; membership order is
 * the array order sent by the client and replaces the previous membership
 * atomically.
 */
export class SubjectGroupsService {
  private readonly now: () => Date;

  constructor(
    private readonly db: EduTrackDatabase,
    options: SubjectGroupsServiceOptions = {}
  ) {
    this.now = options.now ?? (() => new Date());
  }

  list(actor: AuthenticatedUser): SubjectGroupsResponse {
    const tenant = createTenantContext(actor.schoolId);
    const repository = createSubjectGroupRepository(this.db, tenant);

    return {
      items: repository.listWithCounts(),
    };
  }

  create(
    actor: AuthenticatedUser,
    input: CreateSubjectGroupRequest,
    requestContext: RequestAuditContext = {}
  ): SubjectGroupView {
    this.assertSchoolMaster(actor);
    const tenant = createTenantContext(actor.schoolId);
    const updatedAt = this.now().toISOString();

    return withTransaction(this.db, (transaction) => {
      const repository = createSubjectGroupRepository(transaction, tenant);

      try {
        const group = repository.create(
          {
            name: input.name.trim(),
            nameEn: input.nameEn ?? null,
            nameAr: input.nameAr ?? null,
            displayOrder: input.displayOrder,
          },
          updatedAt
        );

        createAuditLogRepository(transaction, tenant).createEvent({
          actorUserId: actor.id,
          action: 'CONFIG_GROUP_CREATE',
          targetType: 'subject_group',
          targetId: group.id,
          correlationId: requestContext.correlationId ?? null,
          metadata: { name: group.name },
        });

        return { ...group, subjectCount: 0 };
      } catch (error) {
        if (isUniqueConstraintViolation(error)) {
          throw subjectGroupNameAlreadyExists();
        }

        throw error;
      }
    });
  }

  update(
    actor: AuthenticatedUser,
    groupId: string,
    input: UpdateSubjectGroupRequest,
    requestContext: RequestAuditContext = {}
  ): SubjectGroupView {
    this.assertSchoolMaster(actor);
    const tenant = createTenantContext(actor.schoolId);
    const updatedAt = this.now().toISOString();

    return withTransaction(this.db, (transaction) => {
      const repository = createSubjectGroupRepository(transaction, tenant);
      const current = repository.findById(groupId);

      if (!current) {
        throw subjectGroupNotFound();
      }

      if (input.recordVersion !== undefined && current.recordVersion !== input.recordVersion) {
        throw versionConflict();
      }

      try {
        const updated = repository.update(groupId, normalizeUpdate(input), updatedAt);
        const memberCount = repository.listMembers(groupId).length;

        createAuditLogRepository(transaction, tenant).createEvent({
          actorUserId: actor.id,
          action: 'CONFIG_GROUP_UPDATE',
          targetType: 'subject_group',
          targetId: groupId,
          correlationId: requestContext.correlationId ?? null,
          metadata: { updatedFields: Object.keys(input) },
        });

        return { ...updated, subjectCount: memberCount };
      } catch (error) {
        if (isUniqueConstraintViolation(error)) {
          throw subjectGroupNameAlreadyExists();
        }

        throw error;
      }
    });
  }

  archive(
    actor: AuthenticatedUser,
    groupId: string,
    requestContext: RequestAuditContext = {}
  ): SubjectGroupView {
    this.assertSchoolMaster(actor);
    const tenant = createTenantContext(actor.schoolId);
    const updatedAt = this.now().toISOString();

    return withTransaction(this.db, (transaction) => {
      const repository = createSubjectGroupRepository(transaction, tenant);

      if (!repository.findById(groupId)) {
        throw subjectGroupNotFound();
      }

      const archived = repository.archive(groupId, updatedAt);
      createAuditLogRepository(transaction, tenant).createEvent({
        actorUserId: actor.id,
        action: 'CONFIG_GROUP_UPDATE',
        targetType: 'subject_group',
        targetId: groupId,
        correlationId: requestContext.correlationId ?? null,
        metadata: { archived: true },
      });

      return { ...archived, subjectCount: 0 };
    });
  }

  listMembers(actor: AuthenticatedUser, groupId: string): SubjectGroupMembersResponse {
    const tenant = createTenantContext(actor.schoolId);
    const repository = createSubjectGroupRepository(this.db, tenant);

    if (!repository.findById(groupId)) {
      throw subjectGroupNotFound();
    }

    return {
      members: repository.listMembers(groupId),
    };
  }

  setMembers(
    actor: AuthenticatedUser,
    groupId: string,
    input: SetSubjectGroupMembersRequest,
    requestContext: RequestAuditContext = {}
  ): SubjectGroupMembersResponse {
    this.assertSchoolMaster(actor);
    const tenant = createTenantContext(actor.schoolId);
    const updatedAt = this.now().toISOString();

    return withTransaction(this.db, (transaction) => {
      const repository = createSubjectGroupRepository(transaction, tenant);

      if (!repository.findById(groupId)) {
        throw subjectGroupNotFound();
      }

      const members = repository.replaceMembers(groupId, input.subjectIds, updatedAt);
      createAuditLogRepository(transaction, tenant).createEvent({
        actorUserId: actor.id,
        action: 'CONFIG_GROUP_UPDATE',
        targetType: 'subject_group',
        targetId: groupId,
        correlationId: requestContext.correlationId ?? null,
        metadata: { memberCount: input.subjectIds.length },
      });

      return { members };
    });
  }

  private assertSchoolMaster(actor: AuthenticatedUser) {
    if (actor.role !== 'SCHOOL_MASTER') {
      throw classesForbidden();
    }
  }
}

function normalizeUpdate(input: UpdateSubjectGroupRequest) {
  return {
    ...(input.name !== undefined ? { name: input.name.trim() } : {}),
    ...(input.nameEn !== undefined ? { nameEn: input.nameEn ?? null } : {}),
    ...(input.nameAr !== undefined ? { nameAr: input.nameAr ?? null } : {}),
    ...(input.displayOrder !== undefined ? { displayOrder: input.displayOrder } : {}),
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
