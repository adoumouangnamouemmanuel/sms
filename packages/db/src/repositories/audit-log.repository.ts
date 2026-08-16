import { randomUUID } from 'node:crypto';
import { asc, desc, eq } from 'drizzle-orm';
import type { RepositoryExecutor, TenantContext } from './base.js';
import { TenantScopedRepository } from './base.js';
import { auditLog, user, type AuditOutcome } from '../schema.sqlite.js';

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

/** Writes append-only, tenant-scoped audit events with defensive metadata JSON. */
export class AuditLogRepository extends TenantScopedRepository {
  createEvent(input: CreateAuditLogInput) {
    return this.db
      .insert(auditLog)
      .values({
        id: input.id ?? randomUUID(),
        schoolId: this.schoolId,
        actorUserId: input.actorUserId ?? null,
        action: input.action,
        targetType: input.targetType,
        targetId: input.targetId ?? null,
        correlationId: input.correlationId ?? null,
        metadataJson: serializeAuditMetadata(input.metadata),
        outcome: input.outcome ?? 'SUCCESS',
      })
      .returning()
      .get();
  }

  /** Latest tenant events for the dashboard activity timeline, newest first. */
  listRecent(limit: number) {
    return this.db
      .select({
        id: auditLog.id,
        action: auditLog.action,
        targetType: auditLog.targetType,
        targetId: auditLog.targetId,
        occurredAt: auditLog.occurredAt,
        actorUsername: user.username,
      })
      .from(auditLog)
      .leftJoin(user, eq(user.id, auditLog.actorUserId))
      .where(eq(auditLog.schoolId, this.schoolId))
      .orderBy(desc(auditLog.occurredAt), asc(auditLog.id))
      .limit(limit)
      .all();
  }
}

export function createAuditLogRepository(db: RepositoryExecutor, tenant: TenantContext) {
  return new AuditLogRepository(db, tenant);
}

function serializeAuditMetadata(metadata: Record<string, unknown> | undefined) {
  const seen = new WeakSet();

  try {
    return JSON.stringify(metadata ?? {}, (_key: string, value: unknown) => {
      if (typeof value === 'bigint') {
        return value.toString();
      }

      if (typeof value === 'object' && value !== null) {
        if (seen.has(value)) {
          return '[Circular]';
        }

        seen.add(value);
      }

      return value;
    });
  } catch {
    return JSON.stringify({ serialization: 'failed' });
  }
}
