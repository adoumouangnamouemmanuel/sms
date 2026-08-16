import type { ConfigRequirement, SchoolCapability } from '@edutrack/shared';

export type ConfigurationErrorCode =
  | 'CONFIGURATION_FAILED'
  | 'CONFIGURATION_NOT_READY'
  | 'ACADEMIC_YEAR_NOT_FOUND'
  | 'ACADEMIC_YEARS_FORBIDDEN'
  | 'ACADEMIC_YEAR_INVALID_TRANSITION'
  | 'GRADING_POLICY_NOT_FOUND'
  | 'GRADING_POLICY_FORBIDDEN'
  | 'GRADING_POLICY_INVALID'
  | 'GRADING_POLICY_IMMUTABLE'
  | 'GRADING_POLICY_SCOPE_CONFLICT'
  | 'GRADING_POLICY_INVALID_TRANSITION'
  | 'APPRECIATION_NOT_FOUND'
  | 'APPRECIATION_FORBIDDEN'
  | 'APPRECIATION_INVALID'
  | 'APPRECIATION_IMMUTABLE';

/** Public-safe configuration error with a stable API code. */
export class ConfigurationServiceError extends Error {
  constructor(
    readonly code: ConfigurationErrorCode,
    readonly statusCode: number,
    readonly publicMessage: string,
    readonly fields?: Record<string, string | string[]>
  ) {
    super(publicMessage);
    this.name = 'ConfigurationServiceError';
  }
}

export function configurationFailed() {
  return new ConfigurationServiceError(
    'CONFIGURATION_FAILED',
    500,
    'La configuration est temporairement indisponible. Réessayez.'
  );
}

/**
 * Backend capability gate rejection (design §23): the school's configuration
 * does not yet allow the requested operation, and the missing requirements
 * are returned so the UI can guide the SchoolMaster precisely.
 */ export function configurationNotReady(
  capability: SchoolCapability,
  missing: ConfigRequirement[]
) {
  return new ConfigurationServiceError(
    'CONFIGURATION_NOT_READY',
    409,
    'La configuration de l\u2019école ne permet pas encore cette opération.',
    {
      capability,
      missing,
    }
  );
}

export function academicYearNotFound() {
  return new ConfigurationServiceError(
    'ACADEMIC_YEAR_NOT_FOUND',
    404,
    'Année scolaire introuvable.'
  );
}

export function academicYearsForbidden() {
  return new ConfigurationServiceError(
    'ACADEMIC_YEARS_FORBIDDEN',
    403,
    "La gestion des années scolaires est réservée au chef d'établissement."
  );
}

export function academicYearInvalidTransition() {
  return new ConfigurationServiceError(
    'ACADEMIC_YEAR_INVALID_TRANSITION',
    400,
    "Le changement de statut demandé n'est pas autorisé pour cette année scolaire."
  );
}

export function gradingPolicyNotFound() {
  return new ConfigurationServiceError(
    'GRADING_POLICY_NOT_FOUND',
    404,
    'Politique de notation introuvable.'
  );
}

export function gradingPolicyForbidden() {
  return new ConfigurationServiceError(
    'GRADING_POLICY_FORBIDDEN',
    403,
    "La configuration de la notation est réservée au chef d'établissement."
  );
}

/** Publish/scope validation failures - carries the per-issue fields. */
export function gradingPolicyInvalid(issues: { code: string; message: string }[]) {
  const fields: Record<string, string | string[]> = {};
  for (const issue of issues) {
    fields[issue.code] = issue.message;
  }

  return new ConfigurationServiceError(
    'GRADING_POLICY_INVALID',
    422,
    'La politique de notation ne peut pas être publiée : corrigez les erreurs signalées.',
    fields
  );
}

export function gradingPolicyImmutable() {
  return new ConfigurationServiceError(
    'GRADING_POLICY_IMMUTABLE',
    409,
    'Une politique publiée est immuable. Créez une nouvelle version pour la modifier.'
  );
}

export function gradingPolicyScopeConflict() {
  return new ConfigurationServiceError(
    'GRADING_POLICY_SCOPE_CONFLICT',
    409,
    'Un autre niveau ou matière utilise déjà une politique publiée sur ce périmètre.'
  );
}

export function gradingPolicyInvalidTransition() {
  return new ConfigurationServiceError(
    'GRADING_POLICY_INVALID_TRANSITION',
    400,
    "Le changement de statut demandé n'est pas autorisé pour cette politique."
  );
}

export function appreciationNotFound() {
  return new ConfigurationServiceError(
    'APPRECIATION_NOT_FOUND',
    404,
    'Échelle d\u2019appréciation introuvable.'
  );
}

export function appreciationForbidden() {
  return new ConfigurationServiceError(
    'APPRECIATION_FORBIDDEN',
    403,
    "La configuration des appréciations est réservée au chef d'établissement."
  );
}

export function appreciationInvalid(issues: { code: string; message: string }[]) {
  const fields: Record<string, string | string[]> = {};
  for (const issue of issues) {
    fields[issue.code] = issue.message;
  }

  return new ConfigurationServiceError(
    'APPRECIATION_INVALID',
    422,
    'L\u2019échelle d\u2019appréciation est invalide : corrigez les erreurs signalées.',
    fields
  );
}

export function appreciationImmutable() {
  return new ConfigurationServiceError(
    'APPRECIATION_IMMUTABLE',
    409,
    'Une échelle publiée est immuable. Créez une nouvelle version pour la modifier.'
  );
}
