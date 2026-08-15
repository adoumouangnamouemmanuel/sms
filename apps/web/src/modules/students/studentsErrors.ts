export class StudentsApiError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: number
  ) {
    super(message);
    this.name = 'StudentsApiError';
  }
}

const STUDENTS_API_ERROR_MESSAGE_KEYS = {
  FORBIDDEN: 'students.errors.forbidden',
  GUARDIAN_NOT_FOUND: 'students.errors.notFound',
  INVALID_ACCESS_TOKEN: 'students.errors.sessionExpired',
  LINK_NOT_FOUND: 'students.errors.notFound',
  LOCAL_SERVICE_UNAVAILABLE: 'students.errors.localService',
  SCHOOL_NOT_FOUND: 'students.errors.generic',
  STUDENT_CODE_EXISTS: 'students.errors.codeExists',
  STUDENT_GUARDIAN_LINK_EXISTS: 'students.errors.linkExists',
  STUDENT_NOT_FOUND: 'students.errors.notFound',
  VALIDATION_ERROR: 'students.errors.validation',
} as const;

type StudentsApiErrorCode = keyof typeof STUDENTS_API_ERROR_MESSAGE_KEYS;

export function resolveStudentsErrorMessageKey(error: unknown) {
  if (error instanceof StudentsApiError && isKnownStudentsApiErrorCode(error.code)) {
    return STUDENTS_API_ERROR_MESSAGE_KEYS[error.code];
  }

  return 'students.errors.generic';
}

function isKnownStudentsApiErrorCode(code: string): code is StudentsApiErrorCode {
  return code in STUDENTS_API_ERROR_MESSAGE_KEYS;
}
