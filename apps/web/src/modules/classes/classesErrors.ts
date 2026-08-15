export class ClassesApiError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: number
  ) {
    super(message);
    this.name = 'ClassesApiError';
  }
}

const CLASSES_API_ERROR_MESSAGE_KEYS = {
  ACADEMIC_YEAR_NOT_FOUND: 'classes.errors.generic',
  CAPACITY_EXCEEDED: 'classes.errors.capacityExceeded',
  CLASSROOM_CODE_EXISTS: 'classes.errors.classroomCodeExists',
  CLASSROOM_NOT_FOUND: 'classes.errors.classroomNotFound',
  CLASS_SUBJECT_NOT_FOUND: 'classes.errors.generic',
  CLASS_SUBJECT_PAIR_EXISTS: 'classes.errors.classSubjectPairExists',
  CLASS_SUBJECT_REQUIRED_LINK: 'classes.errors.classSubjectRequiredLink',
  ENROLLMENT_NOT_FOUND: 'classes.errors.enrollmentNotFound',
  FORBIDDEN: 'classes.errors.forbidden',
  STUDENT_ALREADY_ENROLLED: 'classes.errors.studentAlreadyEnrolled',
  STUDENT_NOT_FOUND: 'classes.errors.studentNotFound',
  SUBJECT_CODE_EXISTS: 'classes.errors.subjectCodeExists',
  SUBJECT_NOT_FOUND: 'classes.errors.subjectNotFound',
  TEACHER_NOT_FOUND: 'classes.errors.teacherNotFound',
  VERSION_CONFLICT: 'classes.errors.versionConflict',
  INVALID_ACCESS_TOKEN: 'classes.errors.sessionExpired',
  LOCAL_SERVICE_UNAVAILABLE: 'classes.errors.localService',
  VALIDATION_ERROR: 'classes.errors.validation',
} as const;

type ClassesApiErrorCode = keyof typeof CLASSES_API_ERROR_MESSAGE_KEYS;

export function resolveClassesErrorMessageKey(error: unknown) {
  if (error instanceof ClassesApiError && isKnownClassesApiErrorCode(error.code)) {
    return CLASSES_API_ERROR_MESSAGE_KEYS[error.code];
  }

  return 'classes.errors.generic';
}

function isKnownClassesApiErrorCode(code: string): code is ClassesApiErrorCode {
  return code in CLASSES_API_ERROR_MESSAGE_KEYS;
}
