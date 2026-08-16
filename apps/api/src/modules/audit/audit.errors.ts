export type AuditErrorCode = 'AUDIT_FAILED' | 'AUDIT_FORBIDDEN';

/** Public-safe audit error with a stable API code. */
export class AuditServiceError extends Error {
  constructor(
    readonly code: AuditErrorCode,
    readonly statusCode: number,
    readonly publicMessage: string
  ) {
    super(publicMessage);
    this.name = 'AuditServiceError';
  }
}

export function auditFailed() {
  return new AuditServiceError(
    'AUDIT_FAILED',
    500,
    "Le journal d'activite est temporairement indisponible."
  );
}

export function auditForbidden() {
  return new AuditServiceError(
    'AUDIT_FORBIDDEN',
    403,
    "L'accès au journal d'activité est réservé au chef d'établissement."
  );
}
