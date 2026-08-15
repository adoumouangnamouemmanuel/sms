import {
  SIDECAR_CAPABILITY_HEADER,
  type ConfirmImportRequest,
  type ConfirmImportResponse,
  type ImportKind,
  type ImportPreviewResponse,
} from '@edutrack/shared';
import { createAuthHeaders } from '../auth';
import { ImportsApiError } from './importsErrors';

type Fetcher = typeof fetch;

export interface ImportsRequestOptions {
  capabilityToken?: string;
  fetcher?: Fetcher;
}

/** Uploads an .xlsx file and returns the in-memory preview (nothing is persisted). */
export async function previewImport(
  apiBaseUrl: string,
  kind: ImportKind,
  file: File,
  options: ImportsRequestOptions = {}
) {
  const form = new FormData();
  form.append('file', file);

  const fetcher = options.fetcher ?? fetch;
  let response: Response;

  try {
    response = await fetcher(`${apiBaseUrl}/imports/preview/${kind}`, {
      method: 'POST',
      credentials: 'include',
      // No Content-Type header: the browser sets the multipart boundary.
      headers: {
        ...createAuthHeaders(),
        ...createSidecarHeaders(options.capabilityToken),
      },
      body: form,
    });
  } catch {
    throw new ImportsApiError('LOCAL_SERVICE_UNAVAILABLE', 'Local service unavailable.', 0);
  }

  return requestJson<ImportPreviewResponse>(response);
}

export async function confirmImport(
  apiBaseUrl: string,
  input: ConfirmImportRequest,
  options: ImportsRequestOptions = {}
) {
  const fetcher = options.fetcher ?? fetch;
  let response: Response;

  try {
    response = await fetcher(`${apiBaseUrl}/imports/confirm`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...createAuthHeaders(),
        ...createSidecarHeaders(options.capabilityToken),
      },
      body: JSON.stringify(input),
    });
  } catch {
    throw new ImportsApiError('LOCAL_SERVICE_UNAVAILABLE', 'Local service unavailable.', 0);
  }

  return requestJson<ConfirmImportResponse>(response);
}

/** Downloads the French .xlsx template for the given kind as a Blob. */
export async function downloadTemplate(
  apiBaseUrl: string,
  kind: ImportKind,
  options: ImportsRequestOptions = {}
) {
  return downloadBlob(`${apiBaseUrl}/imports/templates/${kind}`, options);
}

/** Downloads the rejected-rows CSV for a preview as a Blob. */
export async function downloadErrorsCsv(
  apiBaseUrl: string,
  importId: string,
  options: ImportsRequestOptions = {}
) {
  return downloadBlob(`${apiBaseUrl}/imports/errors/${importId}`, options);
}

// ---------------------------------------------------------------------------
// Shared request plumbing
// ---------------------------------------------------------------------------

async function downloadBlob(url: string, options: ImportsRequestOptions) {
  const fetcher = options.fetcher ?? fetch;
  let response: Response;

  try {
    response = await fetcher(url, {
      method: 'GET',
      credentials: 'include',
      headers: {
        ...createAuthHeaders(),
        ...createSidecarHeaders(options.capabilityToken),
      },
    });
  } catch {
    throw new ImportsApiError('LOCAL_SERVICE_UNAVAILABLE', 'Local service unavailable.', 0);
  }

  if (!response.ok) {
    throw new ImportsApiError(
      'REQUEST_REJECTED',
      'La requete locale a ete refusee.',
      response.status
    );
  }

  return response.blob();
}

async function requestJson<T>(response: Response) {
  let payload: ApiResponse<T> | ApiErrorResponse;

  try {
    payload = (await response.json()) as ApiResponse<T> | ApiErrorResponse;
  } catch {
    throw new ImportsApiError(
      'LOCAL_SERVICE_UNAVAILABLE',
      'Local service returned an unreadable response.',
      response.status
    );
  }

  if (!response.ok || !payload.success) {
    throw new ImportsApiError(
      payload.success ? 'REQUEST_REJECTED' : payload.error.code,
      payload.success ? 'Requete locale refusee.' : payload.error.message,
      response.status
    );
  }

  return payload.data;
}

function createSidecarHeaders(capabilityToken: string | undefined): Record<string, string> {
  return capabilityToken ? { [SIDECAR_CAPABILITY_HEADER]: capabilityToken } : {};
}

interface ApiResponse<T> {
  success: true;
  data: T;
}

interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
  };
}
