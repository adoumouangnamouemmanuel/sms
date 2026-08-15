export type PeopleErrorCode =
  | 'FORBIDDEN'
  | 'GUARDIAN_NOT_FOUND'
  | 'LINK_NOT_FOUND'
  | 'SCHOOL_NOT_FOUND'
  | 'STUDENT_CODE_EXISTS'
  | 'STUDENT_GUARDIAN_LINK_EXISTS'
  | 'STUDENT_NOT_FOUND'
  | 'PEOPLE_FAILED';

/** Public-safe people error with a stable API code. */
export class PeopleServiceError extends Error {
  constructor(
    readonly code: PeopleErrorCode,
    readonly statusCode: number,
    readonly publicMessage: string
  ) {
    super(publicMessage);
    this.name = 'PeopleServiceError';
  }
}

export function peopleForbidden() {
  return new PeopleServiceError(
    'FORBIDDEN',
    403,
    "Vous n'etes pas autorise a gerer les eleves et les responsables."
  );
}

export function schoolNotFound() {
  return new PeopleServiceError('SCHOOL_NOT_FOUND', 404, 'Ecole introuvable.');
}

export function studentNotFound() {
  return new PeopleServiceError('STUDENT_NOT_FOUND', 404, 'Eleve introuvable.');
}

export function guardianNotFound() {
  return new PeopleServiceError('GUARDIAN_NOT_FOUND', 404, 'Responsable introuvable.');
}

export function studentGuardianLinkNotFound() {
  return new PeopleServiceError('LINK_NOT_FOUND', 404, 'Lien eleve-responsable introuvable.');
}

export function studentCodeAlreadyExists() {
  return new PeopleServiceError(
    'STUDENT_CODE_EXISTS',
    409,
    'Un eleve avec ce code existe deja. Les codes ne sont jamais reutilises.'
  );
}

export function studentGuardianLinkAlreadyExists() {
  return new PeopleServiceError(
    'STUDENT_GUARDIAN_LINK_EXISTS',
    409,
    'Ce responsable est deja lie a cet eleve.'
  );
}
