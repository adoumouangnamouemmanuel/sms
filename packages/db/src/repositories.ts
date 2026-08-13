import { and, eq, isNull } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import type { EduTrackDatabase } from './client';
import { auditLog, type AuditOutcome, user, type UserRole } from './schema.sqlite';

export interface TenantContext {
  schoolId: string;
}

export interface CreateAuditLogInput {
  id?: string;
  actorUserId?: string | null;
  action: string;
  targetType: string;
  targetId?: string | null;
  correlationId?: string | null;
  metadata?: Record<string, unknown>;
  outcome?: AuditOutcome;
}

export interface CreateUserInput {
  id?: string;
  username: string;
  passwordHash: string;
  role: UserRole;
}

export function createTenantContext(schoolId: string): TenantContext {
  if (!schoolId.trim()) {
    throw new Error('Tenant context requires a non-empty schoolId.');
  }

  return { schoolId };
}

export class TenantScopedRepository {
  protected readonly schoolId: string;

  constructor(
    protected readonly db: EduTrackDatabase,
    tenant: TenantContext
  ) {
    this.schoolId = createTenantContext(tenant.schoolId).schoolId;
  }
}

export class UserRepository extends TenantScopedRepository {
  listActiveUsers() {
    return this.db
      .select()
      .from(user)
      .where(and(eq(user.schoolId, this.schoolId), eq(user.isActive, true), isNull(user.deletedAt)))
      .all();
  }

  findActiveByUsername(username: string) {
    return this.db
      .select()
      .from(user)
      .where(
        and(
          eq(user.schoolId, this.schoolId),
          eq(user.username, username),
          eq(user.isActive, true),
          isNull(user.deletedAt)
        )
      )
      .get();
  }

  createUser(input: CreateUserInput) {
    const createdUser = this.db
      .insert(user)
      .values({
        id: input.id ?? randomUUID(),
        schoolId: this.schoolId,
        username: input.username,
        passwordHash: input.passwordHash,
        role: input.role,
      })
      .returning()
      .get();

    return createdUser;
  }
}

export class AuditLogRepository extends TenantScopedRepository {
  createEvent(input: CreateAuditLogInput) {
    const createdEvent = this.db
      .insert(auditLog)
      .values({
        id: input.id ?? randomUUID(),
        schoolId: this.schoolId,
        actorUserId: input.actorUserId ?? null,
        action: input.action,
        targetType: input.targetType,
        targetId: input.targetId ?? null,
        correlationId: input.correlationId ?? null,
        metadataJson: JSON.stringify(input.metadata ?? {}),
        outcome: input.outcome ?? 'SUCCESS',
      })
      .returning()
      .get();

    return createdEvent;
  }
}

export function createUserRepository(db: EduTrackDatabase, tenant: TenantContext) {
  return new UserRepository(db, tenant);
}

export function createAuditLogRepository(db: EduTrackDatabase, tenant: TenantContext) {
  return new AuditLogRepository(db, tenant);
}
