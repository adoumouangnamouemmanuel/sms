import type {
  ConfirmImportRequest,
  ConfirmImportResponse,
  ImportKind,
  ImportPreviewResponse,
} from '@edutrack/shared';
import { useCallback, useState } from 'react';
import {
  confirmImport as confirmImportRequest,
  downloadErrorsCsv as downloadErrorsCsvRequest,
  downloadTemplate as downloadTemplateRequest,
  previewImport as previewImportRequest,
  type ImportsRequestOptions,
} from './importsApi';
import { ImportsApiError, resolveImportsErrorMessageKey } from './importsErrors';

export interface ImportsClient {
  confirmImport(
    input: ConfirmImportRequest,
    options?: ImportsRequestOptions
  ): Promise<ConfirmImportResponse>;
  downloadErrorsCsv(importId: string, options?: ImportsRequestOptions): Promise<Blob>;
  downloadTemplate(kind: ImportKind, options?: ImportsRequestOptions): Promise<Blob>;
  previewImport(
    kind: ImportKind,
    file: File,
    options?: ImportsRequestOptions
  ): Promise<ImportPreviewResponse>;
}

export interface UseImportStateOptions {
  apiBaseUrl: string | null;
  capabilityToken?: string;
  client?: ImportsClient;
}

export type ImportStep = 'choose' | 'preview' | 'report';

export function useImportState({ apiBaseUrl, capabilityToken, client }: UseImportStateOptions) {
  const [step, setStep] = useState<ImportStep>('choose');
  const [isBusy, setIsBusy] = useState(false);
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [isSessionExpired, setIsSessionExpired] = useState(false);
  const [preview, setPreview] = useState<ImportPreviewResponse | null>(null);
  const [report, setReport] = useState<ConfirmImportResponse | null>(null);

  const requestOptions = useCallback(
    (extra?: ImportsRequestOptions): ImportsRequestOptions => ({
      ...(capabilityToken ? { capabilityToken } : {}),
      ...(extra ?? {}),
    }),
    [capabilityToken]
  );

  const analyzeFile = useCallback(
    async (kind: ImportKind, file: File) => {
      if (!apiBaseUrl && !client) {
        return;
      }

      setIsBusy(true);
      setErrorKey(null);
      setIsSessionExpired(false);

      try {
        const result = client
          ? await client.previewImport(kind, file, requestOptions())
          : await previewImportRequest(apiBaseUrl ?? '', kind, file, requestOptions());

        setPreview(result);
        setReport(null);
        setStep('preview');
      } catch (error) {
        setErrorKey(resolveImportsErrorMessageKey(error));
        setIsSessionExpired(isSessionExpiredError(error));
      } finally {
        setIsBusy(false);
      }
    },
    [apiBaseUrl, client, requestOptions]
  );

  const confirm = useCallback(
    async (importIdentifier: string) => {
      if (!preview || (!apiBaseUrl && !client)) {
        return;
      }

      const identifier = importIdentifier.trim();

      if (!identifier) {
        setErrorKey('imports.confirm.identifierRequired');
        return;
      }

      setIsBusy(true);
      setErrorKey(null);
      setIsSessionExpired(false);

      try {
        const input = { importId: preview.importId, importIdentifier: identifier };
        const result = client
          ? await client.confirmImport(input, requestOptions())
          : await confirmImportRequest(apiBaseUrl ?? '', input, requestOptions());

        setReport(result);
        setStep('report');
      } catch (error) {
        setErrorKey(resolveImportsErrorMessageKey(error));
        setIsSessionExpired(isSessionExpiredError(error));
      } finally {
        setIsBusy(false);
      }
    },
    [apiBaseUrl, client, preview, requestOptions]
  );

  const downloadTemplate = useCallback(
    async (kind: ImportKind): Promise<Blob | null> => {
      if (!apiBaseUrl && !client) {
        return null;
      }

      try {
        return client
          ? await client.downloadTemplate(kind, requestOptions())
          : await downloadTemplateRequest(apiBaseUrl ?? '', kind, requestOptions());
      } catch (error) {
        setErrorKey(resolveImportsErrorMessageKey(error));
        setIsSessionExpired(isSessionExpiredError(error));
        return null;
      }
    },
    [apiBaseUrl, client, requestOptions]
  );

  const downloadErrors = useCallback(async (): Promise<Blob | null> => {
    if (!preview || (!apiBaseUrl && !client)) {
      return null;
    }

    try {
      return client
        ? await client.downloadErrorsCsv(preview.importId, requestOptions())
        : await downloadErrorsCsvRequest(apiBaseUrl ?? '', preview.importId, requestOptions());
    } catch (error) {
      setErrorKey(resolveImportsErrorMessageKey(error));
      setIsSessionExpired(isSessionExpiredError(error));
      return null;
    }
  }, [apiBaseUrl, client, preview, requestOptions]);

  const reset = useCallback(() => {
    setStep('choose');
    setPreview(null);
    setReport(null);
    setErrorKey(null);
    setIsSessionExpired(false);
    setIsBusy(false);
  }, []);

  return {
    analyzeFile,
    confirm,
    downloadErrors,
    downloadTemplate,
    errorKey,
    isBusy,
    isSessionExpired,
    preview,
    report,
    reset,
    step,
  };
}

/** Session-expiry errors block the flow instead of leaving a live action button. */
function isSessionExpiredError(error: unknown) {
  return error instanceof ImportsApiError && error.code === 'INVALID_ACCESS_TOKEN';
}
