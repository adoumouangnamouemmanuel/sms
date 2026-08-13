import { hashOptional } from './auth.crypto.js';
import type { RequestAuditContext } from './auth.types.js';

export function successMetadata(
  context: RequestAuditContext,
  extra: Record<string, unknown> | undefined = {}
) {
  return {
    ...extra,
    userAgentHash: hashOptional(context.userAgent),
  };
}

export function failureMetadata(
  reason: string,
  context: RequestAuditContext,
  extra: Record<string, unknown> = {}
) {
  return {
    ...successMetadata(context, extra),
    reason,
  };
}
