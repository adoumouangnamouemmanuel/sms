import {
  createAuditLogRepository,
  createGuardianRepository,
  createStudentGuardianRepository,
  createStudentRepository,
  createTenantContext,
  withTransaction,
  type EduTrackDatabase,
  type UpdateGuardianInput,
} from '@edutrack/db';
import type {
  ArchiveGuardianRequest,
  CreateGuardianRequest,
  GuardianListQuery,
  GuardianProfileResponse,
  PaginatedGuardiansResponse,
  UpdateGuardianRequest,
} from '@edutrack/shared';
import type { AuthenticatedUser, RequestAuditContext } from '../auth/index.js';
import { toGuardianResponse, toLinkResponse, toStudentResponse } from './people.mappers.js';
import { guardianNotFound, peopleForbidden } from './people.errors.js';

export interface GuardiansServiceOptions {
  now?: () => Date;
}

/**
 * Application service for tenant-scoped guardian records. Guardians have no
 * code; one guardian may be linked to several students (siblings).
 */
export class GuardiansService {
  private readonly now: () => Date;

  constructor(
    private readonly db: EduTrackDatabase,
    options: GuardiansServiceOptions = {}
  ) {
    this.now = options.now ?? (() => new Date());
  }

  list(actor: AuthenticatedUser, query: GuardianListQuery): PaginatedGuardiansResponse {
    this.assertSchoolMaster(actor);
    const repository = createGuardianRepository(this.db, createTenantContext(actor.schoolId));
    const listOptions = {
      ...(query.search !== undefined ? { search: query.search } : {}),
      ...(query.status !== undefined ? { status: query.status } : {}),
      limit: query.limit,
      offset: query.offset,
    };
    const items = repository.list(listOptions);

    return {
      items: items.map(toGuardianResponse),
      total: repository.count(listOptions),
      limit: query.limit,
      offset: query.offset,
    };
  }

  getProfile(actor: AuthenticatedUser, guardianId: string): GuardianProfileResponse {
    this.assertSchoolMaster(actor);
    const tenant = createTenantContext(actor.schoolId);
    const guardian = createGuardianRepository(this.db, tenant).findById(guardianId);

    if (!guardian) {
      throw guardianNotFound();
    }

    const students = createStudentGuardianRepository(this.db, tenant)
      .listForGuardian(guardianId)
      .flatMap((link) => {
        const student = createStudentRepository(this.db, tenant).findById(link.studentId);

        return student ? [{ link: toLinkResponse(link), student: toStudentResponse(student) }] : [];
      });

    return {
      guardian: toGuardianResponse(guardian),
      students,
    };
  }

  create(
    actor: AuthenticatedUser,
    input: CreateGuardianRequest,
    requestContext: RequestAuditContext = {}
  ) {
    this.assertSchoolMaster(actor);
    const tenant = createTenantContext(actor.schoolId);

    return withTransaction(this.db, (transaction) => {
      const guardian = createGuardianRepository(transaction, tenant).create({
        firstName: input.firstName.trim(),
        lastName: input.lastName.trim(),
        phone: input.phone ?? null,
        email: input.email ?? null,
        address: input.address ?? null,
      });

      createAuditLogRepository(transaction, tenant).createEvent({
        actorUserId: actor.id,
        action: 'GUARDIAN_CREATE',
        targetType: 'guardian',
        targetId: guardian.id,
        correlationId: requestContext.correlationId ?? null,
        metadata: { name: `${guardian.firstName} ${guardian.lastName}` },
      });

      return toGuardianResponse(guardian);
    });
  }

  update(
    actor: AuthenticatedUser,
    guardianId: string,
    input: UpdateGuardianRequest,
    requestContext: RequestAuditContext = {}
  ) {
    this.assertSchoolMaster(actor);
    const tenant = createTenantContext(actor.schoolId);
    const updatedAt = this.now().toISOString();

    return withTransaction(this.db, (transaction) => {
      const repository = createGuardianRepository(transaction, tenant);

      if (!repository.findById(guardianId)) {
        throw guardianNotFound();
      }

      const updated = repository.update(guardianId, normalizeGuardianUpdate(input), updatedAt);
      createAuditLogRepository(transaction, tenant).createEvent({
        actorUserId: actor.id,
        action: 'GUARDIAN_UPDATE',
        targetType: 'guardian',
        targetId: guardianId,
        correlationId: requestContext.correlationId ?? null,
        metadata: { updatedFields: Object.keys(input) },
      });

      return toGuardianResponse(updated);
    });
  }

  archive(
    actor: AuthenticatedUser,
    guardianId: string,
    input: ArchiveGuardianRequest,
    requestContext: RequestAuditContext = {}
  ) {
    this.assertSchoolMaster(actor);
    const tenant = createTenantContext(actor.schoolId);
    const updatedAt = this.now().toISOString();

    return withTransaction(this.db, (transaction) => {
      const repository = createGuardianRepository(transaction, tenant);

      if (!repository.findById(guardianId)) {
        throw guardianNotFound();
      }

      const archived = repository.archive(guardianId, updatedAt);
      createAuditLogRepository(transaction, tenant).createEvent({
        actorUserId: actor.id,
        action: 'GUARDIAN_ARCHIVE',
        targetType: 'guardian',
        targetId: guardianId,
        correlationId: requestContext.correlationId ?? null,
        metadata: { reason: input.reason },
      });

      return toGuardianResponse(archived);
    });
  }

  reactivate(
    actor: AuthenticatedUser,
    guardianId: string,
    input: ArchiveGuardianRequest,
    requestContext: RequestAuditContext = {}
  ) {
    this.assertSchoolMaster(actor);
    const tenant = createTenantContext(actor.schoolId);
    const updatedAt = this.now().toISOString();

    return withTransaction(this.db, (transaction) => {
      const repository = createGuardianRepository(transaction, tenant);

      if (!repository.findById(guardianId)) {
        throw guardianNotFound();
      }

      const reactivated = repository.reactivate(guardianId, updatedAt);
      createAuditLogRepository(transaction, tenant).createEvent({
        actorUserId: actor.id,
        action: 'GUARDIAN_REACTIVATE',
        targetType: 'guardian',
        targetId: guardianId,
        correlationId: requestContext.correlationId ?? null,
        metadata: { reason: input.reason },
      });

      return toGuardianResponse(reactivated);
    });
  }

  private assertSchoolMaster(actor: AuthenticatedUser) {
    if (actor.role !== 'SCHOOL_MASTER') {
      throw peopleForbidden();
    }
  }
}

function normalizeGuardianUpdate(input: UpdateGuardianRequest): UpdateGuardianInput {
  return {
    ...(input.firstName !== undefined ? { firstName: input.firstName.trim() } : {}),
    ...(input.lastName !== undefined ? { lastName: input.lastName.trim() } : {}),
    ...(input.phone !== undefined ? { phone: input.phone ?? null } : {}),
    ...(input.email !== undefined ? { email: input.email ?? null } : {}),
    ...(input.address !== undefined ? { address: input.address ?? null } : {}),
  };
}
