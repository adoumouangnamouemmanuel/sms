export type SetupErrorCode =
  | 'CLASS_LEVELS_REQUIRED'
  | 'FORBIDDEN'
  | 'INVALID_ACADEMIC_YEAR'
  | 'INVALID_CLASS_LEVELS'
  | 'INVALID_SETUP_STEP'
  | 'INVALID_TERMS'
  | 'MODULE_STEP_DATA_REQUIRED'
  | 'SCHOOL_NOT_FOUND'
  | 'SETUP_FAILED';

/** Public-safe setup error with a stable API code. */
export class SetupServiceError extends Error {
  constructor(
    readonly code: SetupErrorCode,
    readonly statusCode: number,
    readonly publicMessage: string,
    readonly fields?: Record<string, string | string[]>
  ) {
    super(publicMessage);
    this.name = 'SetupServiceError';
  }
}

export function setupForbidden() {
  return new SetupServiceError('FORBIDDEN', 403, "Vous n'etes pas autorise a configurer l'ecole.");
}

export function schoolNotFound() {
  return new SetupServiceError('SCHOOL_NOT_FOUND', 404, 'Ecole introuvable.');
}

export function invalidAcademicYear(message = "L'annee scolaire est invalide.") {
  return new SetupServiceError('INVALID_ACADEMIC_YEAR', 400, message);
}

export function invalidTerms(message = 'Les periodes scolaires sont invalides.') {
  return new SetupServiceError('INVALID_TERMS', 400, message);
}

export function invalidClassLevels(message = 'Les niveaux de classe sont invalides.') {
  return new SetupServiceError('INVALID_CLASS_LEVELS', 400, message);
}

export function invalidSetupStep(message = "L'etape precedente doit etre enregistree.") {
  return new SetupServiceError('INVALID_SETUP_STEP', 409, message);
}

export function classLevelsRequired() {
  return new SetupServiceError(
    'CLASS_LEVELS_REQUIRED',
    409,
    'Ajoutez au moins un niveau de classe avant de terminer la configuration.'
  );
}

export function moduleStepDataRequired(step: string) {
  // The public message stays generic; clients localize the actionable text
  // via the stable code + step, never by parsing raw French.
  return new SetupServiceError(
    'MODULE_STEP_DATA_REQUIRED',
    409,
    'Complétez cette étape avant de continuer.',
    { step }
  );
}
