export type ClassesErrorCode =
  | 'ACADEMIC_YEAR_NOT_FOUND'
  | 'CAPACITY_EXCEEDED'
  | 'CLASSROOM_CODE_EXISTS'
  | 'CLASSROOM_NOT_FOUND'
  | 'CLASS_SUBJECT_NOT_FOUND'
  | 'CLASS_SUBJECT_PAIR_EXISTS'
  | 'CLASS_SUBJECT_REQUIRED_LINK'
  | 'CLASS_LEVEL_NOT_FOUND'
  | 'ENROLLMENT_NOT_FOUND'
  | 'FORBIDDEN'
  | 'STUDENT_NOT_FOUND'
  | 'STUDENT_ALREADY_ENROLLED'
  | 'SUBJECT_CODE_EXISTS'
  | 'SUBJECT_NOT_FOUND'
  | 'TEACHER_NOT_FOUND'
  | 'TRANSFER_SAME_CLASSROOM'
  | 'VERSION_CONFLICT'
  | 'CLASSES_FAILED';

/** Public-safe classes error with a stable API code. */
export class ClassesServiceError extends Error {
  constructor(
    readonly code: ClassesErrorCode,
    readonly statusCode: number,
    readonly publicMessage: string
  ) {
    super(publicMessage);
    this.name = 'ClassesServiceError';
  }
}

export function classesForbidden() {
  return new ClassesServiceError(
    'FORBIDDEN',
    403,
    "Vous n'êtes pas autorisé à gérer les classes et le curriculum."
  );
}

export function academicYearNotFound() {
  return new ClassesServiceError('ACADEMIC_YEAR_NOT_FOUND', 404, 'Année scolaire introuvable.');
}

export function subjectNotFound() {
  return new ClassesServiceError('SUBJECT_NOT_FOUND', 404, 'Matière introuvable.');
}

export function subjectCodeAlreadyExists() {
  return new ClassesServiceError(
    'SUBJECT_CODE_EXISTS',
    409,
    'Une matière avec ce code existe déjà. Les codes ne sont jamais réutilisés.'
  );
}

export function classroomNotFound() {
  return new ClassesServiceError('CLASSROOM_NOT_FOUND', 404, 'Classe introuvable.');
}

export function classroomCodeAlreadyExists() {
  return new ClassesServiceError(
    'CLASSROOM_CODE_EXISTS',
    409,
    'Une classe avec ce code existe déjà pour cette année scolaire.'
  );
}

export function classSubjectNotFound() {
  return new ClassesServiceError(
    'CLASS_SUBJECT_NOT_FOUND',
    404,
    'Affectation matière-classe introuvable.'
  );
}

export function classSubjectPairAlreadyExists() {
  return new ClassesServiceError(
    'CLASS_SUBJECT_PAIR_EXISTS',
    409,
    'Cette matière est déjà affectée à cette classe.'
  );
}

export function classSubjectRequiredLink() {
  return new ClassesServiceError(
    'CLASS_SUBJECT_REQUIRED_LINK',
    409,
    'Les matières obligatoires sont automatiquement affectées aux élèves de la classe.'
  );
}

export function classLevelNotFound() {
  return new ClassesServiceError('CLASS_LEVEL_NOT_FOUND', 404, 'Niveau introuvable.');
}

export function teacherNotFound() {
  return new ClassesServiceError('TEACHER_NOT_FOUND', 404, 'Professeur introuvable.');
}

export function studentNotFound() {
  return new ClassesServiceError('STUDENT_NOT_FOUND', 404, 'Élève introuvable.');
}

export function studentAlreadyEnrolled() {
  return new ClassesServiceError(
    'STUDENT_ALREADY_ENROLLED',
    409,
    'Cet élève est déjà inscrit dans une classe pour cette année scolaire.'
  );
}

export function capacityExceeded() {
  return new ClassesServiceError(
    'CAPACITY_EXCEEDED',
    409,
    'La capacité maximale de la classe serait dépassée.'
  );
}

export function enrollmentNotFound() {
  return new ClassesServiceError('ENROLLMENT_NOT_FOUND', 404, 'Inscription introuvable.');
}

export function transferSameClassroom() {
  return new ClassesServiceError(
    'TRANSFER_SAME_CLASSROOM',
    409,
    "L'élève est déjà inscrit dans cette classe."
  );
}

export function versionConflict() {
  return new ClassesServiceError(
    'VERSION_CONFLICT',
    409,
    'Ce dossier a été modifié depuis votre dernière consultation. Rechargez-le avant de réessayer.'
  );
}
