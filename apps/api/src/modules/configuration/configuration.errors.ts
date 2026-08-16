import type { ConfigRequirement, SchoolCapability } from '@edutrack/shared';

export type ConfigurationErrorCode =
  | 'CONFIGURATION_FAILED'
  | 'CONFIGURATION_NOT_READY'
  | 'ACADEMIC_YEAR_NOT_FOUND'
  | 'ACADEMIC_YEARS_FORBIDDEN';

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
