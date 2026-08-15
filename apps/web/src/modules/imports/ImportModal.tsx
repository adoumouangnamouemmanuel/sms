import { IMPORT_COLUMNS_BY_KIND, type ImportKind } from '@edutrack/shared';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ModalShell } from '../people/ui';
import { useImportState, type ImportsClient } from './useImportState';

export interface ImportModalProps {
  apiBaseUrl: string | null;
  capabilityToken?: string;
  client?: ImportsClient;
  kind: ImportKind;
  /** Called when the local session expired mid-import, after the modal closes. */
  onSessionExpired?: () => void;
  onClose: () => void;
}

export function ImportModal({
  apiBaseUrl,
  capabilityToken,
  client,
  kind,
  onSessionExpired,
  onClose,
}: ImportModalProps) {
  const { t } = useTranslation();
  const module = useImportState({
    apiBaseUrl,
    ...(capabilityToken ? { capabilityToken } : {}),
    ...(client ? { client } : {}),
  });

  const handleSessionExpired = () => {
    module.reset();
    onClose();
    onSessionExpired?.();
  };

  return (
    <ModalShell
      closeLabel={t('imports.close')}
      onClose={() => {
        module.reset();
        onClose();
      }}
      resizable={module.step === 'preview'}
      size={module.step === 'preview' ? 'lg' : 'md'}
      title={t(module.step === 'report' ? 'imports.report.title' : 'imports.title', {
        kind: t(`imports.kind.${kind}`),
      })}
    >
      {module.step === 'choose' ? (
        <ChooseStep
          errorKey={module.errorKey}
          isBusy={module.isBusy}
          isSessionExpired={module.isSessionExpired}
          onAnalyze={(file) => {
            void module.analyzeFile(kind, file);
          }}
          onDownloadTemplate={() => {
            void downloadBlobToFile(
              module.downloadTemplate(kind),
              `modele-${kind.toLowerCase()}.xlsx`
            );
          }}
          onSessionExpired={handleSessionExpired}
        />
      ) : module.step === 'preview' && module.preview ? (
        <PreviewStep
          errorKey={module.errorKey}
          isBusy={module.isBusy}
          isSessionExpired={module.isSessionExpired}
          key={module.preview.importId}
          kind={kind}
          onConfirm={(identifier) => {
            void module.confirm(identifier);
          }}
          onDownloadErrors={() => {
            void downloadBlobToFile(module.downloadErrors(), 'lignes-en-erreur.csv');
          }}
          onSessionExpired={handleSessionExpired}
          preview={module.preview}
        />
      ) : module.report ? (
        <ReportStep onClose={onClose} report={module.report} />
      ) : null}
    </ModalShell>
  );
}

