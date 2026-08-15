export class TeachersApiError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: number
  ) {
    super(message);
    this.name = 'TeachersApiError';
  }
}

const TEACHERS_API_ERROR_MESSAGE_KEYS = {
  FORBIDDEN: 'teachers.errors.forbidden',
  INVALID_ACCESS_TOKEN: 'teachers.errors.sessionExpired',
  LOCAL_SERVICE_UNAVAILABLE: 'teachers.errors.localService',
  SCHOOL_NOT_FOUND: 'teachers.errors.generic',
  TEACHER_CODE_EXISTS: 'teachers.errors.codeExists',
  TEACHER_LOGIN_EXISTS: 'teachers.errors.loginExists',
  TEACHER_LOGIN_NOT_FOUND: 'teachers.errors.generic',
  TEACHER_LOGIN_REQUIRES_ACTIVE_RECORD: 'teachers.errors.loginRequiresActiveRecord',
  TEACHER_NOT_FOUND: 'teachers.errors.notFound',
  TEACHER_VERSION_CONFLICT: 'teachers.errors.versionConflict',
  VALIDATION_ERROR: 'teachers.errors.validation',
} as const;

type TeachersApiErrorCode = keyof typeof TEACHERS_API_ERROR_MESSAGE_KEYS;

export function resolveTeachersErrorMessageKey(error: unknown) {
  if (error instanceof TeachersApiError && isKnownTeachersApiErrorCode(error.code)) {
    return TEACHERS_API_ERROR_MESSAGE_KEYS[error.code];
  }

  return 'teachers.errors.generic';
}

function isKnownTeachersApiErrorCode(code: string): code is TeachersApiErrorCode {
  return code in TEACHERS_API_ERROR_MESSAGE_KEYS;
}
