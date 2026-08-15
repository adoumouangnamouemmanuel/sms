export type ImportsErrorCode =
  | 'EMPTY_IMPORT_FILE'
  | 'FORBIDDEN'
  | 'IMPORT_FILE_INVALID'
  | 'IMPORT_FILE_TOO_LARGE'
  | 'IMPORT_ID_NOT_FOUND'
  | 'IMPORT_IDENTIFIER_INVALID'
  | 'IMPORTS_FAILED';

/** Public-safe imports error with a stable API code. */
export class ImportsServiceError extends Error {
  constructor(
    readonly code: ImportsErrorCode,
    readonly statusCode: number,
    readonly publicMessage: string
  ) {
    super(publicMessage);
    this.name = 'ImportsServiceError';
  }
}

export function importsForbidden() {
  return new ImportsServiceError(
    'FORBIDDEN',
    403,
    "Vous n'etes pas autorise a importer des dossiers."
  );
}

export function invalidImportFile(detail: string) {
  return new ImportsServiceError('IMPORT_FILE_INVALID', 400, detail);
}

export function emptyImportFile() {
  return new ImportsServiceError(
    'EMPTY_IMPORT_FILE',
    400,
    'Le fichier ne contient aucune ligne de donnees a importer.'
  );
}

export function importFileTooLarge() {
  return new ImportsServiceError(
    'IMPORT_FILE_TOO_LARGE',
    413,
    'Le fichier depasse la taille maximale autorisee (10 Mo).'
  );
}

export function importPreviewNotFound() {
  return new ImportsServiceError(
    'IMPORT_ID_NOT_FOUND',
    404,
    "L'apercu de l'import n'est plus disponible. Reprenez l'analyse du fichier."
  );
}

export function invalidImportIdentifier() {
  return new ImportsServiceError(
    'IMPORT_IDENTIFIER_INVALID',
    400,
    "L'identifiant d'import est invalide (1 a 80 caracteres)."
  );
}
