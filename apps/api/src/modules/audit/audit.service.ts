import { createAuditLogRepository, createTenantContext, type EduTrackDatabase } from '@edutrack/db';
import type { RecentAuditEvent, RecentAuditEventsResponse } from '@edutrack/shared';
import type { AuthenticatedUser } from '../auth/index.js';

const MAX_RECENT_EVENTS = 20;

/**
 * Read-only access to the tenant audit trail. The dashboard's activity
 * timeline is backed by these real events - never simulated data.
 */
export class AuditService {
  constructor(private readonly db: EduTrackDatabase) {}

  listRecent(actor: AuthenticatedUser, limit: number): RecentAuditEventsResponse {
    const tenant = createTenantContext(actor.schoolId);
    const repository = createAuditLogRepository(this.db, tenant);
    const items = repository.listRecent(Math.min(Math.max(limit, 1), MAX_RECENT_EVENTS));

    return {
      items: items.map(toRecentAuditEvent),
      total: items.length,
    };
  }
}

function toRecentAuditEvent(event: {
  id: string;
  action: string;
  targetType: string;
  targetId: string | null;
  occurredAt: string;
  actorUsername: string | null;
}): RecentAuditEvent {
  return {
    id: event.id,
    action: event.action,
    targetType: event.targetType,
    targetId: event.targetId,
    occurredAt: event.occurredAt,
    actorUsername: event.actorUsername,
  };
}
