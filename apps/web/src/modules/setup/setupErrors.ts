export class SetupApiError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: number
  ) {
    super(message);
    this.name = 'SetupApiError';
  }
}

const SETUP_API_ERROR_MESSAGE_KEYS = {
  CLASS_LEVELS_REQUIRED: 'setup.errors.invalidClassLevels',
  FORBIDDEN: 'setup.errors.forbidden',
  INVALID_ACCESS_TOKEN: 'setup.errors.sessionExpired',
  INVALID_ACADEMIC_YEAR: 'setup.errors.invalidAcademicYear',
  INVALID_CLASS_LEVELS: 'setup.errors.invalidClassLevels',
  INVALID_SETUP_STEP: 'setup.errors.invalidStep',
  INVALID_TERMS: 'setup.errors.invalidTerms',
  LOCAL_SERVICE_UNAVAILABLE: 'setup.errors.localService',
  MODULE_STEP_DATA_REQUIRED: 'setup.errors.moduleStepData',
  SCHOOL_NOT_FOUND: 'setup.errors.generic',
  VALIDATION_ERROR: 'setup.errors.validation',
} as const;

type SetupApiErrorCode = keyof typeof SETUP_API_ERROR_MESSAGE_KEYS;

export function resolveSetupErrorMessageKey(error: unknown) {
  if (error instanceof SetupApiError && isKnownSetupApiErrorCode(error.code)) {
    return SETUP_API_ERROR_MESSAGE_KEYS[error.code];
  }

  return 'setup.errors.generic';
}

function isKnownSetupApiErrorCode(code: string): code is SetupApiErrorCode {
  return code in SETUP_API_ERROR_MESSAGE_KEYS;
}
