export class ImportsApiError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: number
  ) {
    super(message);
    this.name = 'ImportsApiError';
  }
}

const IMPORTS_API_ERROR_MESSAGE_KEYS = {
  EMPTY_IMPORT_FILE: 'imports.errors.emptyFile',
  FORBIDDEN: 'imports.errors.forbidden',
  IMPORT_FILE_INVALID: 'imports.errors.invalidFile',
  IMPORT_FILE_TOO_LARGE: 'imports.errors.fileTooLarge',
  IMPORT_ID_NOT_FOUND: 'imports.errors.previewExpired',
  IMPORT_IDENTIFIER_INVALID: 'imports.errors.invalidIdentifier',
  IMPORTS_FAILED: 'imports.errors.generic',
  INVALID_ACCESS_TOKEN: 'imports.errors.sessionExpired',
  LOCAL_SERVICE_UNAVAILABLE: 'imports.errors.localService',
  REQUEST_REJECTED: 'imports.errors.generic',
  VALIDATION_ERROR: 'imports.errors.validation',
} as const;

type ImportsApiErrorCode = keyof typeof IMPORTS_API_ERROR_MESSAGE_KEYS;

export function resolveImportsErrorMessageKey(error: unknown) {
  if (error instanceof ImportsApiError && isKnownImportsApiErrorCode(error.code)) {
    return IMPORTS_API_ERROR_MESSAGE_KEYS[error.code];
  }

  return 'imports.errors.generic';
}

function isKnownImportsApiErrorCode(code: string): code is ImportsApiErrorCode {
  return code in IMPORTS_API_ERROR_MESSAGE_KEYS;
}
