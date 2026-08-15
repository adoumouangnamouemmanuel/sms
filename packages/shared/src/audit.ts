import { z } from 'zod';

/**
 * Audit trail — recent tenant events for the dashboard activity timeline.
 * Read-only for the school; events are written by the application services.
 */

export const recentAuditEventSchema = z.object({
  id: z.uuid(),
  /** Stable machine action, e.g. `STUDENT_CREATE`; UI maps it to a label. */
  action: z.string().min(1),
  targetType: z.string().min(1),
  targetId: z.string().nullable(),
  /** ISO timestamp of the event. */
  occurredAt: z.string().min(1),
  /** Username of the actor, null for system-originated events. */
  actorUsername: z.string().nullable(),
});

export const recentAuditEventsResponseSchema = z.object({
  items: z.array(recentAuditEventSchema),
  total: z.number().int().min(0),
});

export type RecentAuditEvent = z.infer<typeof recentAuditEventSchema>;
export type RecentAuditEventsResponse = z.infer<typeof recentAuditEventsResponseSchema>;