/** Red banner shared by the choose and preview steps; blocks the flow on session expiry. */
function ImportErrorBanner({
  errorKey,
  isSessionExpired,
  onSessionExpired,
}: {
  errorKey: string | null;
  isSessionExpired: boolean;
  onSessionExpired: () => void;
}) {
  const { t } = useTranslation();

  if (!errorKey) {
    return null;
  }

  return (
    <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2">
      <p className="text-[12px] font-bold text-red-700">{t(errorKey)}</p>
      {isSessionExpired ? (
        <button
          className="mt-1.5 cursor-pointer rounded-lg bg-red-500 px-3 py-1.5 text-[12px] font-bold text-white hover:bg-red-400"
          onClick={onSessionExpired}
          type="button"
        >
          {t('imports.sessionExpiredAction')}
        </button>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 1 — choose a file
// ---------------------------------------------------------------------------

function ChooseStep({
  errorKey,
  isBusy,
  isSessionExpired,
  onAnalyze,
  onDownloadTemplate,
  onSessionExpired,
}: {
  errorKey: string | null;
  isBusy: boolean;
  isSessionExpired: boolean;
  onAnalyze: (file: File) => void;
  onDownloadTemplate: () => void;
  onSessionExpired: () => void;
}) {
  const { t } = useTranslation();
  const [localErrorKey, setLocalErrorKey] = useState<string | null>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const selectFile = (file: File | null) => {
    setSelectedFile(file);
    setLocalErrorKey(null);
  };

  return (
    <div className="space-y-3">
      <p className="text-[13px] font-semibold leading-6 text-slate-500">
        {t('imports.choose.body')}
      </p>

      <button
        className="group relative inline-flex cursor-pointer items-center justify-center overflow-hidden rounded-2xl border border-teal-200/80 bg-teal-50 px-4 py-2 text-xs font-bold uppercase tracking-wider text-teal-700 shadow-sm transition-all hover:-translate-y-0.5 hover:bg-teal-100 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400 disabled:cursor-not-allowed disabled:opacity-50"
        disabled={isBusy || isSessionExpired}
        onClick={onDownloadTemplate}
        type="button"
      >
        <span className="relative z-10">{t('imports.choose.downloadTemplate')}</span>
      </button>

      <label
        className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-[32px] border-2 border-dashed px-4 py-10 text-center transition-all duration-300 focus-within:ring-2 focus-within:ring-teal-400 ${
          isDraggingOver
            ? 'border-teal-400 bg-teal-50/60 shadow-[0_0_30px_-5px_rgba(20,184,166,0.3)]'
            : 'border-slate-200 bg-slate-50 hover:border-teal-300 hover:bg-white hover:shadow-[0_4px_20px_-5px_rgba(0,0,0,0.05)]'
        }`}
        onDragEnter={(event) => {
          event.preventDefault();
          setIsDraggingOver(true);
        }}
        onDragLeave={() => {
          setIsDraggingOver(false);
        }}
        onDragOver={(event) => {
          event.preventDefault();
        }}
        onDrop={(event) => {
          event.preventDefault();
          setIsDraggingOver(false);
          selectFile(event.dataTransfer.files[0] ?? null);
        }}
        data-testid="import-dropzone"
      >
        <input
          accept=".xlsx"
          className="sr-only"
          disabled={isBusy || isSessionExpired}
          onChange={(event) => {
            selectFile(event.target.files?.[0] ?? null);
          }}
          type="file"
        />
        <svg
          aria-hidden="true"
          className="mb-1 h-8 w-8 text-slate-300"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          viewBox="0 0 24 24"
        >
          <path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242" />
          <path d="M12 12v9" />
          <path d="m16 16-4-4-4 4" />
        </svg>
        <p className="text-[13px] font-bold text-slate-600">{t('imports.choose.dropzone')}</p>
        <p className="text-[12px] font-semibold text-slate-400">{t('imports.choose.dropzoneOr')}</p>
        <span className="rounded-lg bg-teal-500 px-3 py-1.5 text-[12px] font-bold text-white">
          {t('imports.choose.chooseFile')}
        </span>
        <p className="mt-1 text-[12px] font-bold text-slate-500">
          {selectedFile ? selectedFile.name : t('imports.choose.noFile')}
        </p>
      </label>

      {localErrorKey ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[12px] font-bold text-red-700">
          {t(localErrorKey)}
        </p>
      ) : null}

      <ImportErrorBanner
        errorKey={errorKey}
        isSessionExpired={isSessionExpired}
        onSessionExpired={onSessionExpired}
      />

      <div className="flex justify-end pt-2">
        <button
          className="group relative inline-flex cursor-pointer items-center justify-center overflow-hidden rounded-2xl bg-teal-500 px-6 py-2.5 text-xs font-bold uppercase tracking-wider text-white shadow-[0_0_20px_-5px_rgba(20,184,166,0.5)] transition-all hover:scale-105 hover:bg-teal-400 hover:shadow-[0_0_30px_-5px_rgba(20,184,166,0.6)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100 disabled:hover:shadow-none"
          disabled={isBusy || !selectedFile || isSessionExpired}
          onClick={() => {
            if (!selectedFile) {
              setLocalErrorKey('imports.choose.fileRequired');
              return;
            }

            if (!selectedFile.name.toLowerCase().endsWith('.xlsx')) {
              setLocalErrorKey('imports.choose.extensionRequired');
              return;
            }

            setLocalErrorKey(null);
            onAnalyze(selectedFile);
          }}
          type="button"
        >
          <span className="relative z-10">
            {isBusy ? t('imports.choose.analyzing') : t('imports.choose.analyze')}
          </span>
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 2 — preview and confirm
// ---------------------------------------------------------------------------

function PreviewStep({
  errorKey,
  isBusy,
  isSessionExpired,
  kind,
  onConfirm,
  onDownloadErrors,
  onSessionExpired,
  preview,
}: {
  errorKey: string | null;
  isBusy: boolean;
  isSessionExpired: boolean;
  kind: ImportKind;
  onConfirm: (importIdentifier: string) => void;
  onDownloadErrors: () => void;
  onSessionExpired: () => void;
  preview: NonNullable<ReturnType<typeof useImportState>['preview']>;
}) {
  const { t } = useTranslation();
  // Prefilled from the file name (e.g. eleves-exemple-2026-08-15); editable, and
  // re-derived per preview via the key on PreviewStep.
  const [identifier, setIdentifier] = useState(() => suggestImportIdentifier(preview.filename));
  const columns = IMPORT_COLUMNS_BY_KIND[kind];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full border border-teal-200 bg-teal-50 px-2.5 py-1 text-[11px] font-bold text-teal-700">
          {t('imports.preview.valid', { count: preview.validRows })}
        </span>
        <span className="rounded-full border border-red-200 bg-red-50 px-2.5 py-1 text-[11px] font-bold text-red-700">
          {t('imports.preview.errors', { count: preview.errorRows })}
        </span>
        <span className="rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-600">
          {t('imports.preview.total', { count: preview.totalRows })}
        </span>
        {preview.rows.some((row) => row.possibleDuplicate) ? (
          <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-bold text-amber-700">
            {t('imports.preview.possibleDuplicates', {
              count: preview.rows.filter((row) => row.possibleDuplicate).length,
            })}
          </span>
        ) : null}
      </div>

      <div className="max-h-[26rem] overflow-auto rounded-3xl border border-slate-100 shadow-sm">
        <table className="w-full min-w-[640px] border-collapse whitespace-nowrap">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/70 text-left">
              <th className="px-2.5 py-2 text-[10px] font-black uppercase tracking-wide text-slate-400">
                {t('imports.preview.row')}
              </th>
              {columns.map((column) => (
                <th
                  className="px-2.5 py-2 text-[10px] font-black uppercase tracking-wide text-slate-400"
                  key={column.key}
                >
                  {column.label}
                </th>
              ))}
              <th className="px-2.5 py-2 text-[10px] font-black uppercase tracking-wide text-slate-400">
                {t('imports.preview.errorsColumn')}
              </th>
            </tr>
          </thead>
          <tbody>
            {preview.rows.map((row) => (
              <tr
                className={`border-b border-slate-50 ${
                  row.errors.length > 0
                    ? 'bg-red-50/50'
                    : row.possibleDuplicate
                      ? 'bg-amber-50/40'
                      : ''
                }`}
                key={row.rowNumber}
              >
                <td className="px-2.5 py-2 text-[11px] font-bold text-slate-400">
                  {row.rowNumber}
                </td>
                {columns.map((column) => (
                  <td
                    className="px-2.5 py-2 text-[12px] font-semibold text-slate-700"
                    key={column.key}
                  >
                    {column.key === 'code' && !row.values.code ? (
                      <span className="text-[10px] font-bold italic text-slate-300">
                        {t('imports.preview.autoCode')}
                      </span>
                    ) : (
                      (row.values[column.key] ?? '—')
                    )}
                  </td>
                ))}
                <td className="px-2.5 py-2">
                  {row.errors.length > 0 ? (
                    <span className="text-[11px] font-bold leading-snug text-red-600">
                      {row.errors.join(' · ')}
                    </span>
                  ) : row.possibleDuplicate ? (
                    <span className="text-[11px] font-bold leading-snug text-amber-600">
                      {t('imports.preview.possibleDuplicate')}
                    </span>
                  ) : (
                    <span className="text-[11px] font-bold text-teal-600">
                      {t('imports.preview.ok')}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {preview.errorRows > 0 ? (
        <button
          className="group relative inline-flex cursor-pointer items-center justify-center overflow-hidden rounded-2xl border border-slate-200/80 bg-white px-4 py-2 text-xs font-bold uppercase tracking-wider text-slate-600 shadow-sm transition-all hover:-translate-y-0.5 hover:border-teal-300 hover:text-teal-700 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400"
          onClick={onDownloadErrors}
          type="button"
        >
          <span className="relative z-10">{t('imports.preview.downloadErrors')}</span>
        </button>
      ) : null}

      <label className="flex flex-col gap-2">
        <span className="text-[13px] font-bold text-slate-800">
          {t('imports.confirm.identifier')}
        </span>
        <input
          className="h-[50px] w-full cursor-text rounded-2xl border border-slate-200 bg-slate-50 px-4 text-[14px] font-medium text-slate-900 shadow-[inset_0_2px_4px_rgba(0,0,0,0.02)] outline-none transition-all placeholder:font-medium placeholder:text-slate-400 hover:border-slate-300 focus:border-teal-500 focus:bg-white focus:ring-4 focus:ring-teal-600/10"
          onChange={(event) => {
            setIdentifier(event.target.value);
          }}
          placeholder={t('imports.confirm.identifierPlaceholder')}
          type="text"
          value={identifier}
        />
        <p className="text-[11px] font-semibold text-slate-400">
          {t('imports.confirm.identifierHint')}
        </p>
      </label>

      <ImportErrorBanner
        errorKey={errorKey}
        isSessionExpired={isSessionExpired}
        onSessionExpired={onSessionExpired}
      />

      <div className="flex justify-end pt-2">
        <button
          className="group relative inline-flex cursor-pointer items-center justify-center overflow-hidden rounded-2xl bg-teal-500 px-6 py-2.5 text-xs font-bold uppercase tracking-wider text-white shadow-[0_0_20px_-5px_rgba(20,184,166,0.5)] transition-all hover:scale-105 hover:bg-teal-400 hover:shadow-[0_0_30px_-5px_rgba(20,184,166,0.6)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100 disabled:hover:shadow-none"
          disabled={isBusy || !identifier.trim() || isSessionExpired}
          onClick={() => {
            onConfirm(identifier);
          }}
          type="button"
        >
          <span className="relative z-10">
            {isBusy ? t('imports.confirm.confirming') : t('imports.confirm.submit')}
          </span>
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 3 — report
// ---------------------------------------------------------------------------

function ReportStep({
  onClose,
  report,
}: {
  onClose: () => void;
  report: NonNullable<ReturnType<typeof useImportState>['report']>;
}) {
  const { t } = useTranslation();

  return (
    <div className="space-y-3">
      {report.alreadyConfirmed ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] font-bold text-amber-700">
          {t('imports.report.alreadyConfirmed')}
        </p>
      ) : null}

      <div className="grid grid-cols-3 gap-2">
        <ReportCount label={t('imports.report.imported')} tone="teal" value={report.imported} />
        <ReportCount
          label={t('imports.report.skipped')}
          tone="slate"
          value={report.skippedExisting}
        />
        <ReportCount label={t('imports.report.errors')} tone="red" value={report.errorRows} />
      </div>

      <p className="font-mono text-[12px] font-bold text-slate-400">
        {t('imports.report.identifier', { identifier: report.importIdentifier })}
      </p>

      <div className="flex justify-end pt-2">
        <button
          className="group relative inline-flex cursor-pointer items-center justify-center overflow-hidden rounded-2xl bg-teal-500 px-6 py-2.5 text-xs font-bold uppercase tracking-wider text-white shadow-[0_0_20px_-5px_rgba(20,184,166,0.5)] transition-all hover:scale-105 hover:bg-teal-400 hover:shadow-[0_0_30px_-5px_rgba(20,184,166,0.6)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400"
          onClick={onClose}
          type="button"
        >
          <span className="relative z-10">{t('imports.close')}</span>
        </button>
      </div>
    </div>
  );
}

function ReportCount({
  label,
  tone,
  value,
}: {
  label: string;
  tone: 'teal' | 'slate' | 'red';
  value: number;
}) {
  const toneClasses =
    tone === 'teal'
      ? 'border-teal-200 bg-teal-50 text-teal-700'
      : tone === 'red'
        ? 'border-red-200 bg-red-50 text-red-700'
        : 'border-slate-200 bg-slate-50 text-slate-600';

  return (
    <div className={`rounded-3xl border px-3 py-4 text-center shadow-sm ${toneClasses}`}>
      <p className="text-3xl font-black leading-tight tracking-tight">{value}</p>
      <p className="mt-1 text-[10px] font-bold uppercase tracking-wide opacity-80">{label}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Slugs the file name (without extension) + today's date: eleves-exemple-2026-08-15. */
function suggestImportIdentifier(filename: string) {
  const baseName = filename.replace(/\.[^.]+$/, '');
  const slug = baseName
    .toLocaleLowerCase('fr')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  const today = new Date().toISOString().slice(0, 10);

  return `${slug}-${today}`;
}

async function downloadBlobToFile(blobPromise: Promise<Blob | null>, filename: string) {
  const blob = await blobPromise;

  if (!blob) {
    return;
  }

  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();

  setTimeout(() => {
    URL.revokeObjectURL(url);
    anchor.remove();
  }, 100);
}
