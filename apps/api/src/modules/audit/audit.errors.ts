export type AuditErrorCode = 'AUDIT_FAILED';

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
